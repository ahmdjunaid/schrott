-- ==========================================
-- FINAL CLEANUP & PURE LEDGER STANDARDIZATION (V4)
-- This script fixes the "Record Payment" button splitting issue.
-- ==========================================

-- 1. DROP ALL GHOST FUNCTIONS
DROP FUNCTION IF EXISTS create_purchase_and_update_stock(UUID, JSONB, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_bill_and_update_stock(UUID, JSONB, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS settle_supplier_balance(UUID, NUMERIC, TEXT);

-- 2. REWRITE SETTLE_SUPPLIER_BALANCE (Pure Ledger Style)
-- This records ONE payment but settles multiple bills visually.
CREATE OR REPLACE FUNCTION settle_supplier_balance(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_payment NUMERIC := p_amount;
  v_purchase RECORD;
  v_to_apply NUMERIC;
  v_first_purchase_id UUID;
BEGIN
  -- A. Find the first unpaid purchase to "link" this payment to for history
  -- In Pure Ledger, linkage is loose, but we need an ID for the table constraint
  SELECT id INTO v_first_purchase_id 
  FROM purchases 
  WHERE supplier_id = p_supplier_id 
  ORDER BY created_at DESC LIMIT 1;

  -- B. Record EXACTLY ONE Ledger Entry (Matches Bank Statement)
  INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
  VALUES (v_first_purchase_id, p_supplier_id, p_amount, p_method);

  -- C. Update Purchase Visual Statuses (Background Task)
  -- This makes the bills show as 'PAID' in the list without creating extra ledger rows
  FOR v_purchase IN 
    SELECT id, total_amount, paid_amount 
    FROM purchases 
    WHERE supplier_id = p_supplier_id 
      AND status != 'PAID' 
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN EXIT; END IF;

    v_to_apply := LEAST(v_remaining_payment, v_purchase.total_amount - v_purchase.paid_amount);

    UPDATE purchases 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   WHEN (paid_amount + v_to_apply) > 0 THEN 'PARTIAL'
                   ELSE 'PENDING'
                 END
    WHERE id = v_purchase.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. RE-INSTALL STANDARDIZED PURCHASE FUNC
CREATE OR REPLACE FUNCTION create_purchase_and_update_stock(
  p_supplier_id UUID,
  p_items JSONB,
  p_paid_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL,
  p_use_wallet BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_current_credit NUMERIC := 0;
  v_advance_to_use NUMERIC := 0;
  v_effective_paid NUMERIC := 0;
  v_status TEXT := 'PENDING';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Credit Calculation
  SELECT COALESCE(SUM(amount), 0) INTO v_current_credit FROM supplier_payments WHERE supplier_id = p_supplier_id;
  SELECT v_current_credit - COALESCE(SUM(total_amount), 0) INTO v_current_credit FROM purchases WHERE supplier_id = p_supplier_id;
  
  IF v_current_credit > 0 THEN
    v_advance_to_use := LEAST(v_current_credit, v_total_amount - p_paid_amount);
  END IF;
  
  v_effective_paid := p_paid_amount + v_advance_to_use;
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  END IF;

  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_purchase_id;

  -- ONE SINGLE PAYMENT ROW
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (v_purchase_id, p_supplier_id, p_paid_amount, p_payment_method);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_items (purchase_id, product_id, quantity, remaining_qty, purchase_price, sgst, cgst, total, description)
    VALUES (v_purchase_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'quantity')::INTEGER, (v_item->>'purchase_price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC, (v_item->>'description')::TEXT);
    UPDATE products SET stock = stock + (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;
