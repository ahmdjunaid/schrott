import { supabase } from './supabaseClient';
import { Purchase } from '../types';

export const purchaseService = {
  createPurchase: async (purchaseData: {
    supplier_id: string;
    items: any[];
    paid_amount: number;
    payment_method: string | null;
    use_wallet: boolean;
  }): Promise<string> => {
    const { supplier_id, items, paid_amount, payment_method, use_wallet } = purchaseData;
    
    const { data, error } = await supabase.rpc('create_purchase_and_update_stock', {
      p_supplier_id: supplier_id,
      p_items: items,
      p_paid_amount: paid_amount,
      p_payment_method: payment_method,
      p_use_wallet: use_wallet
    });

    if (error) throw error;
    return data;
  },

  getAll: async (): Promise<Purchase[]> => {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        suppliers!supplier_id(name, shop_name, location)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Purchases fetch error:', error);
      throw error;
    }
    
    return (data || []).map((p: any) => ({
      ...p,
      supplier: p.suppliers
    })) as Purchase[];
  },

  deletePurchase: async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('delete_purchase_and_revert_stock', {
      p_purchase_id: id
    });
    if (error) throw error;
  },

  updatePurchase: async (id: string, data: Partial<Purchase>): Promise<void> => {
    const { error } = await supabase
      .from('purchases')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  getPurchaseItems: async (purchaseId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        *,
        product:products(name)
      `)
      .eq('purchase_id', purchaseId);
    
    if (error) throw error;
    return data;
  },

  getPurchasePayments: async (purchaseId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('supplier_payments')
      .select('*')
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  recordPayment: async (purchaseId: string, amount: number, method: string): Promise<void> => {
    const { error } = await supabase.rpc('record_purchase_payment', {
      p_purchase_id: purchaseId,
      p_amount: amount,
      p_method: method
    });
    if (error) throw error;
  },

  deletePurchaseItem: async (itemId: string): Promise<void> => {
    const { error } = await supabase.rpc('delete_purchase_item_and_update_totals', {
      p_purchase_item_id: itemId
    });
    if (error) throw error;
  },

  updatePurchaseItemQty: async (itemId: string, newQty: number): Promise<void> => {
    const { error } = await supabase.rpc('update_purchase_item_qty', {
      p_purchase_item_id: itemId,
      p_new_qty: newQty
    });
    if (error) throw error;
  }
};
