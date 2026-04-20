import { supabase } from './supabaseClient';
import { Customer } from '../types';

export const customerService = {
  getAll: async (): Promise<(Customer & { balance: number })[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        bills(total_amount),
        payments(amount),
        sales_returns(total_amount)
      `)
      .eq('is_active', true)
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((c: any) => {
      const totalBilled = c.bills?.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount), 0) || 0;
      const totalPaid = c.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
      const totalReturned = c.sales_returns?.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount), 0) || 0;
      return {
        ...c,
        balance: totalBilled - totalPaid - totalReturned
      };
    });
  },

  getById: async (id: string): Promise<Customer & { balance: number }> => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        bills(total_amount),
        payments(amount),
        sales_returns(total_amount)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    const totalBilled = data.bills?.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount), 0) || 0;
    const totalPaid = data.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
    const totalReturned = data.sales_returns?.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount), 0) || 0;

    return {
      ...data,
      balance: totalBilled - totalPaid - totalReturned
    };
  },

  getTransactions: async (id: string, startDate?: string) => {
    let billsQuery = supabase.from('bills').select('*').eq('customer_id', id);
    let paymentsQuery = supabase.from('payments').select('*').eq('customer_id', id);
    let returnsQuery = supabase.from('sales_returns').select('*').eq('customer_id', id);
    
    if (startDate) {
      billsQuery = billsQuery.gte('created_at', startDate);
      paymentsQuery = paymentsQuery.gte('created_at', startDate);
      returnsQuery = returnsQuery.gte('created_at', startDate);
    }

    const [billsResp, paymentsResp, returnsResp] = await Promise.all([
      billsQuery, 
      paymentsQuery,
      returnsQuery
    ]);

    if (billsResp.error) throw billsResp.error;
    if (paymentsResp.error) throw paymentsResp.error;
    if (returnsResp.error) throw returnsResp.error;

    const allPayments = paymentsResp.data;
    const typePriority: { [key: string]: number } = { 'INVOICE': 0, 'PAYMENT': 1, 'RETURN': 2, 'REFUND': 3 };

    const merged = [
      ...billsResp.data.map(b => ({ ...b, type: 'INVOICE' })),
      ...allPayments.map(p => ({ ...p, type: p.note === 'REFUND' ? 'REFUND' : 'PAYMENT' })),
      ...returnsResp.data.map(r => ({ ...r, type: 'RETURN' })),
    ].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      
      // If within 10 seconds, they are likely the same logical event (e.g. Sales Return + Refund)
      if (Math.abs(timeA - timeB) < 10000) { 
        return typePriority[a.type] - typePriority[b.type];
      }
      return timeA - timeB; // Sort ascending by time initially
    });
    
    return merged;
  },

  create: async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...customer, is_active: true }])
      .select()
      .single();
    if (error) throw error;
    return data as Customer;
  },

  update: async (id: string, customer: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .update(customer)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Customer;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  settlePayment: async (customerId: string, amount: number, method: string): Promise<void> => {
    const { error } = await supabase.rpc('settle_customer_payment', {
      p_customer_id: customerId,
      p_amount: amount,
      p_method: method
    });
    if (error) throw error;
  },

  processReturn: async (customerId: string, items: any[], refundAmount: number = 0, refundMethod: string | null = null, description?: string): Promise<string> => {
    const { data, error } = await supabase.rpc('process_sales_return', {
      p_customer_id: customerId,
      p_items: items,
      p_refund_amount: refundAmount,
      p_refund_method: refundMethod,
      p_description: description
    });
    if (error) throw error;
    return data;
  }
};
