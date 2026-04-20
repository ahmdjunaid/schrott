import React, { useEffect, useState } from 'react';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, cn, SearchableSelect, Pagination } from '../components/UI';
import { Plus, Trash2, Info, Package, AlertTriangle, Layers } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabaseClient';

export function DamagedStock() {
  const [damagedRecords, setDamagedRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');

  // Data
  const [products, setProducts] = useState<any[]>([]);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    fetchDamagedRecords();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchBatches(selectedProductId);
    } else {
      setAvailableBatches([]);
      setSelectedBatchId('');
    }
  }, [selectedProductId]);

  const fetchDamagedRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('damaged_stock')
        .select(`
          *,
          product:products(name),
          batch:purchase_items(description, purchase_price)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDamagedRecords(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchBatches = async (pid: string) => {
    setLoadingBatches(true);
    try {
      const batches = await productService.getAvailableBatches(pid);
      setAvailableBatches(batches);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedBatchId || qty <= 0) {
      toast.error('Please complete all fields');
      return;
    }

    const batch = availableBatches.find(b => b.id === selectedBatchId);
    if (!batch || qty > batch.remaining_qty) {
      toast.error(`Not enough stock in chosen batch (Available: ${batch?.remaining_qty || 0})`);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('mark_as_damaged', {
        p_product_id: selectedProductId,
        p_batch_id: selectedBatchId,
        p_quantity: qty,
        p_reason: reason
      });
      
      if (error) throw error;
      
      toast.success('Damaged stock recorded. Inventory updated.');
      setIsModalOpen(false);
      resetForm();
      fetchDamagedRecords();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedBatchId('');
    setQty(1);
    setReason('');
  };

  const paginatedRecords = damagedRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8 py-2 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3 italic uppercase">
             <AlertTriangle className="text-rose-500" size={32} />
             Damaged Stock
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Mark inventory as damaged or lost to adjust stock</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="h-11 shadow-lg shadow-rose-500/20 bg-rose-600 hover:bg-rose-700">
          <Plus size={18} strokeWidth={2.5} />
          Report Damage
        </Button>
      </div>

      <Card className="p-0 border-slate-200 overflow-hidden shadow-xl">
        <Table headers={['Date', 'Product', 'Batch Info', 'Quantity', 'Reason']}>
          {paginatedRecords.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 transition-colors italic">
              <td className="px-6 py-4 text-xs font-bold text-slate-500">
                {format(new Date(r.created_at), 'dd MMM yyyy')}
              </td>
              <td className="px-6 py-4">
                 <div className="text-xs font-black text-slate-900 uppercase italic tracking-tight">{r.product?.name}</div>
              </td>
              <td className="px-6 py-4">
                 <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-slate-200">
                    {r.batch?.description || 'SOURCE PKG'} — ₹{parseFloat(r.batch?.purchase_price || 0).toFixed(2)}
                 </span>
              </td>
              <td className="px-6 py-4 font-black text-rose-600 text-sm italic">-{r.quantity} UNITS</td>
              <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase italic tracking-tighter truncate max-w-[200px]">
                 {r.reason || 'NO REASON PROVIDED'}
              </td>
            </tr>
          ))}
          {!loading && damagedRecords.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-24 text-center">
                 <div className="flex flex-col items-center gap-3 opacity-20">
                    <Trash2 size={48} />
                    <p className="text-xs font-black uppercase tracking-widest">No damage entries found</p>
                 </div>
              </td>
            </tr>
          )}
        </Table>
        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(damagedRecords.length / itemsPerPage)}
          onPageChange={setCurrentPage}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Report Damaged Stock"
        className="max-w-xl"
        footer={
          <div className="flex gap-3 justify-end w-full sm:w-auto">
             <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
             <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20">
                {submitting ? 'Updating...' : 'Deduct from Stock'}
             </Button>
          </div>
        }
      >
        <div className="space-y-6">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product</label>
              <SearchableSelect 
                 options={products.map(p => ({ value: p.id, label: `${p.name} (Total: ${p.stock})` }))}
                 value={selectedProductId}
                 onChange={setSelectedProductId}
                 placeholder="Select Product..."
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Layers size={10} className="text-primary" />
                    Source Batch
                 </label>
                 <SearchableSelect 
                    options={availableBatches.map(b => ({
                      id: b.id,
                      name: `Available: ${b.remaining_qty}u`,
                      subtitle: `Cost: ₹${parseFloat(b.purchase_price).toFixed(2)} | Date: ${b.purchase?.created_at ? new Date(b.purchase.created_at).toLocaleDateString() : 'N/A'} | ${b.description || 'No Desc'} | Src: ${b.purchase?.supplier?.shop_name || 'Manual'}`
                    }))}
                    value={selectedBatchId}
                    onChange={setSelectedBatchId}
                    placeholder={loadingBatches ? "Loading..." : "Select Batch lot"}
                    disabled={!selectedProductId}
                 />
              </div>
              <Input 
                label="Quantity to Deduct"
                type="number"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value))}
              />
           </div>

           <Input 
             label="Reason for Adjustment"
             value={reason}
             onChange={(e) => setReason(e.target.value)}
             placeholder="Expired, Damaged at warehouse, etc."
           />

           <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-rose-100 flex items-center justify-center text-rose-500 shrink-0 shadow-sm">
                 <Info size={18} strokeWidth={2.5} />
              </div>
              <p className="text-[10px] font-bold text-rose-600 leading-relaxed italic uppercase tracking-tight py-1">
                 This action is permanent and will immediately reduce global product stock and the specific batch quantity chosen.
              </p>
           </div>
        </div>
      </Modal>
    </div>
  );
}
