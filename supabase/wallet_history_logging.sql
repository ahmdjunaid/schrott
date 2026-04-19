-- Create wallet history tables for full audit tracking
CREATE TABLE IF NOT EXISTS customer_wallet_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'DEPOSIT' (adding money), 'USE' (paying bills with it)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS supplier_wallet_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'DEPOSIT', 'USE'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Update Supplier Settlement RPC to log the deposits
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
    SELECT id, balance_amount 
    FROM purchases 
    WHERE supplier_id = p_supplier_id 
      AND status != 'PAID' 
      AND balance_amount > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_to_apply := LEAST(v_remaining_payment, v_purchase.balance_amount);

    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase.id, v_to_apply, p_method);

    UPDATE purchases 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_purchase.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;

  -- Log Deposit if there's still money left
  IF v_remaining_payment > 0 THEN
    UPDATE suppliers 
    SET wallet_balance = wallet_balance + v_remaining_payment 
    WHERE id = p_supplier_id;

    INSERT INTO supplier_wallet_history (supplier_id, amount, type, description)
    VALUES (p_supplier_id, v_remaining_payment, 'DEPOSIT', 'Excess payment from settlement (' || p_method || ')');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update Customer Settlement RPC to log the deposits
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
  FOR v_bill IN 
    SELECT id, balance_amount 
    FROM bills 
    WHERE customer_id = p_customer_id 
      AND status != 'PAID' 
      AND balance_amount > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_to_apply := LEAST(v_remaining_payment, v_bill.balance_amount);

    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill.id, v_to_apply, p_method);

    UPDATE bills 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_bill.id;

    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;

  -- Log Deposit
  IF v_remaining_payment > 0 THEN
    UPDATE customers 
    SET wallet_balance = wallet_balance + v_remaining_payment 
    WHERE id = p_customer_id;

    INSERT INTO customer_wallet_history (customer_id, amount, type, description)
    VALUES (p_customer_id, v_remaining_payment, 'DEPOSIT', 'Excess payment from settlement (' || p_method || ')');
  END IF;
END;
$$ LANGUAGE plpgsql;
