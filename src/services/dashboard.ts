import { supabase } from './supabaseClient';
import { Bill, DashboardStats, Purchase } from '../types';

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const [
      { count: productsCount },
      { count: lowStockCount },
      { data: salesData },
      { count: customersCount },
      { data: purchaseData }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 5),
      supabase.from('bills').select('total_amount, paid_amount'),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('purchases').select('total_amount, paid_amount')
    ]);

    const totalSales = salesData?.reduce((sum: number, bill: any) => sum + parseFloat(bill.total_amount), 0) || 0;
    const totalPaid = salesData?.reduce((sum: number, bill: any) => sum + parseFloat(bill.paid_amount), 0) || 0;
    const totalPending = totalSales - totalPaid;

    const totalPurchases = purchaseData?.reduce((sum: number, p: any) => sum + parseFloat(p.total_amount), 0) || 0;
    const totalPurchasePaid = purchaseData?.reduce((sum: number, p: any) => sum + parseFloat(p.paid_amount), 0) || 0;
    const totalPurchaseOutstanding = totalPurchases - totalPurchasePaid;

    return {
      productsCount: productsCount || 0,
      lowStockCount: lowStockCount || 0,
      customersCount: customersCount || 0,
      totalSales,
      totalPaid,
      totalPending,
      billsCount: salesData?.length || 0,
      totalPurchases,
      totalPurchasePaid,
      totalPurchaseOutstanding
    };
  },

  getRecentBills: async (limit = 5): Promise<Bill[]> => {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        customer:customers(name, shop_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as Bill[];
  }
};
