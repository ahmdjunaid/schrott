-- Add GST columns to purchase_items
ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS sgst DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst DECIMAL(12,2) DEFAULT 0;

-- Update Create Purchase RPC with GST support
CREATE OR REPLACE FUNCTION create_purchase_and_update_stock(
  p_supplier_id UUID,
  p_items JSONB,
  p_paid_amount DECIMAL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_total_amount DECIMAL := 0;
  v_status TEXT;
BEGIN
  -- Calculate total from all items
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

  -- Insert purchase
  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, p_paid_amount, v_status)
  RETURNING id INTO v_purchase_id;

  -- Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO purchase_items (
      purchase_id, 
      product_id, 
      quantity, 
      remaining_qty, 
      purchase_price, 
      sgst,
      cgst,
      total, 
      description
    )
    VALUES (
      v_purchase_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'purchase_price')::DECIMAL,
      (v_item->>'sgst')::DECIMAL,
      (v_item->>'cgst')::DECIMAL,
      (v_item->>'total')::DECIMAL,
      (v_item->>'description')::TEXT
    );

    UPDATE products
    SET stock = stock + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  -- Insert payment if paid_amount > 0
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase_id, p_paid_amount, p_payment_method);
  END IF;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- Update the Quantity Adjustment RPC to handle GST in recalculation
CREATE OR REPLACE FUNCTION update_purchase_item_qty(p_purchase_item_id UUID, p_new_qty INTEGER)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_diff INTEGER;
  v_new_base_total DECIMAL;
  v_new_total DECIMAL;
  v_sgst_amount DECIMAL;
  v_cgst_amount DECIMAL;
BEGIN
  -- Get current record
  SELECT * INTO v_item FROM purchase_items WHERE id = p_purchase_item_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  v_diff := p_new_qty - v_item.quantity;
  
  -- Safety check
  IF p_new_qty < (v_item.quantity - v_item.remaining_qty) THEN
    RAISE EXCEPTION 'Cannot reduce quantity below the amount already sold.';
  END IF;

  -- Update Product global stock
  UPDATE products SET stock = stock + v_diff WHERE id = v_item.product_id;

  -- Recalculate item total including stored GST
  -- Note: v_item.sgst and v_item.cgst are percentages (stored as % here based on UI plan)
  -- Or are they amounts? Most common UI entry is % but storage could be amount.
  -- In my plan, I said "Add SGST (%) and CGST (%) inputs".
  -- I will store percentages to make quantity scaling easy.
  
  v_new_base_total := p_new_qty * v_item.purchase_price;
  v_sgst_amount := (v_new_base_total * v_item.sgst / 100);
  v_cgst_amount := (v_new_base_total * v_item.cgst / 100);
  v_new_total := v_new_base_total + v_sgst_amount + v_cgst_amount;
  
  UPDATE purchases
  SET total_amount = total_amount + (v_new_total - v_item.total)
  WHERE id = v_item.purchase_id;

  UPDATE purchase_items
  SET quantity = p_new_qty,
      remaining_qty = remaining_qty + v_diff,
      total = v_new_total
  WHERE id = p_purchase_item_id;
END;
$$ LANGUAGE plpgsql;
