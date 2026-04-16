-- Update the Purchase RPC to use renamed columns and support batch details
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
  -- Calculate total
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

  -- Insert items and INCREASE stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO purchase_items (
      purchase_id, 
      product_id, 
      quantity, 
      remaining_qty, 
      purchase_price, 
      tax, 
      total, 
      description
    )
    VALUES (
      v_purchase_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'quantity')::INTEGER, -- Initially remaining_qty = full quantity
      (v_item->>'purchase_price')::DECIMAL,
      (v_item->>'tax')::DECIMAL,
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
