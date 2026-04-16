-- RPC for settling multiple purchases at once for a supplier (FIFO)
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
  -- 1. Find all purchases for the supplier that have a balance, ordered by date (oldest first)
  FOR v_purchase IN 
    SELECT id, balance_amount 
    FROM purchases 
    WHERE supplier_id = p_supplier_id 
      AND status != 'PAID' 
      AND balance_amount > 0
    ORDER BY created_at ASC
  LOOP
    -- Stop if we run out of payment amount
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    -- Calculate how much of the remaining payment we can apply to this purchase
    v_to_apply := LEAST(v_remaining_payment, v_purchase.balance_amount);

    -- record_purchase_payment logic integrated directly or called
    -- For simplicity and atomicity, we'll perform the updates here
    
    -- a. Record into supplier_payments
    INSERT INTO supplier_payments (purchase_id, amount, payment_method)
    VALUES (v_purchase.id, v_to_apply, p_method);

    -- b. Update the specific purchase record
    UPDATE purchases 
    SET paid_amount = paid_amount + v_to_apply,
        status = CASE 
                   WHEN (paid_amount + v_to_apply) >= total_amount THEN 'PAID'
                   ELSE 'PARTIAL'
                 END
    WHERE id = v_purchase.id;

    -- c. Reduce the remaining payment pool
    v_remaining_payment := v_remaining_payment - v_to_apply;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
