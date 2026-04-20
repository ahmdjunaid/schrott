-- ==========================================
-- RETURNS SYSTEM V2 (Batch & Cash Refund Support)
-- ==========================================

-- 1. Sales Returns Table
CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method TEXT CHECK (refund_method IN ('cash', 'upi', 'card', 'bank_transfer')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Purchase Returns Table
CREATE TABLE IF NOT EXISTS purchase_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method TEXT CHECK (refund_method IN ('cash', 'upi', 'card', 'bank_transfer')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES purchase_items(id) ON DELETE RESTRICT, -- Must specify batch for purchase returns
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RPC for Sales Return
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
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Create return record
  INSERT INTO sales_returns (customer_id, total_amount, refund_amount, refund_method, description)
  VALUES (p_customer_id, v_total_amount, p_refund_amount, p_refund_method, p_description)
  RETURNING id INTO v_return_id;

  -- Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sales_return_items (return_id, product_id, quantity, price, total)
    VALUES (
      v_return_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    -- 1. INCREASE PRODUCT STOCK
    UPDATE products 
    SET stock = stock + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- 2. CREATE A NEW BATCH FOR RETURNED ITEMS (To track separately)
    INSERT INTO purchase_items (product_id, quantity, remaining_qty, purchase_price, description, total)
    VALUES (
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC, -- Use return price as base cost
      'SALES RETURN - ' || p_description,
      (v_item->>'total')::NUMERIC
    );
  END LOOP;

  -- 3. RECORD REFUND PAYMENT (Negative Payment in ledger)
  -- This balances the ledger if cash was paid back to customer
  IF p_refund_amount > 0 AND p_refund_method IS NOT NULL THEN
    INSERT INTO payments (customer_id, amount, payment_method)
    VALUES (p_customer_id, -p_refund_amount, p_refund_method);
  END IF;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;

-- 4. RPC for Purchase Return
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
BEGIN
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Create return record
  INSERT INTO purchase_returns (supplier_id, total_amount, refund_amount, refund_method, description)
  VALUES (p_supplier_id, v_total_amount, p_refund_amount, p_refund_method, p_description)
  RETURNING id INTO v_return_id;

  -- Process items
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

    -- 1. DECREASE PRODUCT STOCK
    UPDATE products 
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- 2. DECREASE SPECIFIC BATCH QUANTITY
    UPDATE purchase_items
    SET remaining_qty = remaining_qty - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'batch_id')::UUID;
  END LOOP;

  -- 3. RECORD REFUND RECEIVED (Negative Supplier Payment)
  -- This reduces our debt or increases advance credit if supplier hand back cash
  IF p_refund_amount > 0 AND p_refund_method IS NOT NULL THEN
    INSERT INTO supplier_payments (supplier_id, amount, payment_method)
    VALUES (p_supplier_id, -p_refund_amount, p_refund_method);
  END IF;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql;
