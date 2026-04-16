-- Function to safely update a single item quantity from a purchase and update totals
CREATE OR REPLACE FUNCTION update_purchase_item_qty(p_purchase_item_id UUID, p_new_qty INTEGER)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_diff INTEGER;
  v_new_total DECIMAL;
BEGIN
  -- 1. Get current record
  SELECT * INTO v_item FROM purchase_items WHERE id = p_purchase_item_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  -- 2. Calculate difference
  v_diff := p_new_qty - v_item.quantity;
  
  -- 3. Safety check: Are we reducing below what was already sold?
  -- Sold units = quantity - remaining_qty
  IF p_new_qty < (v_item.quantity - v_item.remaining_qty) THEN
    RAISE EXCEPTION 'Cannot reduce quantity below the amount already sold (% units).', (v_item.quantity - v_item.remaining_qty);
  END IF;

  -- 4. Update Product global stock
  UPDATE products
  SET stock = stock + v_diff
  WHERE id = v_item.product_id;

  -- 5. Recalculate item total and update parent purchase total
  v_new_total := p_new_qty * v_item.purchase_price;
  
  UPDATE purchases
  SET total_amount = total_amount + (v_new_total - v_item.total)
  WHERE id = v_item.purchase_id;

  -- 6. Update the item itself
  UPDATE purchase_items
  SET quantity = p_new_qty,
      remaining_qty = remaining_qty + v_diff,
      total = v_new_total
  WHERE id = p_purchase_item_id;
END;
$$ LANGUAGE plpgsql;
