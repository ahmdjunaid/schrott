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
          suppliers!supplier_id (
            shop_name
          )
        )
      `)
      .eq('product_id', productId)
      .gt('remaining_qty', 0)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase batch fetch error:', error);
      throw error;
    }
    
    // Transform the data to match the expected interface if using direct join
    const transformed = (data || []).map((item: any) => ({
      ...item,
      purchase: item.purchases ? {
        supplier: item.purchases.suppliers
      } : null
    }));

    return transformed as any[];
  },

  create: async (product: Omit<Product, 'id' | 'created_at'>): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
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
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const categoryService = {
  getAll: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
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
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const brandService = {
  getAll: async (): Promise<Brand[]> => {
    const { data, error } = await supabase
      .from('brands')
      .select('*, products(count)')
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
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
