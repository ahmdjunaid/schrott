-- Categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Brands table
CREATE TABLE brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  sgst DECIMAL(5,2) DEFAULT 0,
  cgst DECIMAL(5,2) DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  stock INTEGER DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customers table
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  shop_name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bills table
CREATE TABLE bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PAID', 'PARTIAL', 'PENDING')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bill items table
CREATE TABLE bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(12,2) NOT NULL,
  sgst DECIMAL(12,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'upi', 'card')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to handle atomic billing and stock reduction
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
  v_item_total DECIMAL;
  v_status TEXT;
BEGIN
  -- Insert bill first with 0 total (we'll update it later or calculate first)
  -- Actually, let's calculate total first from the JSONB array
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

  -- Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert bill item
    INSERT INTO bill_items (bill_id, product_id, quantity, price, sgst, cgst, total)
    VALUES (
      v_bill_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::DECIMAL,
      (v_item->>'sgst')::DECIMAL,
      (v_item->>'cgst')::DECIMAL,
      (v_item->>'total')::DECIMAL
    );

    -- Reduce stock
    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  -- Insert payment if paid_amount > 0
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill_id, p_paid_amount, p_payment_method);
  END IF;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Optional but recommended)
-- For simplicity in this demo, let's enable RLS and allow all authenticated users
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Creation (Allow all for authenticated users)
-- Use a loop or separate commands
-- Function to delete bill and restock items
CREATE OR REPLACE FUNCTION delete_bill_and_restock(p_bill_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- 1. Loop through items and restock products
  FOR v_item IN (SELECT product_id, quantity FROM bill_items WHERE bill_id = p_bill_id)
  LOOP
    UPDATE products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- 2. Delete the bill (cascades will handle bill_items and payments)
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$ LANGUAGE plpgsql;

CREATE POLICY "Allow all to auth users" ON categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON brands FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON bills FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON bill_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all to auth users" ON payments FOR ALL TO authenticated USING (true);
