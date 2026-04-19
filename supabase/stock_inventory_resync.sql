-- 1. Ensure purchase_items.purchase_id is nullable (already is, but explicit for clarity)
ALTER TABLE purchase_items ALTER COLUMN purchase_id DROP NOT NULL;

-- 2. Trigger function to create a batch for Initial Stock on new products
CREATE OR REPLACE FUNCTION handle_initial_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- If product is created with stock, create a corresponding batch
  IF NEW.stock > 0 THEN
    INSERT INTO purchase_items (
      product_id, 
      quantity, 
      remaining_qty, 
      purchase_price, 
      description,
      total
    ) VALUES (
      NEW.id,
      NEW.stock,
      NEW.stock,
      COALESCE(NEW.selling_price * 0.7, 0), -- Assume 70% cost if unknown, or 0
      'INITIAL STOCK (SYSTEM)',
      0
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_initial_stock_batch ON products;
CREATE TRIGGER trigger_initial_stock_batch
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION handle_initial_product_stock();

-- 3. Function to force resync stock column from batches
CREATE OR REPLACE FUNCTION sync_product_stock_from_batches()
RETURNS VOID AS $$
BEGIN
  -- First, create missing batches for products that have stock but NO batches
  INSERT INTO purchase_items (product_id, quantity, remaining_qty, purchase_price, description, total)
  SELECT p.id, p.stock, p.stock, 0, 'STOCK RECOVERY BATCH', 0
  FROM products p
  LEFT JOIN purchase_items b ON p.id = b.product_id
  WHERE p.stock > 0 AND b.id IS NULL;

  -- Second, update products.stock to match the SUM of remaining_qty from all batches
  UPDATE products p
  SET stock = COALESCE((
    SELECT SUM(remaining_qty)
    FROM purchase_items
    WHERE product_id = p.id
  ), 0);
END;
$$ LANGUAGE plpgsql;

-- 4. Initial Run: Fix everything right now
SELECT sync_product_stock_from_batches();
