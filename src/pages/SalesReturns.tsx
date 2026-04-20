import React, { useEffect, useState } from 'react';
import { customerService } from '../services/customers';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, cn, SearchableSelect } from '../components/UI';
import { Plus, RotateCcw, Trash2, Info, CreditCard, Wallet, Calendar, History } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabaseClient';

export function SalesReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [returnDescription, setReturnDescription] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  // Batch Selection for Sales Return
  const [purchasedBatches, setPurchasedBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Refund State
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');
  const [issueRefund, setIssueRefund] = useState(false);

  // Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchReturns();
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCustomerId && selectedProduct) {
      fetchSoldBatches(selectedCustomerId, selectedProduct);
    } else {
      setPurchasedBatches([]);
      setSelectedBatchId('');
    }
  }, [selectedCustomerId, selectedProduct]);

  const fetchReturns = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select(`
          *,
          customer:customers(shop_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReturns(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [cData, pData] = await Promise.all([
        customerService.getAll(),
        productService.getAll()
      ]);
      setCustomers(cData);
      setProducts(pData);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchSoldBatches = async (cid: string, pid: string) => {
    setLoadingBatches(true);
    try {
      const batches = await productService.getSoldBatches(cid, pid);
      setPurchasedBatches(batches);
      if (batches.length > 0) {
        setSelectedBatchId(batches[0].id);
        setPrice(batches[0].price);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to fetch purchase history');
    } finally {
      setLoadingBatches(false);
    }
  };

  const addItem = () => {
    const product = products.find(p => p.id === selectedProduct);
    const batch = purchasedBatches.find(b => b.id === selectedBatchId);
    
    if (!product || !batch) {
      toast.error('Invalid selection');
      return;
    }

    if (qty <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }

    if (qty > batch.quantity) { // batch.quantity is the original sold qty in this context
      toast.error(`Cannot return more than originally sold (${batch.quantity} units)`);
      return;
    }

    const newItem = {
      product_id: product.id,
      name: product.name,
      batch_id: batch.batch_id,
      bill_item_id: batch.id,
      quantity: qty,
      price: price || product.selling_price,
      total: qty * (price || product.selling_price),
      purchase_date: batch.purchase_date
    };

    setReturnItems([...returnItems, newItem]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
    setSelectedBatchId('');
  };

  const removeItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedCustomerId || returnItems.length === 0) {
      toast.error('Please select customer and add items');
      return;
    }

    setSubmitting(true);
    try {
      await customerService.processReturn(
        selectedCustomerId, 
        returnItems, 
        issueRefund ? refundAmount : 0,
        issueRefund ? refundMethod : null,
        returnDescription
      );
      toast.success('Sales return processed successfully');
      setIsModalOpen(false);
      resetForm();
      fetchReturns();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setReturnDescription('');
    setReturnItems([]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
    setRefundAmount(0);
    setIssueRefund(false);
  };

  const totalReturnAmount = returnItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-8 py-2 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
             <RotateCcw className="text-primary" size={32} />
             Sales Returns
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Restock items to their original purchase batch</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="h-11 shadow-lg shadow-primary/20">
          <Plus size={18} strokeWidth={2.5} />
          Record New Return
        </Button>
      </div>

      <Card className="p-0 border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
        <Table headers={['Date', 'Return ID', 'Customer', 'Refund', 'Total']}>
          {returns.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 transition-colors italic">
              <td className="px-6 py-4 text-xs font-bold text-slate-500">
                {format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}
              </td>
              <td className="px-6 py-4 font-black text-slate-900 text-xs uppercase tracking-tighter">
                #RET-{r.id.slice(0, 8)}
              </td>
              <td className="px-6 py-4">
                 <div className="text-xs font-black text-slate-700 uppercase italic">{r.customer?.shop_name}</div>
              </td>
              <td className="px-6 py-4 font-black text-rose-500 text-sm">
                {r.refund_amount > 0 ? `₹${parseFloat(r.refund_amount).toFixed(2)}` : <span className="opacity-20 text-slate-300">-</span>}
              </td>
              <td className="px-6 py-4 font-black text-slate-900">₹{parseFloat(r.total_amount).toFixed(2)}</td>
            </tr>
          ))}
          {!loading && returns.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-24 text-center">
                 <div className="flex flex-col items-center gap-3 opacity-20">
                    <RotateCcw size={48} />
                    <p className="text-xs font-black uppercase tracking-widest">No returns recorded yet</p>
                 </div>
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Sales Return"
        className="max-w-6xl"
        footer={
          <div className="flex gap-3 justify-end w-full sm:w-auto">
             <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
             <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none shadow-xl shadow-primary/20">
                {submitting ? 'Processing...' : 'Complete Return'}
             </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer</label>
                    <SearchableSelect 
                       options={customers.map(c => ({ value: c.id, label: c.shop_name }))}
                       value={selectedCustomerId}
                       onChange={setSelectedCustomerId}
                       placeholder="Select Customer..."
                    />
                 </div>
                 <Input 
                   label="Description (Optional)"
                   value={returnDescription}
                   onChange={(e) => setReturnDescription(e.target.value)}
                   placeholder="Damaged, wrong product, etc."
                 />
              </div>

              <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-5">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-4 space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product</label>
                       <SearchableSelect 
                          options={products.map(p => ({ value: p.id, label: `${p.name} (Global Stock: ${p.stock})` }))}
                          value={selectedProduct}
                          onChange={setSelectedProduct}
                          placeholder="Select Product..."
                       />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                          <History size={10} className="text-primary" />
                          Purchase History (Batch Selection)
                       </label>
                       <SearchableSelect 
                          options={purchasedBatches.map(b => ({
                            id: b.id,
                            name: `${format(new Date(b.purchase_date), 'dd MMM yy')} — ₹${b.price.toFixed(2)}`,
                            subtitle: b.subtitle,
                            stock: b.quantity
                          }))}
                          value={selectedBatchId}
                          onChange={(id) => {
                             setSelectedBatchId(id);
                             const b = purchasedBatches.find(x => x.id === id);
                             if (b) setPrice(b.price);
                          }}
                          placeholder={loadingBatches ? "Checking Ledger..." : "Select Original Bill Batch"}
                          disabled={!selectedProduct}
                       />
                    </div>
                    <div className="md:col-span-1">
                       <Input 
                         label="Qty"
                         type="number"
                         value={qty}
                         onChange={(e) => setQty(parseInt(e.target.value))}
                       />
                    </div>
                    <div className="md:col-span-2">
                       <Input 
                         label="R.Rate"
                         type="number"
                         value={price}
                         onChange={(e) => setPrice(parseFloat(e.target.value))}
                       />
                    </div>
                    <div className="md:col-span-1">
                       <Button onClick={addItem} variant="secondary" className="w-full h-11 mb-0.5">Add</Button>
                    </div>
                 </div>

                 <Table headers={['Asset', 'Original Date', 'Qty', 'Rate', 'Total', '']}>
                    {returnItems.map((item, idx) => (
                      <tr key={idx} className="group italic text-[11px] font-bold">
                        <td className="px-4 py-3 text-slate-900 font-black uppercase tracking-tight">{item.name}</td>
                        <td className="px-4 py-3">
                           <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                              {item.purchase_date ? format(new Date(item.purchase_date), 'dd MMM yyyy') : 'N/A'}
                           </span>
                        </td>
                        <td className="px-4 py-3">{item.quantity} UNITS</td>
                        <td className="px-4 py-3">₹{item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 font-black">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                           <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors">
                              <Trash2 size={14} />
                           </button>
                        </td>
                      </tr>
                    ))}
                    {returnItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-300 uppercase tracking-widest text-[9px] font-black italic">
                           Select product and purchase history to restock original batch
                        </td>
                      </tr>
                    )}
                 </Table>
              </div>

              {/* Refund Management Terminal */}
              <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5 text-white">
                    <Wallet size={120} />
                 </div>
                 <div className="relative">
                    <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                             <CreditCard size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                             <h4 className="text-xs font-black text-white uppercase tracking-widest italic">Cash Back Terminal</h4>
                             <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em]">Refund for fully settled accounts</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setIssueRefund(!issueRefund)}
                         className={cn(
                           "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                           issueRefund ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                         )}
                       >
                          {issueRefund ? 'Refunding Cash' : 'Issue Cash Refund'}
                       </button>
                    </div>

                    {issueRefund && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                          <div className="space-y-1.5">
                             <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Refund amount (₹)</label>
                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black italic text-xs">₹</span>
                                <input 
                                  type="number"
                                  className="w-full h-11 pl-8 pr-4 bg-slate-800 border border-slate-700 rounded-xl text-white font-black italic outline-none focus:ring-4 focus:ring-primary/20 transition-all font-mono"
                                  value={refundAmount}
                                  onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
                                />
                             </div>
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Method</label>
                             <select
                               className="w-full h-11 px-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-primary/20 transition-all italic"
                               value={refundMethod}
                               onChange={(e) => setRefundMethod(e.target.value as any)}
                             >
                                <option value="cash">Hard Cash</option>
                                <option value="upi">UPI / Online</option>
                                <option value="bank_transfer">Bank Transfer</option>
                             </select>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <Card className="bg-white border text-slate-900 border-slate-200 shadow-2xl relative overflow-hidden group">
                 <div className="relative space-y-6">
                    <div>
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] italic block mb-2">Total Credit Adjustment</span>
                       <div className="text-4xl font-black italic tracking-tighter leading-none text-slate-900">₹{totalReturnAmount.toFixed(2)}</div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-slate-100 italic">
                       <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>Return Credit</span>
                          <span className="text-slate-900 font-black">₹{totalReturnAmount.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                          <span>Cash Refunded</span>
                          <span className="font-black">- ₹{issueRefund ? refundAmount.toFixed(2) : '0.00'}</span>
                       </div>
                       <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Net Due Adjustment</span>
                          <span className="text-xl font-black tracking-tighter">₹{(totalReturnAmount - (issueRefund ? refundAmount : 0)).toFixed(2)}</span>
                       </div>
                    </div>
                 </div>
              </Card>

              <div className="p-5 bg-amber-50 border border-amber-100 rounded-3xl space-y-3 shadow-sm">
                 <div className="flex items-center gap-2 text-amber-700">
                    <Info size={16} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Restocking Policy</span>
                 </div>
                 <p className="text-[9px] font-bold text-amber-600 leading-relaxed italic uppercase tracking-tight">
                    Items will be restocked to the EXACT source batch chosen above. This ensures that profit calculations and stock age remain 100% accurate.
                 </p>
              </div>
           </div>
        </div>
      </Modal>
    </div>
  );
}
