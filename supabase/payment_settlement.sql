CREATE OR REPLACE FUNCTION record_purchase_payment(
  p_purchase_id UUID,
  p_amount NUMERIC,
  p_method TEXT
) RETURNS VOID AS $$
DECLARE
  v_new_paid_amount NUMERIC;
  v_total_amount NUMERIC;
  v_status TEXT;
BEGIN
  -- Insert the payment record
  INSERT INTO supplier_payments (purchase_id, amount, payment_method)
  VALUES (p_purchase_id, p_amount, p_method);

  -- Update the parent purchase record's paid_amount
  UPDATE purchases 
  SET paid_amount = paid_amount + p_amount
  WHERE id = p_purchase_id
  RETURNING paid_amount, total_amount INTO v_new_paid_amount, v_total_amount;

  -- Update status based on total vs paid
  IF v_new_paid_amount >= v_total_amount THEN
    v_status := 'PAID';
  ELSIF v_new_paid_amount > 0 THEN
    v_status := 'PARTIAL';
  ELSE
    v_status := 'PENDING';
  END IF;

  UPDATE purchases SET status = v_status WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql;
