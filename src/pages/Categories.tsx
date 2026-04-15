import React, { useEffect, useState } from 'react';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Tag } from 'lucide-react';
import { Category } from '../types';

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_blocked: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await productService.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCategory) {
        await productService.updateCategory(editingCategory.id, formData);
      } else {
        await productService.createCategory(formData);
      }
      setIsModalOpen(false);
      fetchCategories();
      resetForm();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      is_blocked: category.is_blocked
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', is_blocked: false });
    setEditingCategory(null);
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="gap-2">
          <Plus size={18} />
          Add Category
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Category Name', 'Description', 'Status', 'Actions']}>
            {filteredCategories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Tag size={18} />
                    </div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-500 text-sm max-w-xs truncate">{c.description || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <Badge status={!c.is_blocked ? 'ACTIVE' : 'INACTIVE'}>
                    {!c.is_blocked ? 'Active' : 'Blocked'}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
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
        title={editingCategory ? 'Edit Category' : 'New Category'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Electronics"
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
              Block this category
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
