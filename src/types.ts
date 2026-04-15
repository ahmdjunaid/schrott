export interface Category {
  id: string;
  name: string;
  description?: string;
  is_blocked: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  is_blocked: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  purchase_price: number;
  selling_price: number;
  sgst: number;
  cgst: number;
  image_url?: string;
  is_active: boolean;
  stock: number;
  category_id?: string;
  brand_id?: string;
  created_at: string;
  category?: Category;
  brand?: Brand;
}

export interface Customer {
  id: string;
  name?: string;
  phone: string;
  shop_name: string;
  location?: string;
  created_at: string;
}

export type BillStatus = 'PAID' | 'PARTIAL' | 'PENDING';

export interface Bill {
  id: string;
  customer_id: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: BillStatus;
  created_at: string;
  customer?: Customer;
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id?: string;
  quantity: number;
  price: number;
  sgst: number;
  cgst: number;
  total: number;
  created_at: string;
  product?: {
    name: string;
  };
}

export interface Payment {
  id: string;
  bill_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card';
  created_at: string;
}

export interface BillDetails extends Bill {
  items: BillItem[];
  payments: Payment[];
}

export interface Supplier {
  id: string;
  name?: string;
  phone: string;
  shop_name: string;
  location?: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: BillStatus;
  created_at: string;
  supplier?: Supplier;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id?: string;
  quantity: number;
  price: number;
  tax: number;
  total: number;
  created_at: string;
  product?: {
    name: string;
  };
}

export interface SupplierPayment {
  id: string;
  purchase_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer';
  created_at: string;
}

export interface DashboardStats {
  productsCount: number;
  lowStockCount: number;
  customersCount: number;
  totalSales: number;
  totalPaid: number;
  totalPending: number;
  billsCount: number;
  totalPurchases: number;
  totalPurchasePaid: number;
  totalPurchaseOutstanding: number;
}
