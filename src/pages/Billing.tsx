import React, { useEffect, useState } from 'react';
import { billingService } from '../services/billing';
import { customerService } from '../services/customers';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, Pagination, cn } from '../components/UI';
import { SearchableSelect } from '../components/UI/SearchableSelect';
import { Plus, Trash2, Search, Package, ShoppingCart, Layers, Edit3, Save, Printer, ChevronRight, X, Info, Receipt, ArrowUpRight, AlertTriangle, Eye, MapPin, Phone, AlignLeft, Banknote, QrCode, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/toast';
import { Bill, Customer, Product, PurchaseItem } from '../types';

interface BillItemEntry {
  product_id: string;
  purchase_item_id: string;
  name: string;
  quantity: number;
  price: number;
  purchase_price: number;
  description?: string;
  max_qty: number;
  sgst: number;
  cgst: number;
  total: number;
  tax_rate: { sgst: number; cgst: number };
}

export function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Batch Selection State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductForBatch, setSelectedProductForBatch] = useState<Product | null>(null);
  const [availableBatches, setAvailableBatches] = useState<PurchaseItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  // New Bill State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [billItems, setBillItems] = useState<BillItemEntry[]>([{
    product_id: '',
    purchase_item_id: `temp-${Date.now()}`,
    name: '',
    quantity: 0,
    price: 0,
    purchase_price: 0,
    max_qty: 0,
    tax_rate: { sgst: 0, cgst: 0 },
    sgst: 0,
    cgst: 0,
    total: 0
  }]);
  const [paidAmount, setPaidAmount] = useState<string | number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<any>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [oldBalance, setOldBalance] = useState(0);

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

  const handleProductSelect = async (product: Product, index?: number) => {
    setSelectedProductForBatch(product);
    setEditingRowIndex(index !== undefined ? index : null);
    setLoadingBatches(true);
    setShowBatchModal(true);
    try {
      const batches = await productService.getAvailableBatches(product.id);
      setAvailableBatches(batches);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const addBatchToBill = (batch: PurchaseItem) => {
    if (!selectedProductForBatch) return;

    const newItem: BillItemEntry = {
      product_id: selectedProductForBatch.id,
      purchase_item_id: batch.id,
      name: selectedProductForBatch.name,
      quantity: 1,
      price: selectedProductForBatch.selling_price || 0,
      purchase_price: batch.purchase_price,
      description: batch.description,
      max_qty: batch.remaining_qty,
      tax_rate: { sgst: selectedProductForBatch.sgst || 0, cgst: selectedProductForBatch.cgst || 0 },
      sgst: 0,
      cgst: 0,
      total: 0
    };

    // Calculate initial totals
    const sgst = (newItem.price * newItem.tax_rate.sgst / 100) * newItem.quantity;
    const cgst = (newItem.price * newItem.tax_rate.cgst / 100) * newItem.quantity;
    newItem.sgst = sgst;
    newItem.cgst = cgst;
    newItem.total = (newItem.price * newItem.quantity) + sgst + cgst;

    if (editingRowIndex !== null) {
      const updatedItems = [...billItems];
      updatedItems[editingRowIndex] = newItem;
      setBillItems(updatedItems);
      setEditingRowIndex(null);
    } else {
      const existingItem = billItems.find(item => item.purchase_item_id === batch.id);
      if (existingItem) {
        updateItemQuantity(batch.id, existingItem.quantity + 1);
      } else {
        setBillItems([...billItems, newItem]);
      }
    }
    setShowBatchModal(false);
  };

  const addNewItem = () => {
    setBillItems([...billItems, {
      product_id: '',
      purchase_item_id: `temp-${Date.now()}`,
      name: '',
      quantity: 0,
      price: 0,
      purchase_price: 0,
      max_qty: 0,
      tax_rate: { sgst: 0, cgst: 0 },
      sgst: 0,
      cgst: 0,
      total: 0
    }]);
  };

  const updateItemProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      handleProductSelect(product, index);
    }
  };

  const updateItemQuantity = (purchaseItemId: string, quantity: number) => {
    setBillItems(billItems.map(item => {
      if (item.purchase_item_id === purchaseItemId) {
        if (quantity > item.max_qty) {
          toast.error(`Insufficient stock! Only ${item.max_qty} available.`);
          return item;
        }
        if (quantity <= 0) {
          removeItem(purchaseItemId);
          return item;
        }
        
        const sgst = (item.price * item.tax_rate.sgst / 100) * quantity;
        const cgst = (item.price * item.tax_rate.cgst / 100) * quantity;
        const total = (item.price * quantity) + sgst + cgst;

        return { ...item, quantity, sgst, cgst, total };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updateItemPrice = (purchaseItemId: string, price: number) => {
    setBillItems(billItems.map(item => {
      if (item.purchase_item_id === purchaseItemId) {
        const sgst = (price * item.tax_rate.sgst / 100) * item.quantity;
        const cgst = (price * item.tax_rate.cgst / 100) * item.quantity;
        const total = (price * item.quantity) + sgst + cgst;

        return { ...item, price, sgst, cgst, total };
      }
      return item;
    }));
  };

  const removeItem = (purchaseItemId: string) => {
    setBillItems(billItems.filter(item => item.purchase_item_id !== purchaseItemId));
  };

  const billTotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const totalTax = billItems.reduce((sum, item) => sum + item.sgst + item.cgst, 0);

  const handleSubmitBill = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    if (billItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const formattedItems = billItems.map(item => ({
        product_id: item.product_id,
        purchase_item_id: item.purchase_item_id,
        quantity: item.quantity,
        selling_price: item.price,
        purchase_price: item.purchase_price,
        sgst: item.sgst,
        cgst: item.cgst,
        total: item.total
      }));

      await billingService.createBill({
        customer_id: selectedCustomerId,
        items: formattedItems,
        paid_amount: parseFloat(paidAmount.toString()),
        payment_method: parseFloat(paidAmount.toString()) > 0 ? paymentMethod : null
      });
      
      setIsCreateModalOpen(false);
      resetNewBill();
      fetchData();
      toast.success('Bill generated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBillDelete = async (id: string) => {
    confirmToast(
      'Are you sure you want to delete this bill? Stock will be restored.',
      async () => {
        try {
          await billingService.deleteBill(id);
          fetchData();
          toast.success('Bill deleted successfully.');
        } catch (error: any) {
          toast.error(error.message);
        }
      }
    );
  };

  const handleViewBill = async (id: string) => {
    setFetchingDetails(true);
    setIsViewModalOpen(true);
    try {
      const details = await billingService.getBillDetails(id);
      setViewingBill(details);
      
      // Fetch Old Balance (excluding current bill)
      const balance = await billingService.getCustomerOldBalance(details.customer_id, id);
      setOldBalance(balance);
    } catch (error: any) {
      toast.error(error.message);
      setIsViewModalOpen(false);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!viewingBill) return;

    const itemsText = viewingBill.items.map((i: any) => 
      `• ${i.product?.name} x ${i.quantity} = ₹${i.total}`
    ).join('\n');

    const message = `*SCHROTT INVOICE*
#INV-${viewingBill.id.slice(0, 8).toUpperCase()}
Date: ${format(new Date(viewingBill.created_at), 'dd/MM/yyyy')}
-------------------------
*ITEMS:*
${itemsText}
-------------------------
*BILL TOTAL:* ₹${viewingBill.total_amount}
*OLD BALANCE:* ₹${oldBalance.toFixed(2)}
*GRAND TOTAL:* ₹${(Number(viewingBill.total_amount) + oldBalance).toFixed(2)}
-------------------------
*Status:* ${viewingBill.status}
_Thank you for your business!_`;

    const encoded = encodeURIComponent(message);
    const phone = viewingBill.customer?.phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encoded}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const resetNewBill = () => {
    setSelectedCustomerId('');
    setBillItems([{
      product_id: '',
      purchase_item_id: `temp-${Date.now()}`,
      name: '',
      quantity: 0,
      price: 0,
      purchase_price: 0,
      max_qty: 0,
      tax_rate: { sgst: 0, cgst: 0 },
      sgst: 0,
      cgst: 0,
      total: 0
    }]);
    setPaidAmount(0);
    setPaymentMethod('cash');
  };

  const filteredBills = bills.filter(bill => 
    bill.customer?.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Billing</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage and track your customer bills and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[300px] hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search by bill number or customer..."
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 focus:border-primary/40 rounded-lg text-sm transition-all focus:ring-4 focus:ring-primary/5 shadow-sm outline-none font-medium"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button 
            onClick={() => {
              resetNewBill();
              setIsCreateModalOpen(true);
            }} 
            className="h-11 shadow-lg shadow-primary/20"
          >
            <Plus size={18} strokeWidth={2.5} />
            Create New Bill
          </Button>
        </div>
      </div>

      <Card className="p-0 border-slate-200 shadow-md">
        {loading ? (
          <div className="flex justify-center p-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <Table headers={['Date', 'Bill No', 'Customer Name', 'Total Amount', 'Status', 'Actions']}>
              {filteredBills
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-black text-slate-500 uppercase leading-none">Record</div>
                      <div className="text-xs font-bold text-slate-400 mt-1">{format(new Date(bill.created_at), 'dd MMM yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-primary uppercase text-xs italic">
                      #BILL-{bill.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-black leading-tight italic">{bill.customer?.shop_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{bill.customer?.location || 'Local Terminal'}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-sm font-black text-slate-900 italic">₹{bill.total_amount.toFixed(2)}</div>
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total Amount</div>
                    </td>
                    <td className="px-6 py-4">
                       <Badge status={bill.status} />
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleViewBill(bill.id)}
                            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all"
                            title="View Details"
                          >
                            <Eye size={18} strokeWidth={2.5} />
                          </button>
                          <button 
                            onClick={() => handleBillDelete(bill.id)} 
                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                            title="Void Invoice"
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold italic text-sm uppercase tracking-widest">No bill records found.</td>
                </tr>
              )}
            </Table>
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(filteredBills.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>
      {/* Bill Creation Terminal */}
  <Modal
    isOpen={isCreateModalOpen}
    onClose={() => setIsCreateModalOpen(false)}
    title="Create New Bill"
    className="max-w-7xl"
    footer={
      <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-8 p-1">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
             <Receipt size={24} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] block leading-none mb-1">Total Bill Amount</span>
            <span className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{billTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="px-8 h-12 flex-1 sm:flex-none">Cancel</Button>
          <Button onClick={handleSubmitBill} disabled={submitting} className="h-12 px-12 shadow-xl shadow-primary/30 font-black flex-1 sm:flex-none">
            {submitting ? 'Generating...' : 'Save Bill'}
          </Button>
        </div>
      </div>
    }
  >
    <div className="space-y-8 min-h-[70vh] -mx-2">
      {/* Section 01: Customer Logistics */}
      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-inner">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
             <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Customer Details</h3>
          </div>
          <select
            className="w-full h-10 px-4 bg-white border border-slate-200 rounded-lg text-sm font-black shadow-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all italic"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Select a customer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="font-bold">{c.shop_name} — {c.location || 'Local'}</option>
            ))}
          </select>
        </div>
        {selectedCustomerId && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xl shadow-slate-200/20 flex items-center gap-4 min-w-[240px] border-l-4 border-l-primary/40">
             <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/10">
                <MapPin size={20} strokeWidth={2.5} />
             </div>
             <div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Customer Location</div>
                <div className="text-sm font-black text-slate-900 italic tracking-tight leading-none uppercase">
                  {customers.find(c => c.id === selectedCustomerId)?.location || 'Local Terminal'}
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* Section 02: Asset Registry Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
               <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
               <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Bill Registry</h3>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200/50 italic shadow-sm">
              <Info size={14} className="text-primary" strokeWidth={2.5} />
              <span className="text-[10px] font-bold text-slate-500 tracking-tight uppercase">FIFO Batching & Tax auto-split</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/30">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                  <th className="px-3 py-3 w-[35%]">Product Details</th>
                  <th className="px-2 py-3 text-center w-[15%]">Stock Info</th>
                  <th className="px-2 py-3 text-center w-[12%]">Qty</th>
                  <th className="px-2 py-3 text-center w-[15%]">Selling Price (₹)</th>
                  <th className="px-3 py-3 text-right w-[20%]">Total (₹)</th>
                  <th className="px-2 py-3 w-10 text-center flex items-center justify-center pt-3.5"><ShoppingCart size={14} className="opacity-30" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 italic">
                {billItems.map((item, index) => (
                    <tr key={item.purchase_item_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-2 py-2">
                        <SearchableSelect
                          options={products.map(p => ({ id: p.id, name: p.name, stock: p.stock }))}
                          value={item.product_id}
                          onChange={(val) => updateItemProduct(index, val)}
                          placeholder="Search Product..."
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {item.product_id ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-primary uppercase leading-none tracking-tighter">Available</span>
                            <span className="text-xs font-black text-slate-900 mt-1">{item.max_qty} <span className="text-[8px] text-slate-400 font-bold tracking-normal italic uppercase">Units</span></span>
                          </div>
                        ) : (
                          <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">N/A</div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-center font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-base shadow-sm disabled:opacity-30"
                          value={item.quantity || ''}
                          onChange={(e) => updateItemQuantity(item.purchase_item_id, parseFloat(e.target.value) || 0)}
                          disabled={!item.product_id}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="relative">
                           <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[10px]">₹</span>
                           <input
                            type="number"
                            className="w-full h-9 pl-5 pr-2 bg-white border border-slate-200 rounded-lg text-center font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-base shadow-sm disabled:opacity-30"
                            value={item.price || ''}
                            onChange={(e) => updateItemPrice(item.purchase_item_id, parseFloat(e.target.value) || 0)}
                            disabled={!item.product_id}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-base font-black text-slate-900 italic tracking-tighter">₹{item.total.toFixed(2)}</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Net Total</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => removeItem(item.purchase_item_id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-sm group-hover:scale-110">
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <div className="p-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={addNewItem} className="h-10 px-6 gap-2 bg-white border-slate-200 text-primary hover:border-primary/50 shadow-sm font-black italic">
                <Plus size={18} strokeWidth={3} /> Add New Line Item
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 04: Settlement Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-slate-200">
         <div className="lg:col-span-7 space-y-6">
           <div className="flex items-center gap-2 px-2">
             <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Payment Details</h3>
           </div>
           
           <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/20">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount Paid (₹)</label>
                 <div className="relative group/paid">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg group-focus-within/paid:text-primary transition-colors italic">₹</span>
                    <input 
                      type="number" 
                      value={paidAmount} 
                      onChange={(e) => setPaidAmount(e.target.value)} 
                      className="w-full h-14 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black italic focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                      placeholder="0.00"
                    />
                 </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    disabled={parseFloat(paidAmount.toString()) <= 0}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2 h-14",
                      paymentMethod === 'cash' 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                        : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200",
                      parseFloat(paidAmount.toString()) <= 0 && "opacity-30 grayscale cursor-not-allowed"
                    )}
                  >
                    <Banknote size={20} strokeWidth={paymentMethod === 'cash' ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    disabled={parseFloat(paidAmount.toString()) <= 0}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2 h-14",
                      paymentMethod === 'upi' 
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm" 
                        : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200",
                      parseFloat(paidAmount.toString()) <= 0 && "opacity-30 grayscale cursor-not-allowed"
                    )}
                  >
                    <QrCode size={20} strokeWidth={paymentMethod === 'upi' ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-widest">UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    disabled={parseFloat(paidAmount.toString()) <= 0}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2 h-14",
                      paymentMethod === 'card' 
                        ? "bg-slate-900 border-slate-800 text-white shadow-lg" 
                        : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200",
                      parseFloat(paidAmount.toString()) <= 0 && "opacity-30 grayscale cursor-not-allowed"
                    )}
                  >
                    <CreditCard size={20} strokeWidth={paymentMethod === 'card' ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Card</span>
                  </button>
                </div>
              </div>
           </div>
         </div>

         <div className="lg:col-span-5">
            <div className="bg-slate-900 p-4 rounded-2xl text-white space-y-4 shadow-2xl shadow-slate-900/40 relative overflow-hidden group/card flex flex-col justify-between">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-[100px] group-hover/card:bg-primary/30 transition-all duration-700" />
               <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full -ml-24 -mb-24 blur-[80px]" />
               
               <div className="relative space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-primary">
                           <ShoppingCart size={14} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] italic">Bill Summary</span>
                     </div>
                     <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{format(new Date(), 'dd.MM.yyyy')}</span>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center group/row">
                         <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest group-hover/row:text-white transition-colors">Subtotal</span>
                         <span className="font-black text-base italic tracking-tighter text-slate-300">₹{(billTotal - totalTax).toFixed(2)}</span>
                      </div>
                      
                      {totalTax > 0 && (
                        <div className="flex justify-between items-center group/row">
                           <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest group-hover/row:text-white transition-colors">Total Tax (GST)</span>
                           <span className="font-black text-sm italic tracking-tighter text-primary">₹{totalTax.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center group/row">
                         <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest group-hover/row:text-white transition-colors">Total Amount</span>
                         <span className="font-black text-lg italic tracking-tighter">₹{billTotal.toFixed(2)}</span>
                      </div>
                     
                     <div className="flex justify-between items-center text-primary group/row border-b border-white/5 pb-3">
                        <span className="font-bold text-[10px] uppercase tracking-widest">Amount Paid</span>
                        <span className="font-black text-base italic tracking-tighter">₹{parseFloat(paidAmount.toString()) || 0}</span>
                     </div>

                     <div className="pt-3 flex flex-col gap-1">
                        <span className="text-slate-500 font-black text-[9px] uppercase tracking-[0.4em] leading-none">Remaining Balance</span>
                        <div className={cn(
                          "text-2xl font-black italic tracking-tighter transition-all duration-500",
                          Math.max(0, billTotal - (parseFloat(paidAmount.toString()) || 0)) > 0 
                            ? "text-rose-500" 
                            : "text-emerald-500"
                        )}>
                          ₹{Math.max(0, billTotal - (parseFloat(paidAmount.toString()) || 0)).toFixed(2)}
                        </div>
                     </div>
                  </div>
               </div>

               <div className="relative pt-4 text-center border-t border-white/5">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.5em] italic">Billing System Terminal</p>
               </div>
            </div>
         </div>
      </div>
    </div>
      </Modal>

      {/* Batch Selection Modal */}
      <Modal isOpen={showBatchModal} onClose={() => setShowBatchModal(false)} title="Select Batch" className="max-w-md">
        <div className="space-y-6">
          <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-white border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Package size={24} strokeWidth={2.5} />
             </div>
             <div>
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.1em] leading-tight italic">{selectedProductForBatch?.name}</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest italic">Assign batch to bill</p>
             </div>
          </div>

          {loadingBatches ? (
             <div className="py-16 flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Checking stock...</p>
             </div>
          ) : (
            <div className="space-y-3">
              {availableBatches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => addBatchToBill(batch)}
                  className="w-full text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all group relative active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-0.5">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Price per Unit</span>
                       <div className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors italic">₹{batch.purchase_price.toFixed(2)}</div>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-tighter border border-slate-200">
                      AVL: {batch.remaining_qty} UNITS
                    </div>
                  </div>
                  
                  {batch.description && (
                    <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 font-bold italic border-l-4 border-primary/20">
                       {batch.description}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase pt-3 border-t border-slate-50">
                     <span>Entry Date: {format(new Date(batch.created_at), 'dd MMM yyyy')}</span>
                     <span className="text-primary italic">Select <ChevronRight size={10} className="inline ml-1" /></span>
                  </div>
                </button>
              ))}
              {availableBatches.length === 0 && (
                <div className="py-16 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center px-8">
                   <AlertTriangle className="text-rose-400 mb-3 opacity-30" size={32} />
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-snug italic">Out of stock</div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Bill Details Modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Bill Details" 
        className="max-w-2xl"
        footer={
          <div className="flex gap-3 justify-end w-full sm:w-auto no-print">
            <Button variant="ghost" onClick={() => setIsViewModalOpen(false)} className="flex-1 sm:flex-none">Close</Button>
            <Button 
              onClick={handleShareWhatsApp} 
              className="flex-1 sm:flex-none gap-2 font-black bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-lg shadow-green-200"
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
               </svg>
               WhatsApp Bill
            </Button>
          </div>
        }
      >
        {fetchingDetails ? (
           <div className="flex flex-col items-center py-24">
              <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary mb-6 shadow-sm"></div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Loading Details...</p>
           </div>
        ) : viewingBill && (
          <div id="printable-invoice" className="bg-white p-4 text-slate-900 border border-slate-200 rounded-3xl shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
              <div className="space-y-1">
                <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none">SCHROTT.</h1>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Billing System</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="bg-slate-900 text-white px-5 py-2 rounded-lg text-xs font-black italic tracking-widest mb-4">
                   INVOICE
                </div>
                <div className="text-right space-y-1">
                   <div className="text-xl font-black text-slate-900 uppercase italic">#BILL-{viewingBill.id.slice(0, 8).toUpperCase()}</div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(viewingBill.created_at), 'dd MMMM yyyy • hh:mm a')}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10">
               <div className="space-y-4">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100 pb-1">Customer Details</div>
                  <div>
                    <div className="text-lg font-black text-slate-900 italic leading-snug uppercase">{viewingBill.customer?.shop_name}</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase flex items-center gap-2">
                       <MapPin size={10} className="text-primary" />
                       {viewingBill.customer?.location || 'Local Address'}
                    </div>
                    <div className="text-[10px] font-black text-primary mt-1 uppercase flex items-center gap-2">
                       <Phone size={10} />
                       {viewingBill.customer?.phone}
                    </div>
                  </div>
               </div>
               <div className="space-y-4 text-right flex flex-col items-end">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100 pb-1 w-full">Bill Status</div>
                  <div className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest italic border-2 inline-block ${
                     viewingBill.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                     viewingBill.status === 'PARTIAL' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                     'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {viewingBill.status}
                  </div>
               </div>
            </div>

            {/* Assets Table */}
            <div className="mb-12">
               <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 font-black italic uppercase text-[10px] tracking-widest text-slate-900">
                      <th className="py-4">Item Name</th>
                      <th className="py-4 text-center">Qty</th>
                      <th className="py-4 text-right">Price (₹)</th>
                      <th className="py-4 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingBill.items.map((item: any, idx: number) => (
                      <tr key={idx} className="group italic text-xs font-bold text-slate-700">
                        <td className="py-5">
                          <div className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{item.product?.name}</div>
                          {item.description && <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-tight">{item.description}</div>}
                        </td>
                        <td className="py-5 text-center font-black">
                           <span className="bg-slate-50 px-3 py-1 rounded-md border border-slate-100">{item.quantity}</span>
                        </td>
                        <td className="py-5 text-right font-black">₹{item.price.toFixed(2)}</td>
                        <td className="py-5 text-right font-black text-slate-900">₹{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>

            {/* Financial Reconciliation Summary */}
            <div className="flex justify-end pt-8 border-t-2 border-slate-100">
               <div className="w-80 space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                     <span>Subtotal</span>
                     <span className="font-black text-slate-400 italic">₹{(viewingBill.items.reduce((sum: number, item: any) => sum + item.total, 0) - viewingBill.items.reduce((sum: number, item: any) => sum + item.sgst + item.cgst, 0)).toFixed(2)}</span>
                  </div>
                  {viewingBill.items.reduce((sum: number, item: any) => sum + item.sgst + item.cgst, 0) > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-primary uppercase tracking-widest">
                       <span>Total Tax (GST)</span>
                       <span className="font-black italic">₹{viewingBill.items.reduce((sum: number, item: any) => sum + item.sgst + item.cgst, 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                     <span>Bill Amount</span>
                     <span className="font-black text-slate-900 border-b border-slate-100 pb-1">₹{viewingBill.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black text-rose-400 uppercase tracking-widest italic bg-rose-50/50 p-2 rounded-lg border border-rose-100/50">
                     <span>Previous Balance</span>
                     <span className="text-sm">₹{oldBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t-4 border-slate-900">
                     <span className="text-md font-black uppercase italic tracking-tighter text-primary">Grand Total</span>
                     <span className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{(Number(viewingBill.total_amount) + oldBalance).toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-6">
                     <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mb-1">Authorized Verification</p>
                        <div className="h-10 flex items-center justify-center">
                           <span className="text-xl font-anton text-slate-200 opacity-30 select-none">SCHROTT HUB</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <p className="mt-16 text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] text-center italic border-t border-slate-50 pt-8">Powered by High-End Inventory Infrastructure • SCHROTT v4.0 Professional Edition</p>
        </div>
      )}
      </Modal>
    </div>
  );
}
