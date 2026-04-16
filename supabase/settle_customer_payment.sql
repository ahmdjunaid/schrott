-- Function to settle customer payments across multiple bills in FIFO order
CREATE OR REPLACE FUNCTION settle_customer_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_remaining_amount NUMERIC := p_amount;
  v_bill_record RECORD;
  v_settle_amount NUMERIC;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Settlement amount must be greater than zero';
  END IF;

  -- Iterate through bills with outstanding balances in FIFO order (oldest first)
  FOR v_bill_record IN 
    SELECT id, total_amount, paid_amount, balance_amount 
    FROM bills 
    WHERE customer_id = p_customer_id AND balance_amount > 0 
    ORDER BY created_at ASC
  LOOP
    -- Stop if we've exhausted the payment amount
    EXIT WHEN v_remaining_amount <= 0;

    -- Calculate how much we can settle for this particular bill
    v_settle_amount := LEAST(v_bill_record.balance_amount, v_remaining_amount);

    -- record the payment for this bill
    INSERT INTO payments (bill_id, amount, payment_method)
    VALUES (v_bill_record.id, v_settle_amount, p_method);

    -- update the bill status and paid_amount
    -- balance_amount is GENERATED ALWAYS so it will update automatically
    UPDATE bills 
    SET 
      paid_amount = paid_amount + v_settle_amount,
      status = CASE 
        WHEN (paid_amount + v_settle_amount) >= total_amount THEN 'PAID'
        ELSE 'PARTIAL'
      END
    WHERE id = v_bill_record.id;

    -- update the remaining payment amount
    v_remaining_amount := v_remaining_amount - v_settle_amount;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
