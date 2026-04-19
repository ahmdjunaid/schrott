import { supabase } from './supabaseClient';
import { Bill, BillDetails, BillItem } from '../types';

export const billingService = {
  createBill: async (billData: {
    customer_id: string;
    items: any[];
    paid_amount: number;
    payment_method: string | null;
    use_wallet?: boolean;
  }): Promise<string> => {
    const { customer_id, items, paid_amount, payment_method, use_wallet } = billData;
    
    const { data, error } = await supabase.rpc('create_bill_and_update_stock', {
      p_customer_id: customer_id,
      p_items: items,
      p_paid_amount: paid_amount,
      p_payment_method: payment_method,
      p_use_wallet: use_wallet ?? true
    });

    if (error) throw error;
    return data;
  },

  deleteBill: async (billId: string): Promise<void> => {
    const { error } = await supabase.rpc('delete_bill_and_restock', {
      p_bill_id: billId
    });
    if (error) throw error;
  },

  getAllBills: async (): Promise<Bill[]> => {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        customer:customers(name, phone, shop_name, location)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Bill[];
  },

  getBillDetails: async (billId: string): Promise<BillDetails> => {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        customer:customers(*),
        items:bill_items(
          *,
          product:products(name)
        ),
        payments:payments(*)
      `)
      .eq('id', billId)
      .single();
    if (error) throw error;
    return data as BillDetails;
  },

  getCustomerOldBalance: async (customerId: string, upToBillId?: string): Promise<number> => {
    let query = supabase
      .from('bills')
      .select('balance_amount')
      .eq('customer_id', customerId);
    
    if (upToBillId) {
      // Find bills created before or same time, but exclude THIS one specifically for "Previous Balance"
      query = query.neq('id', upToBillId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).reduce((sum, b) => sum + (Number(b.balance_amount) || 0), 0);
  }
};
