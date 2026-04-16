-- 1. Add wallet_balance to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- 2. Update settle_supplier_balance to handle overpayments
CREATE OR REPLACE FUNCTION settle_supplier_balance(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_payment NUMERIC := p_amount;
  v_purchase RECORD;
  v_to_apply NUMERIC;
BEGIN
  -- Cycle through unpaid purchases oldest first
  FOR v_purchase IN 
    SELECT id, balance_amount 
    FROM purchases 
    WHERE supplier_id = p_supplier_id 
      AND status != 'PAID' 
      AND balance_amount > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_to_apply := LEAST(v_remaining_payment, v_purchase.balance_amount);

    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase.id, v_to_apply, p_method);

    UPDATE purchases 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_purchase.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;

  -- If there's still money left after all bills are settled, store it in the supplier's wallet
  IF v_remaining_payment > 0 THEN
    UPDATE suppliers 
    SET wallet_balance = wallet_balance + v_remaining_payment 
    WHERE id = p_supplier_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Update create_purchase_and_update_stock to auto-apply wallet balance
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

  -- Check for existing supplier wallet balance (advance credit)
  SELECT wallet_balance INTO v_wallet_credit FROM suppliers WHERE id = p_supplier_id;
  
  -- Effective paid amount = User entry + Wallet credit
  -- But wallet credit shouldn't exceed the total amount of this new purchase
  v_effective_paid := p_paid_amount + v_wallet_credit;
  
  -- If we have enough credit to cover or partially cover, adjust wallet
  IF v_wallet_credit > 0 THEN
    -- If wallet covers everything, new wallet = old - used. If not, new wallet = 0.
    UPDATE suppliers 
    SET wallet_balance = GREATEST(0, wallet_balance - (v_total_amount - p_paid_amount))
    WHERE id = p_supplier_id;
    
    -- Re-calculate effective paid for status (can't pay more than total)
    v_effective_paid := LEAST(v_total_amount, p_paid_amount + v_wallet_credit);
  END IF;

  -- Determine status based on effective payment
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

  -- Record traces
  -- 1. If user paid cash/upi now
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase_id, p_paid_amount, p_payment_method);
  END IF;
  
  -- 2. If wallet credit was used
  IF v_wallet_credit > 0 THEN
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase_id, LEAST(v_wallet_credit, v_total_amount - p_paid_amount), 'Wallet/Advance');
  END IF;

  -- Insert items and update stock (Standard logic)
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
