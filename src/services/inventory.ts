import { supabase } from './supabaseClient';
import { Category, Brand, Product } from '../types';

export const productService = {
  // Products
  getAll: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        brand:brands(id, name)
      `)
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Product[];
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
  },

  // Categories
  getAllCategories: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Category[];
  },

  createCategory: async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  updateCategory: async (id: string, category: Partial<Category>): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  // Brands
  getAllBrands: async (): Promise<Brand[]> => {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Brand[];
  },

  createBrand: async (brand: Omit<Brand, 'id' | 'created_at'>): Promise<Brand> => {
    const { data, error } = await supabase
      .from('brands')
      .insert([brand])
      .select()
      .single();
    if (error) throw error;
    return brand as Brand;
  },

  updateBrand: async (id: string, brand: Partial<Brand>): Promise<Brand> => {
    const { data, error } = await supabase
      .from('brands')
      .update(brand)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  }
};
