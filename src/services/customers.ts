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
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((c: any) => ({
      ...c,
      balance: c.bills?.reduce((sum: number, b: any) => sum + parseFloat(b.balance_amount), 0) || 0
    }));
  },

  getTransactions: async (id: string) => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .insert([customer])
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
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
