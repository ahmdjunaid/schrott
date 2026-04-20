-- 1. PURE LEDGER PURCHASE FUNCTION (V3 - Single Ledger Row + Full Bill Settlement)
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
  -- 1. Calculate Total Cost of Invoice
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- 2. Calculate Current Account Credit (Payments - Invoices)
  -- This is the net credit available to settle this bill
  SELECT COALESCE(SUM(amount), 0) INTO v_current_credit FROM supplier_payments WHERE supplier_id = p_supplier_id;
  SELECT v_current_credit - COALESCE(SUM(total_amount), 0) INTO v_current_credit FROM purchases WHERE supplier_id = p_supplier_id;
  
  -- 3. Apply credit "fictitiously" to the purchase record only
  -- This makes the individual bill show as 'PAID' in the list
  IF v_current_credit > 0 THEN
    v_advance_to_use := LEAST(v_current_credit, v_total_amount - p_paid_amount);
  END IF;
  
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  END IF;

  -- 4. Record Purchase (Store full payment for visual settlement)
  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_purchase_id;

  -- 5. Record Ledger Entry (Strictly Actual Payment - FOR BANK RECONCILIATION)
  -- No splitting. If you pay 1000, we record 1000. No adjustment rows created.
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (v_purchase_id, p_supplier_id, p_paid_amount, p_payment_method);
  END IF;

  -- 6. Items & Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_items (purchase_id, product_id, quantity, remaining_qty, purchase_price, sgst, cgst, total, description)
    VALUES (v_purchase_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'quantity')::INTEGER, (v_item->>'purchase_price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC, (v_item->>'description')::TEXT);
    UPDATE products SET stock = stock + (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- 2. PURE LEDGER BILLING FUNCTION (V3)
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
  v_current_credit NUMERIC := 0;
  v_advance_to_use NUMERIC := 0;
  v_effective_paid NUMERIC := 0;
  v_status TEXT := 'PENDING';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_current_credit FROM payments WHERE customer_id = p_customer_id;
  SELECT v_current_credit - COALESCE(SUM(total_amount), 0) INTO v_current_credit FROM bills WHERE customer_id = p_customer_id;

  IF v_current_credit > 0 THEN
    v_advance_to_use := LEAST(v_current_credit, v_total_amount - p_paid_amount);
  END IF;
  
  v_effective_paid := p_paid_amount + v_advance_to_use;

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
    VALUES (v_bill_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC);
    UPDATE products SET stock = stock - (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;
