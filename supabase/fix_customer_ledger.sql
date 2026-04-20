-- ==========================================
-- FIX CUSTOMER LEDGER (Pure 1:1 Rule)
-- Only run this if Customer Payments are splitting
-- ==========================================

-- 1. Standardized Customer Settlement (Pure Ledger - 1:1 Only)
CREATE OR REPLACE FUNCTION settle_customer_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_payment NUMERIC := p_amount;
  v_bill RECORD;
  v_to_apply NUMERIC;
  v_first_bill_id UUID;
BEGIN
  -- A. Find the latest bill ID
  v_first_bill_id := (SELECT id FROM bills WHERE customer_id = p_customer_id ORDER BY created_at DESC LIMIT 1);

  -- B. RECORD EXACTLY ONE ROW
  INSERT INTO payments (bill_id, customer_id, amount, payment_method)
  VALUES (v_first_bill_id, p_customer_id, p_amount, p_method);

  -- C. Background Settlement (Visual only)
  FOR v_bill IN 
    SELECT id, total_amount, paid_amount 
    FROM bills 
    WHERE customer_id = p_customer_id AND status != 'PAID' 
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN EXIT; END IF;
    v_to_apply := LEAST(v_remaining_payment, v_bill.total_amount - v_bill.paid_amount);
    
    UPDATE bills SET 
      paid_amount = paid_amount + v_to_apply,
      status = CASE 
                 WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                 WHEN (paid_amount + v_to_apply) > 0 THEN 'PARTIAL'
                 ELSE 'PENDING'
               END
    WHERE id = v_bill.id;
    
    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Restore Create Bill Function (Pure Ledger - 1:1 Only)
CREATE OR REPLACE FUNCTION create_bill_and_update_stock(
  p_customer_id UUID,
  p_items JSONB,
  p_paid_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL,
  p_use_wallet BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_current_advance NUMERIC := 0;
  v_advance_used NUMERIC := 0;
  v_effective_paid NUMERIC := 0;
  v_status TEXT := 'PENDING';
BEGIN
  -- Calculate Total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Simple Balance Calculation
  v_current_advance := (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE customer_id = p_customer_id) 
                     - (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE customer_id = p_customer_id);

  IF v_current_advance > 0 THEN
    v_advance_used := LEAST(v_current_advance, v_total_amount - p_paid_amount);
  END IF;

  v_effective_paid := p_paid_amount + v_advance_used;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  END IF;

  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_bill_id;

  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (v_bill_id, p_customer_id, p_paid_amount, p_payment_method);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO bill_items (bill_id, product_id, quantity, price, sgst, cgst, total)
    VALUES (v_bill_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'selling_price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC);
    UPDATE products SET stock = stock - (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;
