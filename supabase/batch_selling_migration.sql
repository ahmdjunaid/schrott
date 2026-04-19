-- 1. Update purchase_items table safely
DO $$ 
BEGIN 
  -- Rename price to purchase_price if price exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_items' AND column_name='price') THEN
    ALTER TABLE purchase_items RENAME COLUMN price TO purchase_price;
  END IF;

  -- Add columns to purchase_items if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_items' AND column_name='remaining_qty') THEN
    ALTER TABLE purchase_items ADD COLUMN remaining_qty INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_items' AND column_name='description') THEN
    ALTER TABLE purchase_items ADD COLUMN description TEXT;
  END IF;

  -- 2. Update bill_items table safely
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bill_items' AND column_name='purchase_item_id') THEN
    ALTER TABLE bill_items ADD COLUMN purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bill_items' AND column_name='purchase_price') THEN
    ALTER TABLE bill_items ADD COLUMN purchase_price DECIMAL(12,2);
  END IF;
END $$;

-- Initialize remaining_qty for existing purchases (set it equal to original quantity)
UPDATE purchase_items SET remaining_qty = quantity WHERE remaining_qty = 0 OR remaining_qty IS NULL;

-- 3. Update create_bill_and_update_stock function to support batches
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
  v_wallet_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
BEGIN
  -- 1. Calculate total first from the JSONB array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- 2. Handle Wallet Credit (FIFO/Advance)
  IF p_use_wallet THEN
    SELECT wallet_balance INTO v_wallet_credit FROM customers WHERE id = p_customer_id;
  END IF;
  
  -- Effective paid = Current cash paid + Available credit
  v_effective_paid := p_paid_amount + v_wallet_credit;
  
  -- If we have wallet credit, consume it proportionally
  IF v_wallet_credit > 0 THEN
    -- Update customer wallet: subtract used amount (capped at bill total - what user paid now)
    UPDATE customers 
    SET wallet_balance = GREATEST(0, wallet_balance - (v_total_amount - p_paid_amount))
    WHERE id = p_customer_id;
    
    -- Cap effective paid at total_amount
    v_effective_paid := LEAST(v_total_amount, p_paid_amount + v_wallet_credit);
  END IF;

  -- 3. Determine status based on effective payment
  IF v_effective_paid >= v_total_amount THEN
    v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN
    v_status := 'PARTIAL';
  ELSE
    v_status := 'PENDING';
  END IF;

  -- 4. Insert bill
  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_bill_id;

  -- 5. Record Payment Traces
  -- Manual payment
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill_id, p_paid_amount, p_payment_method);
  END IF;
  
  -- Wallet use trace
  IF v_wallet_credit > 0 THEN
    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill_id, LEAST(v_wallet_credit, v_total_amount - p_paid_amount), 'upi'); 
  END IF;

  -- 6. Insert items and update stock (Both global and batch-specific)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert bill item with purchase info
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

    -- Reduce global product stock
    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- Reduce specific batch stock
    IF (v_item->>'purchase_item_id') IS NOT NULL THEN
      UPDATE purchase_items
      SET remaining_qty = remaining_qty - (v_item->>'quantity')::INTEGER
      WHERE id = (v_item->>'purchase_item_id')::UUID;
    END IF;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Update delete_bill_and_restock to restore batch stock
CREATE OR REPLACE FUNCTION delete_bill_and_restock(p_bill_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Loop through items and restock products
  FOR v_item IN (SELECT product_id, purchase_item_id, quantity FROM bill_items WHERE bill_id = p_bill_id)
  LOOP
    -- Restore global stock
    UPDATE products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id;

    -- Restore batch stock
    IF v_item.purchase_item_id IS NOT NULL THEN
      UPDATE purchase_items
      SET remaining_qty = remaining_qty + v_item.quantity
      WHERE id = v_item.purchase_item_id;
    END IF;
  END LOOP;

  -- Delete the bill
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$ LANGUAGE plpgsql;
