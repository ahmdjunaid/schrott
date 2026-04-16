-- 1. Update purchase_items table
ALTER TABLE purchase_items 
RENAME COLUMN price TO purchase_price;

ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS remaining_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Initialize remaining_qty for existing purchases (set it equal to original quantity)
UPDATE purchase_items SET remaining_qty = quantity WHERE remaining_qty = 0 OR remaining_qty IS NULL;

-- 2. Update bill_items table
ALTER TABLE bill_items 
ADD COLUMN IF NOT EXISTS purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2);

-- 3. Update create_bill_and_update_stock function to support batches
CREATE OR REPLACE FUNCTION create_bill_and_update_stock(
  p_customer_id UUID,
  p_items JSONB,
  p_paid_amount DECIMAL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_total_amount DECIMAL := 0;
  v_status TEXT;
BEGIN
  -- Calculate total first from the JSONB array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::DECIMAL;
  END LOOP;

  -- Determine status
  IF p_paid_amount >= v_total_amount THEN
    v_status := 'PAID';
  ELSIF p_paid_amount > 0 THEN
    v_status := 'PARTIAL';
  ELSE
    v_status := 'PENDING';
  END IF;

  -- Insert bill
  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, p_paid_amount, v_status)
  RETURNING id INTO v_bill_id;

  -- Insert items and update stock (Both global and batch-specific)
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
      (v_item->>'selling_price')::DECIMAL,
      (v_item->>'purchase_price')::DECIMAL,
      (v_item->>'sgst')::DECIMAL,
      (v_item->>'cgst')::DECIMAL,
      (v_item->>'total')::DECIMAL
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

  -- Insert payment if paid_amount > 0
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill_id, p_paid_amount, p_payment_method);
  END IF;

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
