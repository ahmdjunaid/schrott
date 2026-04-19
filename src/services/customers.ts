import { supabase } from './supabaseClient';
import { Customer } from '../types';

export const customerService = {
  getAll: async (): Promise<(Customer & { balance: number })[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        bills(balance_amount)
      `)
      .eq('is_active', true)
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((c: any) => ({
      ...c,
      balance: c.bills?.reduce((sum: number, b: any) => sum + parseFloat(b.balance_amount), 0) || 0,
      wallet_balance: c.wallet_balance || 0
    }));
  },

  getById: async (id: string): Promise<Customer & { balance: number }> => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        bills(balance_amount)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      balance: data.bills?.reduce((sum: number, b: any) => sum + parseFloat(b.balance_amount), 0) || 0,
      wallet_balance: data.wallet_balance || 0
    };
  },

  getTransactions: async (id: string, startDate?: string) => {
    let billsQuery = supabase.from('bills').select('*').eq('customer_id', id);
    let walletQuery = supabase.from('customer_wallet_history').select('*').eq('customer_id', id);
    
    if (startDate) {
      billsQuery = billsQuery.gte('created_at', startDate);
      walletQuery = walletQuery.gte('created_at', startDate);
    }

    const [billsResp, walletResp] = await Promise.all([billsQuery, walletQuery]);

    if (billsResp.error) throw billsResp.error;
    if (walletResp.error) throw walletResp.error;

    // Fetch payments linked to this customer's bills
    const customerBillIds = billsResp.data.map(b => b.id);
    let paymentsQuery = supabase.from('payments').select('*').in('bill_id', customerBillIds);
    if (startDate) paymentsQuery = paymentsQuery.gte('created_at', startDate);
    
    const { data: payments, error: pError } = await paymentsQuery;
    if (pError) throw pError;

    const typePriority: { [key: string]: number } = { 'WALLET': 0, 'PAYMENT': 1, 'INVOICE': 2 };

    const merged = [
      ...billsResp.data.map(b => ({ ...b, type: 'INVOICE' })),
      ...payments.map(p => ({ ...p, type: 'PAYMENT' })),
      ...walletResp.data.map(w => ({ ...w, type: 'WALLET' }))
    ].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA === timeB) {
        return typePriority[a.type] - typePriority[b.type];
      }
      return timeB - timeA;
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
  }
};
