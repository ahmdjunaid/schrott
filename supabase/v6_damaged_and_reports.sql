-- ==========================================
-- RETURNS V3, DAMAGED STOCK & REPORTS
-- ==========================================

-- 1. Update Sales Return Items to include Batch ID
ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES purchase_items(id) ON DELETE RESTRICT;

-- 2. Damaged Stock Table
CREATE TABLE IF NOT EXISTS damaged_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES purchase_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Update Sales Return RPC (Restock SAME Batch)
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
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  INSERT INTO sales_returns (customer_id, total_amount, refund_amount, refund_method, description)
  VALUES (p_customer_id, v_total_amount, p_refund_amount, p_refund_method, p_description)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sales_return_items (return_id, product_id, batch_id, quantity, price, total)
    VALUES (
      v_return_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'batch_id')::UUID,
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

  IF p_refund_amount > 0 AND p_refund_method IS NOT NULL THEN
    INSERT INTO payments (customer_id, amount, payment_method)
    VALUES (p_customer_id, -p_refund_amount, p_refund_method);
  END IF;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;

-- 4. RPC for Marking Damaged Stock
CREATE OR REPLACE FUNCTION mark_as_damaged(
  p_product_id UUID,
  p_batch_id UUID,
  p_quantity INTEGER,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Record damaged stock
  INSERT INTO damaged_stock (product_id, batch_id, quantity, reason)
  VALUES (p_product_id, p_batch_id, p_quantity, p_reason);

  -- 2. Decrease Stock (Global)
  UPDATE products 
  SET stock = stock - p_quantity
  WHERE id = p_product_id;

  -- 3. Decrease Batch Quantity
  UPDATE purchase_items
  SET remaining_qty = remaining_qty - p_quantity
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Reporting Helper Function (Profit & Sales)
CREATE OR REPLACE FUNCTION get_financial_reports()
RETURNS JSONB AS $$
DECLARE
  v_total_purchases NUMERIC;
  v_total_supplier_paid NUMERIC;
  v_total_sales NUMERIC;
  v_total_customer_paid NUMERIC;
  v_total_profit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_purchases FROM purchases;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_supplier_paid FROM supplier_payments;
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_sales FROM bills;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_customer_paid FROM payments;

  -- Profit = (Sale Total - (Qty * Batch Purchase Price))
  SELECT COALESCE(SUM(bi.total - (bi.quantity * pi.purchase_price)), 0)
  INTO v_total_profit
  FROM bill_items bi
  JOIN purchase_items pi ON bi.purchase_item_id = pi.id;

  RETURN jsonb_build_object(
    'purchases', v_total_purchases,
    'supplier_paid', v_total_supplier_paid,
    'sales', v_total_sales,
    'customer_paid', v_total_customer_paid,
    'profit', v_total_profit
  );
END;
$$ LANGUAGE plpgsql;
