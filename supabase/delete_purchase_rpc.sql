-- Function to safely delete a purchase and revert stock
CREATE OR REPLACE FUNCTION delete_purchase_and_revert_stock(p_purchase_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- 1. Check if any items in this purchase have been partially sold
  -- If remaining_qty is less than original quantity, it means some units are gone.
  IF EXISTS (
    SELECT 1 FROM purchase_items 
    WHERE purchase_id = p_purchase_id 
    AND remaining_qty < quantity
  ) THEN
    RAISE EXCEPTION 'Cannot delete purchase: Some items from this batch have already been sold.';
  END IF;

  -- 2. Restock the products (Decrease stock because we are removing the purchase)
  FOR v_item IN (SELECT product_id, quantity FROM purchase_items WHERE purchase_id = p_purchase_id)
  LOOP
    UPDATE products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- 3. Delete the purchase (Cascade will remove purchase_items and supplier_payments)
  DELETE FROM purchases WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql;
