import React, { useEffect, useState } from 'react';
import { purchaseService } from '../services/purchases';
import { supplierService } from '../services/suppliers';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge } from '../components/UI';
import { Plus, Trash2, Search, ShoppingBag, Truck, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Purchase, Supplier, Product } from '../types';

interface PurchaseItemEntry {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  tax: number;
  total: number;
}

export function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // New Purchase State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemEntry[]>([]);
  const [paidAmount, setPaidAmount] = useState<string | number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('bank_transfer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pData, sData, prData] = await Promise.all([
        purchaseService.getAll(),
        supplierService.getAll(),
        productService.getAll()
      ]);
      setPurchases(pData);
      setSuppliers(sData);
      setProducts(prData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = (product: Product) => {
    const existingItem = purchaseItems.find(item => item.product_id === product.id);
    if (existingItem) {
      updateItemQuantity(product.id, existingItem.quantity + 1);
    } else {
      const quantity = 1;
      const price = product.purchase_price; // Default to current purchase price
      const tax = 0; // Purchase tax can be specified per item
      const total = price * quantity;

      setPurchaseItems([...purchaseItems, {
        product_id: product.id,
        name: product.name,
        quantity,
        price,
        tax,
        total
      }]);
    }
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setPurchaseItems(purchaseItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity, total: (item.price * quantity) + item.tax };
      }
      return item;
    }));
  };

  const updateItemPrice = (productId: string, price: number) => {
    setPurchaseItems(purchaseItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, price, total: (price * item.quantity) + item.tax };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId));
  };

  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmitPurchase = async () => {
    if (!selectedSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await purchaseService.createPurchase({
        supplier_id: selectedSupplierId,
        items: purchaseItems,
        paid_amount: parseFloat(paidAmount.toString()),
        payment_method: parseFloat(paidAmount.toString()) > 0 ? paymentMethod : null
      });
      
      setIsCreateModalOpen(false);
      resetNewPurchase();
      fetchData();
      alert('Stock purchase recorded successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewPurchase = () => {
    setSelectedSupplierId('');
    setPurchaseItems([]);
    setPaidAmount(0);
    setPaymentMethod('bank_transfer');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Purchase Log (Stock-In)</h2>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus size={18} />
          New Purchase Entry
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Date', 'ID', 'Supplier', 'Amount', 'Status', 'Balance']}>
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                  {format(new Date(p.created_at), 'dd MMM yyyy')}
                </td>
                <td className="px-6 py-4 font-medium text-primary uppercase text-[10px]">
                  PUR-{p.id.slice(0, 8)}
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.supplier?.shop_name}</div>
                </td>
                <td className="px-6 py-4 font-semibold text-slate-900">₹{p.total_amount}</td>
                <td className="px-6 py-4">
                  <Badge status={p.status} />
                </td>
                <td className="px-6 py-4">
                  <span className={p.balance_amount > 0 ? "text-red-500 font-bold" : "text-slate-400"}>
                    ₹{p.balance_amount}
                  </span>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">No purchase history.</td>
              </tr>
            )}
          </Table>
        )}
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Stock Purchase"
        className="max-w-4xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
            <div className="text-left">
              <span className="text-sm text-slate-500 block">Total Purchase Value</span>
              <span className="text-2xl font-bold text-slate-900">₹{purchaseTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitPurchase} disabled={submitting}>
                {submitting ? 'Recording...' : 'Update Inventory'}
              </Button>
            </div>
          </div>
        }
      >
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[60vh] overflow-hidden">
          <div className="space-y-6 overflow-y-auto pr-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Step 1: Supplier Choice</h3>
              <select
                className="w-full h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Step 2: Add Inventory Items</h3>
              <div className="space-y-2 border border-slate-100 rounded-lg divide-y divide-slate-100">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">Prev. Cost: ₹{p.purchase_price} | Current Stock: {p.stock}</div>
                    </div>
                    <button 
                      onClick={() => addItem(p)}
                      className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full bg-slate-50 -mx-6 -my-6 p-6 lg:m-0 lg:p-0 lg:bg-transparent">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Stock In List</h3>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
              {purchaseItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                  <ShoppingBag size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">Add products to increase stock</p>
                </div>
              ) : (
                purchaseItems.map(item => (
                  <div key={item.product_id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900 truncate">{item.name}</div>
                      <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Purchase Price"
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItemPrice(item.product_id, parseFloat(e.target.value))}
                      />
                      <Input
                        label="Quantity"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.product_id, parseInt(e.target.value))}
                      />
                    </div>
                    <div className="text-right text-xs font-bold text-slate-900">
                      Line Total: ₹{item.total.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    label="Paid to Supplier (₹)"
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Method</label>
                  <select
                    className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    disabled={parseFloat(paidAmount.toString()) <= 0}
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
