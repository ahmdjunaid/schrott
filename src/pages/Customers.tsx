import React, { useEffect, useState } from 'react';
import { customerService } from '../services/customers';
import { Button, Input, Card, Modal, Table, Badge, Avatar, Pagination, cn } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Phone, MapPin, Users, Eye, Receipt } from 'lucide-react';
import { Customer } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function Customers() {
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

  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    shop_name: '', 
    location: '' 
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

  const loadDetails = async (customer: Customer & { balance: number }) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const data = await customerService.getTransactions(customer.id);
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, formData);
      } else {
        await customerService.create(formData);
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
      location: customer.location || '' 
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await customerService.delete(id);
        fetchCustomers();
        toast.success('Customer deleted');
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', shop_name: '', location: '' });
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
            <Table headers={['Shop Name', 'Phone', 'Total Balance', 'Actions']}>
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
                      <div className={cn("text-sm font-black italic", c.balance > 0 ? 'text-rose-600' : 'text-slate-300')}>
                        ₹{c.balance.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1">
                          <button onClick={() => loadDetails(c)} className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all" title="View Details">
                            <Eye size={16} strokeWidth={2.5} />
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

      {/* Details View Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title="Customer Details"
        className="max-w-4xl"
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm col-span-2">
               <div className="flex items-center gap-3">
                  <Avatar fallback={selectedCustomer?.shop_name || 'CL'} size="lg" />
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedCustomer?.shop_name}</h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                       <MapPin size={10} /> {selectedCustomer?.location || 'Regional Terminal'}
                    </div>
                  </div>
               </div>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Registered Contact</div>
               <div className="text-sm font-bold text-slate-900 mt-2">{selectedCustomer?.phone}</div>
            </div>
            <div className="p-5 bg-rose-50 border border-rose-100 rounded-xl">
               <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none">Total Balance</div>
               <div className="text-2xl font-black text-rose-600 mt-2 italic">₹{selectedCustomer?.balance.toFixed(2)}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="px-2 space-y-0.5">
               <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                 <Receipt size={16} className="text-primary" />
                 Bill History
               </h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View recent bills and payments</p>
            </div>
            {loadingDetails ? (
              <div className="flex justify-center p-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
                 <Table headers={['Date', 'Bill No', 'Total Amount', 'Amount Paid', 'Balance', 'Status']}>
                  {transactions.map(t => (
                    <tr key={t.id} className="text-xs group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-bold">{format(new Date(t.created_at), 'dd MMM yyyy')}</td>
                      <td className="px-6 py-4 font-black text-slate-900">#BILL-{t.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-6 py-4 font-black text-slate-900 text-sm">₹{t.total_amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-emerald-600 font-black">₹{t.paid_amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-rose-600 font-black">₹{t.balance_amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <Badge status={t.status} />
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-10 py-16 text-center text-slate-300 font-bold uppercase tracking-widest italic text-[10px]">No active billing cycles discovered</td>
                    </tr>
                  )}
                </Table>
              </Card>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
