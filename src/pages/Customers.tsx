import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../services/customers';
import { Button, Input, Card, Modal, Table, Badge, Avatar, Pagination, cn } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Phone, MapPin, Users, Eye, Receipt, Banknote, QrCode, CreditCard } from 'lucide-react';
import { Customer } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/toast';

export function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<(Customer & { balance: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { balance: number }) | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number | string>('');
  const [settleMethod, setSettleMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    shop_name: '',
    location: '',
    is_active: true
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewLedger = (id: string) => {
    navigate(`/customers/${id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.shop_name || formData.shop_name.trim().length < 2) {
      toast.error('Please enter a valid Shop Name');
      return;
    }
    
    const phoneClean = formData.phone.replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...formData, phone: phoneClean };
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, payload);
      } else {
        await customerService.create(payload);
      }
      setIsModalOpen(false);
      fetchCustomers();
      resetForm();
      toast.success(editingCustomer ? 'Customer updated' : 'Customer added');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone,
      shop_name: customer.shop_name,
      location: customer.location || '',
      is_active: customer.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    confirmToast(
      'Are you sure you want to delete this customer?',
      async () => {
        try {
          await customerService.delete(id);
          fetchCustomers();
          toast.success('Customer deleted');
        } catch (error: any) {
          toast.error(error.message);
        }
      }
    );
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', shop_name: '', location: '', is_active: true });
    setEditingCustomer(null);
  };

  const filteredCustomers = customers.filter(c =>
    c.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Customers</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage your customers and track their balances</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[300px] hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter by shop, phone or name..."
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
            Add Customer
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
            <Table headers={['Shop Name', 'Phone', 'Net Balance', 'Actions']}>
              {filteredCustomers
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900 leading-tight">{c.shop_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{c.location || 'Local'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Phone size={12} className="text-slate-300" />
                        {c.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-black italic", 
                        c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      )}>
                        ₹{Math.abs(c.balance || 0).toFixed(2)}
                        <span className="text-[8px] ml-2 opacity-50 uppercase tracking-tighter">
                          {c.balance > 0 ? 'Due' : 'Credit'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => viewLedger(c.id)} className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all" title="View Ledger">
                          <Eye size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => { setSelectedCustomer(c); setSettleAmount(c.balance); setIsSettleModalOpen(true); }}
                          className="p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-all"
                          title="Settle Payment"
                          disabled={c.balance <= 0}
                        >
                          <Receipt size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all">
                          <Edit2 size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all">
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-bold italic text-sm">No client entities matching your search criteria.</td>
                </tr>
              )}
            </Table>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredCustomers.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        footer={
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none shadow-lg shadow-primary/20">
              {submitting ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Add Customer')}
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
              placeholder="e.g. Standard Trading Corp"
              required
            />
          </div>
          <Input
            label="Owner Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Official identity"
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
              placeholder="Full address"
            />
          </div>
        </form>
      </Modal>



      {/* Settle Payment Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Settle Outstanding Balance"
        footer={
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setIsSettleModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
            <Button
              onClick={async () => {
                if (!selectedCustomer || !settleAmount || Number(settleAmount) <= 0) {
                  toast.error('Please enter a valid amount');
                  return;
                }
                setSubmitting(true);
                try {
                  await customerService.settlePayment(selectedCustomer.id, Number(settleAmount), settleMethod);
                  toast.success('Payment settled successfully');
                  setIsSettleModalOpen(false);
                  fetchCustomers();
                } catch (error: any) {
                  toast.error(error.message);
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="flex-1 sm:flex-none shadow-lg shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 font-black italic"
            >
              {submitting ? 'Settling...' : 'Confirm Payment'}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/30 transition-all duration-700" />
            <div className="relative">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 italic">Current Outstanding</div>
              <div className="text-4xl font-black italic tracking-tighter">₹{selectedCustomer?.balance.toFixed(2)}</div>
              <div className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedCustomer?.shop_name}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Amount to Settle (₹)"
              type="number"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod('cash')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                    settleMethod === 'cash'
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  <Banknote size={20} strokeWidth={settleMethod === 'cash' ? 2.5 : 2} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('upi')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                    settleMethod === 'upi'
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  <QrCode size={20} strokeWidth={settleMethod === 'upi' ? 2.5 : 2} />
                  <span className="text-[9px] font-black uppercase tracking-widest">UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('card')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                    settleMethod === 'card'
                      ? "bg-slate-50 border-slate-800 text-slate-900 shadow-sm"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  <CreditCard size={20} strokeWidth={settleMethod === 'card' ? 2.5 : 2} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Card</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
            <Receipt className="text-amber-600 shrink-0" size={20} />
            <div className="text-[10px] font-bold text-amber-900 uppercase leading-relaxed tracking-tight">
              This payment will be applied to the oldest outstanding bills first (FIFO settlement).
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
