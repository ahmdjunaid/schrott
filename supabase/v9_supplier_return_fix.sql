-- ==========================================
-- SUPPLIER RETURNS ENHANCEMENTS: LEDGER ORDERING
-- ==========================================

ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS note TEXT;

CREATE OR REPLACE FUNCTION process_purchase_return(
  p_supplier_id UUID,
  p_items JSONB,
  p_refund_amount NUMERIC DEFAULT 0,
  p_refund_method TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_return_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_return_timestamp TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- 1. Create return record (Return record shows the debit to supplier)
  INSERT INTO purchase_returns (supplier_id, total_amount, refund_amount, refund_method, description, created_at)
  VALUES (p_supplier_id, v_total_amount, p_refund_amount, p_refund_method, p_description, v_return_timestamp)
  RETURNING id INTO v_return_id;

  -- 2. Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_return_items (return_id, product_id, batch_id, quantity, price, total)
    VALUES (
      v_return_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'batch_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    -- DECREASE PRODUCT STOCK
    UPDATE products 
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- DECREASE SPECIFIC BATCH QUANTITY
    UPDATE purchase_items
    SET remaining_qty = remaining_qty - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'batch_id')::UUID;
  END LOOP;

  -- 3. RECORD REFUND RECEIVED (Negative Supplier Payment + 1.sec delay for ledger order)
  IF p_refund_amount > 0 AND p_refund_method IS NOT NULL THEN
    INSERT INTO supplier_payments (supplier_id, amount, payment_method, note, created_at)
    VALUES (p_supplier_id, -p_refund_amount, p_refund_method, 'REFUND', v_return_timestamp + interval '1 second');
  END IF;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;
