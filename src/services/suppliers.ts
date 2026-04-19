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
      .eq('is_active', true)
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((s: any) => ({
      ...s,
      balance: s.purchases?.reduce((sum: number, p: any) => sum + parseFloat(p.balance_amount), 0) || 0,
      wallet_balance: s.wallet_balance || 0
    }));
  },

  getById: async (id: string): Promise<Supplier & { balance: number }> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        purchases(balance_amount)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      balance: data.purchases?.reduce((sum: number, p: any) => sum + parseFloat(p.balance_amount), 0) || 0,
      wallet_balance: data.wallet_balance || 0
    };
  },

  getTransactions: async (id: string, startDate?: string) => {
    let purchasesQuery = supabase.from('purchases').select('*').eq('supplier_id', id);
    let walletQuery = supabase.from('supplier_wallet_history').select('*').eq('supplier_id', id);
    
    if (startDate) {
      purchasesQuery = purchasesQuery.gte('created_at', startDate);
      walletQuery = walletQuery.gte('created_at', startDate);
    }

    const [purchasesResp, walletResp] = await Promise.all([purchasesQuery, walletQuery]);

    if (purchasesResp.error) throw purchasesResp.error;
    if (walletResp.error) throw walletResp.error;

    // Fetch payments linked to these purchases
    const purchaseIds = purchasesResp.data.map(p => p.id);
    let paymentsQuery = supabase.from('supplier_payments').select('*').in('purchase_id', purchaseIds);
    if (startDate) paymentsQuery = paymentsQuery.gte('created_at', startDate);
    
    const { data: payments, error: payError } = await paymentsQuery;
    if (payError) throw payError;

    const typePriority: { [key: string]: number } = { 'WALLET': 0, 'PAYMENT': 1, 'INVOICE': 2 };

    const merged = [
      ...purchasesResp.data.map(p => ({ ...p, type: 'INVOICE' })),
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

  create: async (supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...supplier, is_active: true }])
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
      .update({ is_active: false })
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
