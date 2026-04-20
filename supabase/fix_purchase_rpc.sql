-- 1. DROP CONFLICTING FUNCTIONS
DROP FUNCTION IF EXISTS create_purchase_and_update_stock(UUID, JSONB, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_purchase_and_update_stock(UUID, JSONB, DECIMAL, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_bill_and_update_stock(UUID, JSONB, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_bill_and_update_stock(UUID, JSONB, DECIMAL, TEXT, BOOLEAN);

-- 2. REBUILD PURCHASE FUNCTION (Ultimate Version with Standardized Ledger Names)
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
  v_status TEXT;
  v_advance_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
  v_advance_to_use NUMERIC;
BEGIN
  -- Total Amount Calculation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Ledger-style Advance check
  SELECT COALESCE(SUM(amount), 0) INTO v_advance_credit FROM supplier_payments WHERE supplier_id = p_supplier_id AND purchase_id IS NULL;
  
  v_advance_to_use := LEAST(v_advance_credit, v_total_amount - p_paid_amount);
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  ELSE v_status := 'PENDING';
  END IF;

  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_purchase_id;

  -- Standardized Ledger Consumption
  IF v_advance_to_use > 0 THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method) VALUES (v_purchase_id, p_supplier_id, v_advance_to_use, 'advance_adjust');
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method) VALUES (NULL, p_supplier_id, -v_advance_to_use, 'advance_use');
  END IF;

  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method) VALUES (v_purchase_id, p_supplier_id, p_paid_amount, p_payment_method);
  END IF;

  -- Insert Items with Batch Tracking (Matching your schema)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_items (
      purchase_id, product_id, quantity, remaining_qty, 
      purchase_price, sgst, cgst, total, description
    )
    VALUES (
      v_purchase_id, 
      (v_item->>'product_id')::UUID, 
      (v_item->>'quantity')::INTEGER, 
      (v_item->>'quantity')::INTEGER, 
      (v_item->>'purchase_price')::NUMERIC, 
      (v_item->>'sgst')::NUMERIC, 
      (v_item->>'cgst')::NUMERIC, 
      (v_item->>'total')::NUMERIC, 
      (v_item->>'description')::TEXT
    );
    UPDATE products SET stock = stock + (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- 3. REBUILD BILLING FUNCTION (Standardized Ledger Names)
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
  v_status TEXT;
  v_advance_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
  v_advance_to_use NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_advance_credit FROM payments WHERE customer_id = p_customer_id AND bill_id IS NULL;
  
  v_advance_to_use := LEAST(v_advance_credit, v_total_amount - p_paid_amount);
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  ELSE v_status := 'PENDING';
  END IF;

  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_bill_id;

  IF v_advance_to_use > 0 THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method) VALUES (v_bill_id, p_customer_id, v_advance_to_use, 'advance_adjust');
    INSERT INTO payments (bill_id, customer_id, amount, payment_method) VALUES (NULL, p_customer_id, -v_advance_to_use, 'advance_use');
  END IF;

  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method) VALUES (v_bill_id, p_customer_id, p_paid_amount, p_payment_method);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO bill_items (bill_id, product_id, quantity, price, sgst, cgst, total)
    VALUES (v_bill_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC);
    UPDATE products SET stock = stock - (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;
