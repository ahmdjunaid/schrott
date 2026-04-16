-- 1. Customers: Add is_active column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
UPDATE customers SET is_active = true WHERE is_active IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active) WHERE is_active = true;

-- 2. Products: Ensure default and index
ALTER TABLE products ALTER COLUMN is_active SET DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;

-- 3. Categories: Ensure default and index
ALTER TABLE categories ALTER COLUMN is_blocked SET DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_categories_unblocked ON categories(is_blocked) WHERE is_blocked = false;

-- 4. Brands: Ensure default and index
ALTER TABLE brands ALTER COLUMN is_blocked SET DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_brands_unblocked ON brands(is_blocked) WHERE is_blocked = false;
