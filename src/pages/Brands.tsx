import React, { useEffect, useState } from 'react';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Building2 } from 'lucide-react';
import { Brand } from '../types';

export function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const data = await productService.getAllBrands();
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
        await productService.updateBrand(editingBrand.id, formData);
      } else {
        await productService.createBrand(formData);
      }
      setIsModalOpen(false);
      fetchBrands();
      resetForm();
    } catch (error: any) {
      alert(error.message);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search brands..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="gap-2">
          <Plus size={18} />
          Add Brand
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Brand Name', 'Description', 'Status', 'Actions']}>
            {filteredBrands.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Building2 size={18} />
                    </div>
                    <div className="font-bold text-slate-900">{b.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-500 text-sm max-w-xs truncate">{b.description || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <Badge status={!b.is_blocked ? 'ACTIVE' : 'INACTIVE'}>
                    {!b.is_blocked ? 'Active' : 'Blocked'}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleEdit(b)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBrand ? 'Edit Brand' : 'New Brand'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : (editingBrand ? 'Update Brand' : 'Create Brand')}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Brand Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Apple"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description..."
          />
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="is_blocked"
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              checked={formData.is_blocked}
              onChange={(e) => setFormData({ ...formData, is_blocked: e.target.checked })}
            />
            <label htmlFor="is_blocked" className="text-sm font-semibold text-slate-600 cursor-pointer">
              Block this brand
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
