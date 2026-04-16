import React, { useEffect, useState } from 'react';
import { supplierService } from '../services/suppliers';
import { Button, Input, Card, Modal, Table, Badge, Avatar, Pagination, cn } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Phone, MapPin, Truck, Eye, ShoppingBag, Wallet, Receipt } from 'lucide-react';
import { Supplier } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/toast';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<(Supplier & { balance: number }) | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  // Settlement State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<string>('bank_transfer');
  const [isSettling, setIsSettling] = useState(false);

  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    shop_name: '', 
    location: '' 
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (supplier: Supplier & { balance: number }) => {
    setSelectedSupplier(supplier);
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const data = await supplierService.getTransactions(supplier.id);
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedSupplier || settleAmount <= 0) return;
    setIsSettling(true);
    try {
      await supplierService.settleBalance(selectedSupplier.id, settleAmount, settleMethod);
      setSettleAmount(0);
      setIsSettleModalOpen(false);
      fetchSuppliers(); // Refresh list balances
      if (isDetailsOpen) {
         // Refresh details if open
         const data = await supplierService.getTransactions(selectedSupplier.id);
         setTransactions(data);
         // Find updated supplier data to refresh the "To Be Paid" card
         const allSuppliers = await supplierService.getAll();
         const updated = allSuppliers.find(s => s.id === selectedSupplier.id);
         if (updated) setSelectedSupplier(updated);
      }
      toast.success('Balance settled successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSettling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await supplierService.update(editingSupplier.id, formData);
      } else {
        await supplierService.create(formData);
      }
      setIsModalOpen(false);
      fetchSuppliers();
      resetForm();
      toast.success(editingSupplier ? 'Supplier updated' : 'Supplier added');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ 
      name: supplier.name || '', 
      phone: supplier.phone, 
      shop_name: supplier.shop_name, 
      location: supplier.location || '' 
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    confirmToast(
      'Are you sure you want to delete this supplier?',
      async () => {
        try {
          await supplierService.delete(id);
          fetchSuppliers();
          toast.success('Supplier deleted');
        } catch (error: any) {
          toast.error(error.message);
        }
      }
    );
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', shop_name: '', location: '' });
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    s.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Suppliers</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage your suppliers and track their payments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[300px] hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter by name, phone or shop..."
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 focus:border-primary/40 rounded-lg text-sm transition-all focus:ring-4 focus:ring-primary/5 shadow-sm outline-none font-medium"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="h-11 shadow-lg shadow-primary/20">
            <Plus size={18} strokeWidth={2.5} />
            Add Supplier
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
            <Table headers={['Supplier Name', 'Phone', 'Total Balance', 'Wallet Balance', 'Actions']}>
              {filteredSuppliers
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900 leading-tight">{s.shop_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{s.location || 'Local'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Phone size={12} className="text-slate-300" />
                        {s.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn("text-sm font-black italic", s.balance > 0 ? 'text-rose-600' : 'text-slate-300')}>
                        ₹{s.balance.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(s.wallet_balance || 0) > 0 ? (
                        <Badge status="PARTIAL">
                          ₹{(s.wallet_balance || 0).toFixed(2)} Credit
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest italic leading-none">Balanced</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1">
                          <button onClick={() => loadDetails(s)} className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all" title="View Details">
                            <Eye size={16} strokeWidth={2.5} />
                          </button>
                          <button 
                            onClick={() => { setSelectedSupplier(s); setSettleAmount(s.balance); setIsSettleModalOpen(true); }} 
                            className="p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-all" 
                            title="Record Payment"
                          >
                            <Wallet size={16} strokeWidth={2.5} />
                          </button>
                          <button onClick={() => handleEdit(s)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all">
                            <Edit2 size={16} strokeWidth={2.5} />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all">
                            <Trash2 size={16} strokeWidth={2.5} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-bold italic text-sm">No suppliers matching your criteria.</td>
                </tr>
              )}
            </Table>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredSuppliers.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        footer={
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Discard</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none shadow-lg shadow-primary/20">
              {submitting ? 'Saving...' : (editingSupplier ? 'Save Changes' : 'Add Supplier')}
            </Button>
          </div>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <Input
              label="Shop Name"
              value={formData.shop_name}
              onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
              placeholder="e.g. Industrial Steel Supplies"
              required
            />
          </div>
          <Input
            label="Owner/Contact Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contact person"
          />
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91..."
            required
          />
          <div className="md:col-span-2">
            <Input
              label="Location / Address"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Warehouse or office address"
            />
          </div>
        </form>
      </Modal>

      {/* Details View Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title="Supplier Details"
        className="max-w-4xl"
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm col-span-2">
               <div className="flex items-center gap-3">
                  <Avatar fallback={selectedSupplier?.shop_name || 'SP'} size="lg" />
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedSupplier?.shop_name}</h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                       <MapPin size={10} /> {selectedSupplier?.location || 'Local'}
                    </div>
                  </div>
               </div>
            </div>
            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl">
               <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Wallet Balance</div>
               <div className="text-2xl font-black text-indigo-700 mt-2 italic">₹{(selectedSupplier?.wallet_balance || 0).toFixed(2)}</div>
            </div>
            <div className="p-5 bg-rose-50 border border-rose-100 rounded-xl group relative overflow-hidden">
               <div className="relative z-10">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none">Current Balance</div>
                  <div className="text-2xl font-black text-rose-600 mt-2 italic">₹{selectedSupplier?.balance.toFixed(2)}</div>
               </div>
               <Wallet className="absolute right-0 bottom-0 text-rose-600/10 -mb-4 -mr-4" size={80} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <div className="space-y-0.5">
                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                   <ShoppingBag size={16} className="text-primary" />
                   Purchase History
                 </h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View recent purchases and payments</p>
               </div>
               <Button 
                 variant="primary" 
                 size="sm" 
                 className="shadow-md shadow-primary/20"
                 onClick={() => { setSettleAmount(selectedSupplier?.balance || 0); setIsSettleModalOpen(true); }}
               >
                 <Wallet size={14} strokeWidth={2.5} />
                 Record Payment
               </Button>
            </div>

            <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
               {loadingDetails ? (
                 <div className="flex justify-center p-16">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                 </div>
               ) : (
                 <Table headers={['Date', 'Purchase ID', 'Total Amount', 'Amount Paid', 'Balance', 'Status']}>
                   {transactions.map(t => (
                     <tr key={t.id} className="text-xs group hover:bg-slate-50/50 transition-colors">
                       <td className="px-6 py-4 text-slate-500 font-bold">{format(new Date(t.created_at), 'dd MMM yyyy')}</td>
                       <td className="px-6 py-4 font-black text-slate-900">#PUR-{t.id.slice(0, 8).toUpperCase()}</td>
                       <td className="px-6 py-4 font-black text-slate-900">₹{t.total_amount.toFixed(2)}</td>
                       <td className="px-6 py-4 text-emerald-600 font-black">₹{t.paid_amount.toFixed(2)}</td>
                       <td className="px-6 py-4 text-rose-600 font-black">₹{t.balance_amount.toFixed(2)}</td>
                       <td className="px-6 py-4">
                         <Badge status={t.status} />
                       </td>
                     </tr>
                   ))}
                   {transactions.length === 0 && (
                     <tr>
                       <td colSpan={6} className="px-6 py-16 text-center text-slate-300 font-bold uppercase tracking-widest italic text-[10px]">No transaction history discovered</td>
                     </tr>
                   )}
                 </Table>
               )}
            </Card>
          </div>
        </div>
      </Modal>

      {/* Settlement Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Record Payment"
        className="max-w-md"
      >
        <div className="space-y-8">
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-white relative overflow-hidden group">
              <div className="relative z-10 flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none">Supplier</p>
                    <h4 className="text-lg font-bold tracking-tight">{selectedSupplier?.shop_name}</h4>
                 </div>
                 <Receipt size={32} className="text-indigo-400 opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                 <span className="text-xs font-bold text-slate-400">Total Outstanding</span>
                 <span className="text-xl font-black italic">₹{selectedSupplier?.balance.toFixed(2)}</span>
              </div>
           </div>

           <div className="space-y-5">
              <Input
                label="Amount to Pay"
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Method</label>
                 <select
                   className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                   value={settleMethod}
                   onChange={(e) => setSettleMethod(e.target.value)}
                 >
                   <option value="bank_transfer">Bank Transfer</option>
                   <option value="cash">Cash</option>
                   <option value="upi">UPI</option>
                   <option value="card">Card</option>
                 </select>
              </div>
           </div>

           <Button 
             className="w-full h-14 rounded-xl font-black italic shadow-xl shadow-primary/20 text-base"
             onClick={handleSettle}
             disabled={isSettling || settleAmount <= 0}
           >
             {isSettling ? 'Saving...' : 'Save Payment'}
           </Button>
           
           <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Funds will be allocated to oldest outstanding bills first
           </p>
        </div>
      </Modal>
    </div>
  );
}
