-- ==========================================
-- ENHANCED FINANCIAL INTELLIGENCE RPC
-- ==========================================

CREATE OR REPLACE FUNCTION get_financial_reports(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_gross_purchases NUMERIC;
  v_purchase_returns NUMERIC;
  v_net_purchases NUMERIC;
  v_total_supplier_paid NUMERIC;
  
  v_gross_sales NUMERIC;
  v_sales_returns NUMERIC;
  v_net_sales NUMERIC;
  v_total_customer_paid NUMERIC;
  
  v_gross_profit NUMERIC;
  v_return_profit_offset NUMERIC;
  v_net_profit NUMERIC;
  
  v_damaged_cost NUMERIC;
  
  v_start TIMESTAMP WITH TIME ZONE := COALESCE(p_start_date, '1900-01-01'::TIMESTAMP WITH TIME ZONE);
  v_end TIMESTAMP WITH TIME ZONE := COALESCE(p_end_date, '2100-01-01'::TIMESTAMP WITH TIME ZONE);
BEGIN
  -- 1. PURCHASE ANALYTICS
  SELECT COALESCE(SUM(total_amount), 0) INTO v_gross_purchases FROM purchases 
  WHERE created_at BETWEEN v_start AND v_end;
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_purchase_returns FROM purchase_returns 
  WHERE created_at BETWEEN v_start AND v_end;
  
  v_net_purchases := v_gross_purchases - v_purchase_returns;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_supplier_paid FROM supplier_payments 
  WHERE created_at BETWEEN v_start AND v_end;

  -- 2. SALES ANALYTICS
  SELECT COALESCE(SUM(total_amount), 0) INTO v_gross_sales FROM bills 
  WHERE created_at BETWEEN v_start AND v_end;
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_sales_returns FROM sales_returns 
  WHERE created_at BETWEEN v_start AND v_end;
  
  v_net_sales := v_gross_sales - v_sales_returns;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_customer_paid FROM payments 
  WHERE created_at BETWEEN v_start AND v_end;

  -- 3. PROFIT ANALYTICS
  -- Gross Profit from all bills in period
  SELECT COALESCE(SUM(bi.total - (bi.quantity * pi.purchase_price)), 0)
  INTO v_gross_profit
  FROM bill_items bi
  JOIN bills b ON bi.bill_id = b.id
  JOIN purchase_items pi ON bi.purchase_item_id = pi.id
  WHERE b.created_at BETWEEN v_start AND v_end;

  -- Profit offset from returns in period (Subtracting profit we "un-made")
  -- Note: We track profit lost by comparing return price with original batch cost
  SELECT COALESCE(SUM(sri.total - (sri.quantity * pi.purchase_price)), 0)
  INTO v_return_profit_offset
  FROM sales_return_items sri
  JOIN sales_returns sr ON sri.return_id = sr.id
  JOIN bill_items bi ON sri.bill_item_id = bi.id
  JOIN purchase_items pi ON bi.purchase_item_id = pi.id
  WHERE sr.created_at BETWEEN v_start AND v_end;
  
  v_net_profit := v_gross_profit - v_return_profit_offset;

  -- 4. DAMAGE ANALYTICS
  SELECT COALESCE(SUM(ds.quantity * pi.purchase_price), 0) INTO v_damaged_cost 
  FROM damaged_stock ds
  JOIN purchase_items pi ON ds.batch_id = pi.id
  WHERE ds.created_at BETWEEN v_start AND v_end;

  RETURN jsonb_build_object(
    'gross_purchases', v_gross_purchases,
    'purchase_returns', v_purchase_returns,
    'net_purchases', v_net_purchases,
    'supplier_paid', v_total_supplier_paid,
    'supplier_balance', v_net_purchases - v_total_supplier_paid,
    
    'gross_sales', v_gross_sales,
    'sales_returns', v_sales_returns,
    'net_sales', v_net_sales,
    'customer_paid', v_total_customer_paid,
    'customer_balance', v_net_sales - v_total_customer_paid,
    
    'profit', v_net_profit,
    'damaged_cost', v_damaged_cost
  );
END;
$$ LANGUAGE plpgsql;
