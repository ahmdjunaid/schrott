import React, { useEffect, useState } from 'react';
import { brandService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, Pagination } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Building2 } from 'lucide-react';
import { Brand } from '../types';
import toast from 'react-hot-toast';

export function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_blocked: false
  });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const data = await brandService.getAll();
      setBrands(data);
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingBrand) {
        await brandService.update(editingBrand.id, formData);
      } else {
        await brandService.create(formData);
      }
      setIsModalOpen(false);
      fetchBrands();
      resetForm();
      toast.success(editingBrand ? 'Brand updated' : 'Brand added');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      is_blocked: brand.is_blocked
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', is_blocked: false });
    setEditingBrand(null);
  };

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Brands</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage product brands</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[300px] hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search brands..."
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
            Add Brand
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
            <Table headers={['Brand Name', 'Description', 'Items', 'Status', 'Actions']}>
              {filteredBrands
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100/50 text-slate-400 rounded-lg flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20 transition-all">
                        <Building2 size={16} strokeWidth={2.5} />
                      </div>
                      <div className="font-black text-slate-900 leading-tight italic">{b.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-500 text-xs font-bold max-w-xs truncate">{b.description || <span className="text-slate-300">No description</span>}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="text-xs font-black text-slate-900 italic leading-none">{b.product_count || 0}</span>
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Products</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge status={!b.is_blocked ? 'ACTIVE' : 'INACTIVE'}>
                      {!b.is_blocked ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                     <button onClick={() => handleEdit(b)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all" title="Edit Brand">
                      <Edit2 size={16} strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBrands.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-bold italic text-sm">No brands found.</td>
                </tr>
              )}
            </Table>
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(filteredBrands.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBrand ? 'Edit Brand' : 'Add New Brand'}
        footer={
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none shadow-lg shadow-primary/20">
              {submitting ? 'Saving...' : (editingBrand ? 'Save Changes' : 'Add Brand')}
            </Button>
          </div>
        }
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <Input
            label="Brand Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Tata Steel"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Specify brand details..."
          />
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
            <div className="space-y-0.5">
               <label htmlFor="is_blocked" className="text-xs font-black text-slate-700 uppercase tracking-widest cursor-pointer">Deactivate Brand</label>
               <p className="text-[10px] font-bold text-slate-400">Stop using this brand for new products</p>
            </div>
            <input
              type="checkbox"
              id="is_blocked"
              className="w-5 h-5 rounded-md border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer"
              checked={formData.is_blocked}
              onChange={(e) => setFormData({ ...formData, is_blocked: e.target.checked })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
