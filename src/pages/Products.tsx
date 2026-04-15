import React, { useEffect, useState } from 'react';
import { productService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Package, Tag, Building2 } from 'lucide-react';
import { Product, Category, Brand } from '../types';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    purchase_price: 0,
    selling_price: 0,
    sgst: 0,
    cgst: 0,
    stock: 0,
    category_id: '',
    brand_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pData, cData, bData] = await Promise.all([
        productService.getAll(),
        productService.getAllCategories(),
        productService.getAllBrands()
      ]);
      setProducts(pData);
      setCategories(cData);
      setBrands(bData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingProduct) {
        await productService.update(editingProduct.id, formData);
      } else {
        await productService.create(formData);
      }
      setIsModalOpen(false);
      fetchData();
      resetForm();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      sgst: product.sgst,
      cgst: product.cgst,
      stock: product.stock,
      category_id: product.category_id || '',
      brand_id: product.brand_id || '',
      is_active: product.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.delete(id);
        fetchData();
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      purchase_price: 0,
      selling_price: 0,
      sgst: 0,
      cgst: 0,
      stock: 0,
      category_id: '',
      brand_id: '',
      is_active: true
    });
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="gap-2">
          <Plus size={18} />
          Add Product
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table headers={['Product Information', 'Stock', 'Pricing', 'Status', 'Actions']}>
            {filteredProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="flex items-center gap-4 mt-1">
                    {p.category && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Tag size={12} />
                        {p.category.name}
                      </span>
                    )}
                    {p.brand && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Building2 size={12} />
                        {p.brand.name}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold",
                    p.stock <= 5 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-700"
                  )}>
                    <Package size={14} />
                    {p.stock} Units
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-slate-900">₹{p.selling_price}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MSRP: ₹{p.purchase_price}</div>
                </td>
                <td className="px-6 py-4">
                  <Badge status={p.is_active ? 'ACTIVE' : 'INACTIVE'} />
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => handleEdit(p)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
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
        title={editingProduct ? 'Edit Product' : 'New Product'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <Input
              label="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="iPhone 15 Pro"
              required
            />
          </div>
          <Input
            label="Purchase Price"
            type="number"
            value={formData.purchase_price}
            onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Selling Price"
            type="number"
            value={formData.selling_price}
            onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Stock"
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
            required
          />
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-500 ml-1">Category</label>
            <select
              className="w-full h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            >
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-500 ml-1">Brand</label>
            <select
              className="w-full h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
              value={formData.brand_id}
              onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
            >
              <option value="">Select Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <Input
            label="SGST (%)"
            type="number"
            value={formData.sgst}
            onChange={(e) => setFormData({ ...formData, sgst: parseFloat(e.target.value) })}
          />
          <Input
            label="CGST (%)"
            type="number"
            value={formData.cgst}
            onChange={(e) => setFormData({ ...formData, cgst: parseFloat(e.target.value) })}
          />
        </form>
      </Modal>
    </div>
  );
}

// Utility function for conditional classes used in Products.tsx
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
