import { supabase } from './supabaseClient';
import { Purchase } from '../types';

export const purchaseService = {
  createPurchase: async (purchaseData: {
    supplier_id: string;
    items: any[];
    paid_amount: number;
    payment_method: string | null;
  }): Promise<string> => {
    const { supplier_id, items, paid_amount, payment_method } = purchaseData;
    
    const { data, error } = await supabase.rpc('create_purchase_and_update_stock', {
      p_supplier_id: supplier_id,
      p_items: items,
      p_paid_amount: paid_amount,
      p_payment_method: payment_method
    });

    if (error) throw error;
    return data;
  },

  getAll: async (): Promise<Purchase[]> => {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        supplier:suppliers(name, shop_name, location)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Purchase[];
  }
};
