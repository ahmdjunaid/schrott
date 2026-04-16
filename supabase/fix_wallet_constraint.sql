-- 1. Update the table constraint to allow wallet payments
ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_payment_method_check;

ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_payment_method_check 
CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'wallet_advance'));

-- 2. Update the RPC to use the now-allowed 'wallet_advance' value
CREATE OR REPLACE FUNCTION create_purchase_and_update_stock(
  p_supplier_id UUID,
  p_items JSONB,
  p_paid_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_status TEXT;
  v_wallet_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
BEGIN
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Check for existing supplier wallet balance
  SELECT wallet_balance INTO v_wallet_credit FROM suppliers WHERE id = p_supplier_id;
  
  -- Effective paid amount
  v_effective_paid := p_paid_amount + v_wallet_credit;
  
  IF v_wallet_credit > 0 THEN
    UPDATE suppliers 
    SET wallet_balance = GREATEST(0, wallet_balance - (v_total_amount - p_paid_amount))
    WHERE id = p_supplier_id;
    
    v_effective_paid := LEAST(v_total_amount, p_paid_amount + v_wallet_credit);
  END IF;

  -- Determine status
  IF v_effective_paid >= v_total_amount THEN
    v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN
    v_status := 'PARTIAL';
  ELSE
    v_status := 'PENDING';
  END IF;

  -- Insert purchase
  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_purchase_id;

  -- 1. If user paid cash/upi now
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase_id, p_paid_amount, p_payment_method);
  END IF;
  
  -- 2. If wallet credit was used
  IF v_wallet_credit > 0 THEN
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase_id, LEAST(v_wallet_credit, v_total_amount - p_paid_amount), 'wallet_advance');
  END IF;

  -- Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO purchase_items (purchase_id, product_id, quantity, price, tax, total)
    VALUES (
      v_purchase_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC,
      (v_item->>'tax')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    UPDATE products
    SET stock = stock + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;
