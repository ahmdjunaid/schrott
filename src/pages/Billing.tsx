import React, { useEffect, useState } from 'react';
import { billingService } from '../services/billing';
import { customerService } from '../services/customers';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table } from '../components/UI';
import { Plus, Trash2, Search, Receipt, ArrowUpRight, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { Bill, Customer, Product } from '../types';

interface BillItemEntry {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  sgst: number;
  cgst: number;
  total: number;
}

export function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // New Bill State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [billItems, setBillItems] = useState<BillItemEntry[]>([]);
  const [paidAmount, setPaidAmount] = useState<string | number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bData, cData, pData] = await Promise.all([
        billingService.getAllBills(),
        customerService.getAll(),
        productService.getAll()
      ]);
      setBills(bData);
      setCustomers(cData);
      setProducts(pData);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = (product: Product) => {
    const existingItem = billItems.find(item => item.product_id === product.id);
    if (existingItem) {
      updateItemQuantity(product.id, existingItem.quantity + 1);
    } else {
      const quantity = 1;
      const price = product.selling_price;
      const sgst = (price * (product.sgst || 0) / 100);
      const cgst = (price * (product.cgst || 0) / 100);
      const total = (price + sgst + cgst) * quantity;

      setBillItems([...billItems, {
        product_id: product.id,
        name: product.name,
        quantity,
        price,
        sgst,
        cgst,
        total
      }]);
    }
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    
    setBillItems(billItems.map(item => {
      if (item.product_id === productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return item;
        const price = product.selling_price;
        const sgst = (price * (product.sgst || 0) / 100);
        const cgst = (price * (product.cgst || 0) / 100);
        const total = (price + sgst + cgst) * quantity;
        return { ...item, quantity, total };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setBillItems(billItems.filter(item => item.product_id !== productId));
  };

  const billTotal = billItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmitBill = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }
    if (billItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await billingService.createBill({
        customer_id: selectedCustomerId,
        items: billItems,
        paid_amount: parseFloat(paidAmount.toString()),
        payment_method: parseFloat(paidAmount.toString()) > 0 ? paymentMethod : null
      });
      
      setIsCreateModalOpen(false);
      resetNewBill();
      fetchData();
      alert('Bill generated successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBillDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this invoice? This will automatically restore the product stock levels.')) {
      try {
        await billingService.deleteBill(id);
        fetchData();
        alert('Invoice deleted and stock restored successfully.');
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const resetNewBill = () => {
    setSelectedCustomerId('');
    setBillItems([]);
    setPaidAmount(0);
    setPaymentMethod('cash');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Billing History</h2>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus size={18} />
          Create New Invoice
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Date', 'Invoice #', 'Shop Name', 'Location', 'Amount', 'Status', 'Actions']}>
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                  {format(new Date(bill.created_at), 'dd MMM yyyy, hh:mm a')}
                </td>
                <td className="px-6 py-4 font-medium text-primary">
                  INV-{bill.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-900 font-bold">{bill.customer?.shop_name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-600 text-sm">{bill.customer?.location || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-900 font-semibold">₹{bill.total_amount}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    bill.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    bill.status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {bill.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex items-center justify-end gap-3">
                  <button className="text-slate-400 hover:text-primary transition-colors">
                    <ArrowUpRight size={18} />
                  </button>
                  <button 
                    onClick={() => handleBillDelete(bill.id)} 
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">No invoices found.</td>
              </tr>
            )}
          </Table>
        )}
      </Card>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Invoice"
        className="max-w-4xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
            <div className="text-left w-full sm:w-auto">
              <span className="text-sm text-slate-500 block">Total Payable</span>
              <span className="text-2xl font-bold text-slate-900">₹{billTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitBill} disabled={submitting} className="min-w-[150px]">
                {submitting ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full max-h-[60vh] overflow-hidden">
          {/* Left Side: Customer & Product Selection */}
          <div className="space-y-6 overflow-y-auto pr-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Step 1: Select Customer</h3>
              <div className="space-y-1">
                <select
                  className="w-full h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Choose Customer...</option>
                   {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.shop_name} {c.location ? `(${c.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Step 2: Add Products</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {products.filter(p => p.is_active && p.stock > 0).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">₹{p.selling_price} | Stock: {p.stock}</div>
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

          {/* Right Side: Bill Items & Payment */}
          <div className="flex flex-col h-full bg-slate-50 -mx-6 -my-6 p-6 lg:m-0 lg:p-0 lg:bg-transparent">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Invoice Items</h3>
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
              {billItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                  <ShoppingCart size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                billItems.map(item => (
                  <div key={item.product_id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-xs text-slate-500">
                        {item.quantity} x ₹{item.price} + Tax
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-200 rounded-md">
                        <button 
                          onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                          className="px-2 py-1 hover:bg-slate-100 text-slate-500"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button 
                          onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                          className="px-2 py-1 hover:bg-slate-100 text-slate-500"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-sm font-bold text-slate-900 w-20 text-right">
                        ₹{item.total.toFixed(2)}
                      </div>
                      <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    label="Paid Amount (₹)"
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
