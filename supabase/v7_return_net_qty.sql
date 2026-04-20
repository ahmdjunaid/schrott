-- ==========================================
-- SALES RETURN ENHANCEMENTS: BATCH INTEGRITY & LEDGER ORDERING
-- ==========================================

-- 1. Add bill_item_id to track EXACT sale record
ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS bill_item_id UUID REFERENCES bill_items(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. Refined Sales Return RPC
CREATE OR REPLACE FUNCTION process_sales_return(
  p_customer_id UUID,
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- 1. Insert Return first
  INSERT INTO sales_returns (customer_id, total_amount, refund_amount, refund_method, description, created_at)
  VALUES (p_customer_id, v_total_amount, p_refund_amount, p_refund_method, p_description, v_return_timestamp)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sales_return_items (return_id, product_id, batch_id, bill_item_id, quantity, price, total)
    VALUES (
      v_return_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'batch_id')::UUID,
      (v_item->>'bill_item_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    -- INCRESASE PRODUCT STOCK (Global)
    UPDATE products 
    SET stock = stock + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- INCREASE SPECIFIC BATCH (Restoring to same batch)
    UPDATE purchase_items
    SET remaining_qty = remaining_qty + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'batch_id')::UUID;
  END LOOP;

  -- 2. Insert Refund if needed (slightly later timestamp to ensure ledger order)
  IF p_refund_amount > 0 AND p_refund_method IS NOT NULL THEN
    INSERT INTO payments (customer_id, amount, payment_method, note, created_at)
    VALUES (p_customer_id, -p_refund_amount, p_refund_method, 'REFUND', v_return_timestamp + interval '1 second');
  END IF;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;
