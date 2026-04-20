-- 1. Remove Wallet Tables and Constraints
DROP TABLE IF EXISTS customer_wallet_history CASCADE;
DROP TABLE IF EXISTS supplier_wallet_history CASCADE;

-- 2. Remove Wallet Columns from Customers and Suppliers
ALTER TABLE customers DROP COLUMN IF EXISTS wallet_balance;
ALTER TABLE suppliers DROP COLUMN IF EXISTS wallet_balance;

-- 3. Update Payment Tables to link directly to entities (for Unallocated Payments tracking)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;

-- Backfill existing payment entity IDs from their bills/purchases
UPDATE payments SET customer_id = (SELECT customer_id FROM bills WHERE bills.id = payments.bill_id);
UPDATE supplier_payments SET supplier_id = (SELECT supplier_id FROM purchases WHERE purchases.id = supplier_payments.purchase_id);

-- Make bill/purchase links nullable
ALTER TABLE payments ALTER COLUMN bill_id DROP NOT NULL;
ALTER TABLE supplier_payments ALTER COLUMN purchase_id DROP NOT NULL;

-- 4. Refactor Customer Settlement RPC
CREATE OR REPLACE FUNCTION settle_customer_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_payment NUMERIC := p_amount;
  v_bill RECORD;
  v_to_apply NUMERIC;
BEGIN
  -- Cycle through unpaid bills oldest first
  FOR v_bill IN 
    SELECT id, total_amount - paid_amount as pending
    FROM bills 
    WHERE customer_id = p_customer_id 
      AND status != 'PAID' 
      AND (total_amount - paid_amount) > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_to_apply := LEAST(v_remaining_payment, v_bill.pending);

    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (v_bill.id, p_customer_id, v_to_apply, p_method);

    UPDATE bills 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_bill.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;

  -- Store excess payment as an unallocated credit (Advance)
  IF v_remaining_payment > 0 THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (NULL, p_customer_id, v_remaining_payment, p_method);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Refactor Supplier Settlement RPC
CREATE OR REPLACE FUNCTION settle_supplier_balance(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_payment NUMERIC := p_amount;
  v_purchase RECORD;
  v_to_apply NUMERIC;
BEGIN
  -- Cycle through unpaid purchases oldest first
  FOR v_purchase IN 
    SELECT id, total_amount - paid_amount as pending
    FROM purchases 
    WHERE supplier_id = p_supplier_id 
      AND status != 'PAID' 
      AND (total_amount - paid_amount) > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_to_apply := LEAST(v_remaining_payment, v_purchase.pending);

    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (v_purchase.id, p_supplier_id, v_to_apply, p_method);

    UPDATE purchases 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_purchase.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;

  -- Store excess payment as unallocated credit (Advance)
  IF v_remaining_payment > 0 THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (NULL, p_supplier_id, v_remaining_payment, p_method);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Refactor Atomic Bill Creation (Auto-apply credits)
CREATE OR REPLACE FUNCTION create_bill_and_update_stock(
  p_customer_id UUID,
  p_items JSONB,
  p_paid_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_status TEXT;
  v_advance_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
  v_advance_to_use NUMERIC;
BEGIN
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Calculate existing unallocated credits (Advances)
  -- Sum all payments for this customer that are NOT linked to a bill
  -- MINUS all bill totals MINUS all linked payments? No, simpler:
  -- We just look for payments with NULL bill_id.
  SELECT COALESCE(SUM(amount), 0) INTO v_advance_credit 
  FROM payments 
  WHERE customer_id = p_customer_id AND bill_id IS NULL;
  
  v_advance_to_use := LEAST(v_advance_credit, v_total_amount - p_paid_amount);
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  ELSE v_status := 'PENDING';
  END IF;

  INSERT INTO bills (customer_id, total_amount, paid_amount, status)
  VALUES (p_customer_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_bill_id;

  -- Consume Advance Credit if used (Create a transfer payment)
  IF v_advance_to_use > 0 THEN
    -- Subtract from unallocated (actually we just create a negative unallocated and a positive allocated)
    -- OR simpler: create the payment record for this bill
    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (v_bill_id, p_customer_id, v_advance_to_use, 'credit_adjustment');
    
    -- And we need to "reduce" the unallocated. 
    -- The best way is to insert a NEGATIVE unallocated payment to balance it out.
    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (NULL, p_customer_id, -v_advance_to_use, 'credit_consumption');
  END IF;

  -- Record manual payment
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO payments (bill_id, customer_id, amount, payment_method)
    VALUES (v_bill_id, p_customer_id, p_paid_amount, p_payment_method);
  END IF;

  -- Update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO bill_items (bill_id, product_id, quantity, price, sgst, cgst, total)
    VALUES (v_bill_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC);
    UPDATE products SET stock = stock - (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Refactor Atomic Purchase Creation (Auto-apply credits)
CREATE OR REPLACE FUNCTION create_purchase_and_update_stock(
  p_supplier_id UUID,
  p_items JSONB,
  p_paid_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_status TEXT;
  v_advance_credit NUMERIC := 0;
  v_effective_paid NUMERIC;
  v_advance_to_use NUMERIC;
BEGIN
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Calculate existing unallocated credits (Advances) for this supplier
  SELECT COALESCE(SUM(amount), 0) INTO v_advance_credit 
  FROM supplier_payments 
  WHERE supplier_id = p_supplier_id AND purchase_id IS NULL;
  
  v_advance_to_use := LEAST(v_advance_credit, v_total_amount - p_paid_amount);
  v_effective_paid := p_paid_amount + v_advance_to_use;
  
  IF v_effective_paid >= v_total_amount THEN v_status := 'PAID';
  ELSIF v_effective_paid > 0 THEN v_status := 'PARTIAL';
  ELSE v_status := 'PENDING';
  END IF;

  INSERT INTO purchases (supplier_id, total_amount, paid_amount, status)
  VALUES (p_supplier_id, v_total_amount, v_effective_paid, v_status)
  RETURNING id INTO v_purchase_id;

  -- Consume Advance Credit
  IF v_advance_to_use > 0 THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (v_purchase_id, p_supplier_id, v_advance_to_use, 'credit_adjustment');
    
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (NULL, p_supplier_id, -v_advance_to_use, 'credit_consumption');
  END IF;

  -- Record manual payment
  IF p_paid_amount > 0 AND p_payment_method IS NOT NULL THEN
    INSERT INTO supplier_payments (purchase_id, supplier_id, amount, payment_method)
    VALUES (v_purchase_id, p_supplier_id, p_paid_amount, p_payment_method);
  END IF;

  -- Update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_items (purchase_id, product_id, quantity, purchase_price, sgst, cgst, total)
    VALUES (v_purchase_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'purchase_price')::NUMERIC, (v_item->>'sgst')::NUMERIC, (v_item->>'cgst')::NUMERIC, (v_item->>'total')::NUMERIC);
    UPDATE products SET stock = stock + (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;
