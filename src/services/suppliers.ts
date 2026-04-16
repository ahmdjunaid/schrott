import { supabase } from './supabaseClient';
import { Supplier } from '../types';

export const supplierService = {
  getAll: async (): Promise<(Supplier & { balance: number })[]> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        purchases(balance_amount)
      `)
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((s: any) => ({
      ...s,
      balance: s.purchases?.reduce((sum: number, p: any) => sum + parseFloat(p.balance_amount), 0) || 0,
      wallet_balance: s.wallet_balance || 0
    }));
  },

  getTransactions: async (id: string) => {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();
    if (error) throw error;
    return data as Supplier;
  },

  update: async (id: string, supplier: Partial<Supplier>): Promise<Supplier> => {
    const { data, error } = await supabase
      .from('suppliers')
      .update(supplier)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Supplier;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  settleBalance: async (supplierId: string, amount: number, method: string): Promise<void> => {
    const { error } = await supabase.rpc('settle_supplier_balance', {
      p_supplier_id: supplierId,
      p_amount: amount,
      p_method: method
    });
    if (error) throw error;
  }
};
