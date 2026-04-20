import React, { useEffect, useState } from 'react';
import { productService, categoryService, brandService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, Pagination, cn } from '../components/UI';
import { Plus, Edit2, Trash2, Search, Package, Tag, Building2, Eye, Info } from 'lucide-react';
import { Product, Category, Brand } from '../types';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/toast';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedProductForBatch, setSelectedProductForBatch] = useState<Product | null>(null);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    selling_price: 0,
    sgst: 0,
    cgst: 0,
    category_id: '',
    brand_id: '',
    is_active: true,
    stock: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pData, cData, bData] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
        brandService.getAll()
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
      toast.success(editingProduct ? 'Product updated' : 'Product added');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      selling_price: product.selling_price || 0,
      sgst: product.sgst || 0,
      cgst: product.cgst || 0,
      category_id: product.category_id || '',
      brand_id: product.brand_id || '',
      is_active: product.is_active,
      stock: product.stock || 0
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    confirmToast(
      'Are you sure you want to delete this product?',
      async () => {
        try {
          await productService.delete(id);
          fetchData();
          toast.success('Product deleted');
        } catch (error: any) {
          toast.error(error.message);
        }
      }
    );
  };

  const handleViewBatches = async (product: Product) => {
    setSelectedProductForBatch(product);
    setLoadingBatches(true);
    setIsBatchModalOpen(true);
    try {
      const batches = await productService.getAvailableBatches(product.id);
      setProductBatches(batches);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batch details');
    } finally {
      setLoadingBatches(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      selling_price: 0,
      sgst: 0,
      cgst: 0,
      category_id: '',
      brand_id: '',
      is_active: true,
      stock: 0
    });
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Products</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage your product catalog and stock levels</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[300px] hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter products by name..."
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
            Add Product
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
            <Table headers={['Product Name', 'Stock Level', 'Selling Price', 'Status', 'Actions']}>
              {filteredProducts
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-900 leading-tight">{p.name}</div>
                    <div className="flex items-center gap-4 mt-1.5">
                      {p.category && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                          <Tag size={10} className="text-slate-300" />
                          {p.category.name}
                        </span>
                      )}
                      {p.brand && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                          <Building2 size={10} className="text-slate-300" />
                          {p.brand.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black shadow-sm border",
                      p.stock <= 5 
                        ? "bg-rose-50 text-rose-600 border-rose-100" 
                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    )}>
                      <Package size={12} strokeWidth={3} />
                      {p.stock} Units
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="text-sm font-black text-slate-900 italic">₹{p.selling_price?.toFixed(2) || '0.00'}</div>
                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Price</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge status={p.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleViewBatches(p)} 
                          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all"
                          title="View Batch Details"
                        >
                          <Eye size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => handleEdit(p)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all" title="Edit Product">
                          <Edit2 size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all" title="Delete Product">
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-bold italic text-sm">No products found.</td>
                </tr>
              )}
            </Table>
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

       <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        footer={
          <div className="flex gap-3 w-full sm:w-auto">
             <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none shadow-lg shadow-primary/20">
              {submitting ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Add Product')}
            </Button>
          </div>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
           <div className="md:col-span-2">
            <Input
              label="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Master Grade Steel 316L"
              required
            />
          </div>
           <Input
            label="Selling Price (₹)"
            type="number"
            value={formData.selling_price}
            onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) })}
            placeholder="0.00"
          />
           <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
            <select
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            >
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
           <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label>
            <select
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-lg text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none"
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

      {/* Batch Intelligence Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={selectedProductForBatch ? `Batch Intelligence: ${selectedProductForBatch.name}` : 'Batch Details'}
        className="max-w-4xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner">
               <Info size={14} className="text-primary" strokeWidth={2.5} />
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic outline-none">Total Value is based on purchase price</span>
            </div>
            <Button variant="ghost" onClick={() => setIsBatchModalOpen(false)}>Close Terminal</Button>
          </div>
        }
      >
        {loadingBatches ? (
           <div className="flex flex-col items-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4 shadow-sm"></div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Synchronizing Batch Data...</p>
           </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                    <th className="px-4 py-3">Source / Supplier</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Batch Stock</th>
                    <th className="px-4 py-3 text-right">Purchase (₹)</th>
                    <th className="px-4 py-3 text-right">Selling (₹)</th>
                    <th className="px-4 py-3 text-right">Total Val (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {productBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] grayscale opacity-50">
                        No Active Batches Found for this Asset
                      </td>
                    </tr>
                  ) : (
                    productBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="text-[11px] font-black text-slate-900 uppercase tracking-tighter leading-none">{batch.purchase?.supplier?.shop_name || 'MANUAL STOCK'}</div>
                          <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">Record: {batch.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-4">
                           <div className="text-[10px] font-bold text-slate-500 max-w-[140px] truncate uppercase">{batch.description || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn(
                             "px-2 py-1 rounded-md text-[10px] font-black border",
                             batch.remaining_qty <= 5 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                             {batch.remaining_qty} UNITS
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                           <div className="text-xs font-black text-slate-900 tracking-tighter italic">₹{batch.purchase_price.toFixed(2)}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                           <div className="text-xs font-black text-emerald-600 tracking-tighter italic">₹{selectedProductForBatch?.selling_price.toFixed(2)}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                           <div className="text-xs font-black text-slate-900 tracking-tighter bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">₹{(batch.remaining_qty * batch.purchase_price).toFixed(2)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {selectedProductForBatch && (
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                 <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Aggregate Inventory Stock</span>
                    <div className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none mt-1">
                      {productBatches.reduce((sum, b) => sum + (b.remaining_qty || 0), 0)} UNITS
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Asset Valuation</span>
                    <div className="text-2xl font-black text-primary italic tracking-tighter leading-none mt-1">
                      ₹{productBatches.reduce((sum, b) => sum + (b.remaining_qty * b.purchase_price), 0).toFixed(2)}
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

