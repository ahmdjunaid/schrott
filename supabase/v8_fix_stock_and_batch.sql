-- ==========================================
-- FINAL SYSTEM SYNC: BATCH-ACCURATE BILLING & STOCK
-- ==========================================

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
  -- 1. Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- 2. Handle Advance Credit (Unified Ledger)
  SELECT COALESCE(SUM(amount), 0) INTO v_advance_credit FROM payments WHERE customer_id = p_customer_id AND bill_id IS NULL;
  
  v_advance_to_use := LEAST(v_advance_credit, v_total_amount - p_paid_amount);
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  -- 3. Determine status
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  ELSE v_status := 'PENDING';
  END IF;

  -- 4. Insert bill
  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_bill_id;

  -- 5. Track Advance Usage
  IF v_advance_to_use > 0 THEN
    -- Link advance to this bill
    INSERT INTO payments (bill_id, customer_id, amount, payment_method, note) 
    VALUES (v_bill_id, p_customer_id, v_advance_to_use, 'upi', 'Advance Applied');
    
    -- Record withdrawal from general advance
    INSERT INTO payments (bill_id, customer_id, amount, payment_method, note) 
    VALUES (NULL, p_customer_id, -v_advance_to_use, 'upi', 'Consumed for Bill #' || v_bill_id);
  END IF;

  -- 6. Track Manual Payment
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method) 
    VALUES (v_bill_id, p_customer_id, p_paid_amount, p_payment_method);
  END IF;

  -- 7. Insert items and SYNC BATCH STOCK
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO bill_items (
      bill_id, 
      product_id, 
      purchase_item_id, 
      quantity, 
      price, 
      purchase_price, 
      sgst, 
      cgst, 
      total
    )
    VALUES (
      v_bill_id, 
      (v_item->>'product_id')::UUID, 
      (v_item->>'purchase_item_id')::UUID, 
      (v_item->>'quantity')::INTEGER, 
      (v_item->>'selling_price')::NUMERIC, 
      (v_item->>'purchase_price')::NUMERIC, 
      (v_item->>'sgst')::NUMERIC, 
      (v_item->>'cgst')::NUMERIC, 
      (v_item->>'total')::NUMERIC
    );

    -- UPDATE GLOBAL STOCK
    UPDATE products 
    SET stock = stock - (v_item->>'quantity')::INTEGER 
    WHERE id = (v_item->>'product_id')::UUID;

    -- UPDATE BATCH STOCK (Critical Fix)
    IF (v_item->>'purchase_item_id') IS NOT NULL THEN
      UPDATE purchase_items 
      SET remaining_qty = remaining_qty - (v_item->>'quantity')::INTEGER 
      WHERE id = (v_item->>'purchase_item_id')::UUID;
    END IF;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;
