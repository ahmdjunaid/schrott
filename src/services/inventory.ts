import { supabase } from './supabaseClient';
import { Product, Category, Brand, PurchaseItem } from '../types';

export const productService = {
  getAll: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories!category_id(name),
        brands!brand_id(name)
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Products fetch error:', error);
      throw error;
    }
    
    return (data || []).map((p: any) => ({
      ...p,
      category: p.categories,
      brand: p.brands
    })) as Product[];
  },

  getAvailableBatches: async (productId: string): Promise<PurchaseItem[]> => {
    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        *,
        purchases!purchase_id (
          created_at,
          suppliers!supplier_id (
            shop_name
          )
        )
      `)
      .eq('product_id', productId)
      .gt('remaining_qty', 0)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      ...item,
      purchase: item.purchases ? {
        supplier: item.purchases.suppliers,
        created_at: item.purchases.created_at
      } : null,
      subtitle: `${item.description || 'No Desc'} | Cost: ₹${parseFloat(item.purchase_price).toFixed(2)} | Date: ${item.purchases ? new Date(item.purchases.created_at).toLocaleDateString() : 'N/A'} | Src: ${item.purchases?.suppliers?.shop_name || 'Manual'}`
    })) as any[];
  },

  create: async (product: Omit<Product, 'id' | 'created_at'>): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .insert([{ ...product, is_active: true }])
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  update: async (id: string, product: Partial<Product>): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  getSoldBatches: async (customerId: string, productId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('bill_items')
      .select(`
        id,
        quantity,
        price,
        total,
        purchase_item_id,
        created_at,
        bill:bills!inner(id, created_at, customer_id),
        batch:purchase_items(id, purchase_price, description, purchases(id, created_at, suppliers(shop_name))),
        returns:sales_return_items(quantity)
      `)
      .eq('product_id', productId)
      .eq('bills.customer_id', customerId);
    
    if (error) throw error;

    return (data || []).map((item: any) => {
      const returnedQty = (item.returns || []).reduce((sum: number, ret: any) => sum + (ret.quantity || 0), 0);
      const remainingToReturn = item.quantity - returnedQty;

      return {
        ...item,
        quantity: remainingToReturn, // Show NET quantity available for return
        original_qty: item.quantity,
        returned_qty: returnedQty,
        batch_id: item.purchase_item_id,
        purchase_date: item.bill?.created_at,
        subtitle: `Bill: #${item.bill?.id?.slice(0, 8)} | At: ₹${parseFloat(item.batch?.purchase_price || 0).toFixed(2)} | Date: ${item.batch?.purchases ? new Date(item.batch.purchases.created_at).toLocaleDateString() : 'N/A'} | ${item.batch?.description || 'No Desc'}`
      };
    }).filter(item => item.quantity > 0); // Only show items that still have something to return
  }
};

export const categoryService = {
  getAll: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .eq('is_blocked', false)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map((c: any) => ({
      ...c,
      product_count: c.products?.[0]?.count || 0
    })) as Category[];
  },

  create: async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },
  
  update: async (id: string, category: Partial<Category>): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('categories')
      .update({ is_blocked: true })
      .eq('id', id);
    if (error) throw error;
  }
};

export const brandService = {
  getAll: async (): Promise<Brand[]> => {
    const { data, error } = await supabase
      .from('brands')
      .select('*, products(count)')
      .eq('is_blocked', false)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map((b: any) => ({
      ...b,
      product_count: b.products?.[0]?.count || 0
    })) as Brand[];
  },

  create: async (brand: Omit<Brand, 'id' | 'created_at'>): Promise<Brand> => {
    const { data, error } = await supabase
      .from('brands')
      .insert([brand])
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  update: async (id: string, brand: Partial<Brand>): Promise<Brand> => {
    const { data, error } = await supabase
      .from('brands')
      .update(brand)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('brands')
      .update({ is_blocked: true })
      .eq('id', id);
    if (error) throw error;
  }
};
