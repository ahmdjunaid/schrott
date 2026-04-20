import { supabase } from './supabaseClient';
import { Supplier } from '../types';

export const supplierService = {
  getAll: async (): Promise<(Supplier & { balance: number })[]> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        purchases(total_amount),
        supplier_payments(amount),
        purchase_returns(total_amount)
      `)
      .eq('is_active', true)
      .order('shop_name', { ascending: true });
    
    if (error) throw error;
    
    return data.map((s: any) => {
      const totalPurchased = s.purchases?.reduce((sum: number, p: any) => sum + parseFloat(p.total_amount), 0) || 0;
      const totalPaid = s.supplier_payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
      const totalReturned = s.purchase_returns?.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount), 0) || 0;
      return {
        ...s,
        balance: totalPurchased - totalPaid - totalReturned,
        wallet_balance: 0
      };
    });
  },

  getById: async (id: string): Promise<Supplier & { balance: number }> => {
    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        purchases(total_amount),
        supplier_payments(amount),
        purchase_returns(total_amount)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    const totalPurchased = data.purchases?.reduce((sum: number, p: any) => sum + parseFloat(p.total_amount), 0) || 0;
    const totalPaid = data.supplier_payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
    const totalReturned = data.purchase_returns?.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount), 0) || 0;

    return {
      ...data,
      balance: totalPurchased - totalPaid - totalReturned,
      wallet_balance: 0
    };
  },

  getTransactions: async (id: string, startDate?: string) => {
    let purchasesQuery = supabase.from('purchases').select('*').eq('supplier_id', id);
    let paymentsQuery = supabase.from('supplier_payments').select('*').eq('supplier_id', id);
    let returnsQuery = supabase.from('purchase_returns').select('*').eq('supplier_id', id);
    
    if (startDate) {
      purchasesQuery = purchasesQuery.gte('created_at', startDate);
      paymentsQuery = paymentsQuery.gte('created_at', startDate);
      returnsQuery = returnsQuery.gte('created_at', startDate);
    }

    const [purchasesResp, paymentsResp, returnsResp] = await Promise.all([
      purchasesQuery, 
      paymentsQuery,
      returnsQuery
    ]);

    if (purchasesResp.error) throw purchasesResp.error;
    if (paymentsResp.error) throw paymentsResp.error;
    if (returnsResp.error) throw returnsResp.error;

    const allPayments = paymentsResp.data;
    const typePriority: { [key: string]: number } = { 'INVOICE': 0, 'PAYMENT': 1, 'RETURN': 2, 'REFUND': 3 };

    const merged = [
      ...purchasesResp.data.map(p => ({ ...p, type: 'INVOICE' })),
      ...allPayments.map(p => ({ ...p, type: p.note === 'REFUND' ? 'REFUND' : 'PAYMENT' })),
      ...returnsResp.data.map(r => ({ ...r, type: 'RETURN' })),
    ].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      
      // If within 10 seconds, use priority
      if (Math.abs(timeA - timeB) < 10000) {
        return typePriority[a.type] - typePriority[b.type];
      }
      return timeA - timeB; // Ascending initially for ledger calc
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
  },

  processReturn: async (supplierId: string, items: any[], refundAmount: number = 0, refundMethod: string | null = null, description?: string): Promise<string> => {
    const { data, error } = await supabase.rpc('process_purchase_return', {
      p_supplier_id: supplierId,
      p_items: items,
      p_refund_amount: refundAmount,
      p_refund_method: refundMethod,
      p_description: description
    });
    if (error) throw error;
    return data;
  }
};
