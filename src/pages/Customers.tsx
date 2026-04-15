import React, { useEffect, useState } from 'react';
import { customerService } from '../services/customers';
import { Button, Input, Card, Modal, Table, Badge } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Phone, MapPin, Users, Eye, Receipt } from 'lucide-react';
import { Customer } from '../types';
import { format } from 'date-fns';

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
    } catch (error: any) {
      alert(error.message);
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
      } catch (error: any) {
        alert(error.message);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="gap-2">
          <Plus size={18} />
          Add Customer
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Shop Name', 'Contact', 'Outstanding Balance', 'Actions']}>
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{c.shop_name}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">{c.location || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-600">{c.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`font-bold ${c.balance > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    ₹{c.balance.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => loadDetails(c)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title="View Details">
                    <Eye size={18} />
                  </button>
                  <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'New Customer'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Create Customer')}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Shop Name"
            value={formData.shop_name}
            onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
            placeholder="Doe Enterprises"
            required
          />
          <Input
            label="Contact Person (Optional)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </form>
      </Modal>

      {/* Details View Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={`${selectedCustomer?.shop_name} - Transaction History`}
        className="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{selectedCustomer?.phone}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{selectedCustomer?.location || '-'}</div>
            </div>
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Total Outstanding</div>
              <div className="text-xl font-black text-red-600 mt-1">₹{selectedCustomer?.balance.toFixed(2)}</div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Receipt size={16} />
              Recent Bills
            </h3>
            {loadingDetails ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table headers={['Date', 'Bill #', 'Total', 'Paid', 'Balance', 'Status']}>
                {transactions.map(t => (
                  <tr key={t.id} className="text-xs">
                    <td className="px-6 py-4 text-slate-500">{format(new Date(t.created_at), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-4 font-bold text-primary">INV-{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 font-bold">₹{t.total_amount}</td>
                    <td className="px-6 py-4 text-green-600 font-bold">₹{t.paid_amount}</td>
                    <td className="px-6 py-4 text-red-600 font-bold">₹{t.balance_amount}</td>
                    <td className="px-6 py-4">
                      <Badge status={t.status} />
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">No transaction history found.</td>
                  </tr>
                )}
              </Table>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
