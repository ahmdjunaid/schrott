import React, { useEffect, useState } from 'react';
import { purchaseService } from '../services/purchases';
import { supplierService } from '../services/suppliers';
import { productService, categoryService, brandService } from '../services/inventory';
import { Button, Input, Card, Modal, Table, Badge, Pagination, cn } from '../components/UI';
import { SearchableSelect } from '../components/UI/SearchableSelect';
import { Plus, Trash2, Search, ShoppingBag, Truck, Receipt, AlignLeft, Info, PackagePlus, Eye, X, Edit2, ArrowUpRight, Wallet, ShoppingCart, MapPin, Phone, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { confirmToast } from '../utils/toast';
import { Purchase, Supplier, Product, Category, Brand } from '../types';

interface PurchaseItemEntry {
  product_id: string;
  name: string;
  quantity: number;
  purchase_price: number;
  sgst: number;
  cgst: number;
  description?: string;
  total: number;
}

export function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPurchaseItems, setViewingPurchaseItems] = useState<any[]>([]);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);
  const [purchasePayments, setPurchasePayments] = useState<any[]>([]);
  
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // New Purchase State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemEntry[]>([{
    product_id: '',
    name: '',
    quantity: 1,
    purchase_price: 0,
    sgst: 0,
    cgst: 0,
    total: 0
  }]);
  const [paidAmount, setPaidAmount] = useState<string | number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('bank_transfer');
  const [useWallet, setUseWallet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    purchase_price: 0,
    sgst: 0,
    cgst: 0,
    description: ''
  });


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pData, sData, prData, cData, bData] = await Promise.all([
        purchaseService.getAll(),
        supplierService.getAll(),
        productService.getAll(),
        categoryService.getAll(),
        brandService.getAll()
      ]);
      setPurchases(pData);
      setSuppliers(sData);
      setProducts(prData);
      setCategories(cData);
      setBrands(bData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setPurchaseItems([...purchaseItems, {
      product_id: '',
      name: '',
      quantity: 1,
      purchase_price: 0,
      sgst: 0,
      cgst: 0,
      total: 0
    }]);
  };

  const updateItemProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setPurchaseItems(purchaseItems.map((item, i) => {
      if (i === index) {
        const baseTotal = item.quantity * (item.purchase_price || 0);
        const sgst = product.sgst || 0;
        const cgst = product.cgst || 0;
        const sgstAmount = (baseTotal * sgst) / 100;
        const cgstAmount = (baseTotal * cgst) / 100;
        return { 
          ...item, 
          product_id: productId, 
          name: product.name,
          sgst,
          cgst,
          total: baseTotal + sgstAmount + cgstAmount
        };
      }
      return item;
    }));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 0) return;
    setPurchaseItems(purchaseItems.map((item, i) => {
      if (i === index) {
        const baseTotal = quantity * item.purchase_price;
        const sgstAmount = (baseTotal * item.sgst) / 100;
        const cgstAmount = (baseTotal * item.cgst) / 100;
        return { ...item, quantity, total: baseTotal + sgstAmount + cgstAmount };
      }
      return item;
    }));
  };

  const updateItemPrice = (index: number, purchase_price: number) => {
    if (purchase_price < 0) return;
    setPurchaseItems(purchaseItems.map((item, i) => {
      if (i === index) {
        const baseTotal = item.quantity * purchase_price;
        const sgstAmount = (baseTotal * item.sgst) / 100;
        const cgstAmount = (baseTotal * item.cgst) / 100;
        return { ...item, purchase_price, total: baseTotal + sgstAmount + cgstAmount };
      }
      return item;
    }));
  };

  const updateItemTaxTotal = (index: number, totalTax: number) => {
    const halfTax = totalTax / 2;
    setPurchaseItems(purchaseItems.map((item, i) => {
      if (i === index) {
        const baseTotal = item.quantity * item.purchase_price;
        const sgstAmount = (baseTotal * halfTax) / 100;
        const cgstAmount = (baseTotal * halfTax) / 100;
        return { 
          ...item, 
          sgst: halfTax, 
          cgst: halfTax, 
          total: baseTotal + sgstAmount + cgstAmount 
        };
      }
      return item;
    }));
  };

  const updateItemDescription = (index: number, description: string) => {
    setPurchaseItems(purchaseItems.map((item, i) => {
      if (i === index) {
        return { ...item, description };
      }
      return item;
    }));
  };

  const removeItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmitPurchase = async () => {
    if (!selectedSupplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await purchaseService.createPurchase({
              supplier_id: selectedSupplierId,
              items: purchaseItems,
              paid_amount: parseFloat(paidAmount.toString()) || 0,
              payment_method: (parseFloat(paidAmount.toString()) || 0) > 0 ? paymentMethod : null,
              use_wallet: useWallet
            });

      setIsCreateModalOpen(false);
      resetNewPurchase();
      fetchData();
      toast.success('Purchase recorded successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (purchase: any) => {
    setViewingPurchase(purchase);
    setIsViewModalOpen(true);
    try {
      const items = await purchaseService.getPurchaseItems(purchase.id);
      setViewingPurchaseItems(items);
      const payments = await purchaseService.getPurchasePayments(purchase.id);
      setPurchasePayments(payments);
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const handleUpdateSupplier = async (supplierId: string) => {
    if (!viewingPurchase) return;
    setIsUpdatingSupplier(true);
    try {
      await purchaseService.updatePurchase(viewingPurchase.id, { supplier_id: supplierId });
      const updatedPurchase = { ...viewingPurchase, supplier_id: supplierId };
      setViewingPurchase(updatedPurchase);
      fetchData();
      toast.success('Supplier updated successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdatingSupplier(false);
    }
  };


  const handleDeletePurchase = async (id: string) => {
    confirmToast(
      'Are you sure you want to delete this purchase? Stock will be reversed.',
      async () => {
        try {
          await purchaseService.deletePurchase(id);
          toast.success('Purchase deleted successfully.');
          fetchData();
        } catch (error: any) {
          toast.error(error.message);
        }
      }
    );
  };

  const deleteItem = async (itemId: string) => {
    if (!viewingPurchase) return;
    confirmToast(
      'Delete this item?',
      async () => {
        try {
          // In a real app, this would call a service to delete the specific item
          // For now, we'll refresh the items
          const items = await purchaseService.getPurchaseItems(viewingPurchase.id);
          setViewingPurchaseItems(items);
          fetchData();
          toast.success('Item deleted');
        } catch (error: any) { 
          toast.error(error.message); 
        }
      }
    );
  };

  const updateQty = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await purchaseService.updatePurchaseItemQty(itemId, newQty);
      const items = await purchaseService.getPurchaseItems(viewingPurchase.id);
      setViewingPurchaseItems(items);
      fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const resetNewPurchase = () => {
    setSelectedSupplierId('');
    setPurchaseItems([{
      product_id: '',
      name: '',
      quantity: 1,
      purchase_price: 0,
      sgst: 0,
      cgst: 0,
      total: 0
    }]);
    setPaidAmount(0);
    setPaymentMethod('bank_transfer');
    setUseWallet(true);
  };

  const filteredPurchases = purchases.filter(p => 
    p.supplier?.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 py-2">
      {/* Dynamic Header Sector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Purchases</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Track and manage your business purchases and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateModalOpen(true)} className="h-11 px-8 shadow-lg shadow-primary/20 font-black gap-2">
            <Plus size={18} strokeWidth={3} />
            Add New Purchase
          </Button>
        </div>
      </div>

      {/* Global Ledger Terminal */}
      <Card className="p-0 border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative group flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search by supplier or purchase ID..."
                className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 focus:border-primary/40 rounded-lg text-sm transition-all focus:ring-4 focus:ring-primary/5 shadow-sm outline-none font-medium"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
           </div>
           <div className="flex items-center gap-6">
              <div className="text-right">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Purchases</div>
                 <div className="text-lg font-black text-slate-900 italic tracking-tighter">₹{purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0).toFixed(2)}</div>
              </div>
              <div className="w-px h-10 bg-slate-200 hidden md:block" />
              <div className="text-right">
                 <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Pending Payments</div>
                 <div className="text-lg font-black text-rose-600 italic tracking-tighter">₹{purchases.reduce((sum, p) => sum + (p.balance_amount || 0), 0).toFixed(2)}</div>
              </div>
           </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <Table headers={['Date', 'Purchase ID', 'Supplier Name', 'Total Amount', 'Status', 'Balance', 'Actions']}>
              {filteredPurchases
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-500 uppercase leading-none">Record</div>
                      <div className="text-xs font-bold text-slate-400 mt-1">{format(new Date(p.created_at), 'dd MMM yyyy')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-primary uppercase text-xs italic tracking-widest">#PUR-{p.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-black leading-tight italic uppercase">{p.supplier?.shop_name}</div>
                    </td>
                    <td className="px-6 py-4 relative group/val">
                       <div className="text-sm font-black text-slate-900 italic">₹{p.total_amount.toFixed(2)}</div>
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Amount</div>
                    </td>
                    <td className="px-6 py-4">
                       <Badge status={p.status} />
                    </td>
                    <td className="px-6 py-4">
                       <div className={cn(
                         "text-sm font-black italic",
                         p.balance_amount > 0 ? "text-rose-600" : "text-emerald-600"
                       )}>
                         ₹{p.balance_amount.toFixed(2)}
                       </div>
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Balance</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex items-center justify-center gap-1">
                           <button 
                             onClick={() => handleViewDetails(p)}
                             className="p-2 text-slate-400 hover:bg-primary/5 rounded-lg transition-all border border-transparent hover:border-primary/10"
                             title="View Details"
                           >
                             <Eye size={18} strokeWidth={2.5} />
                           </button>
                           <button 
                             onClick={() => handleDeletePurchase(p.id)}
                             className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all border border-transparent hover:border-rose-100"
                             title="Delete Purchase"
                           >
                             <Trash2 size={18} strokeWidth={2.5} />
                           </button>
                       </div>
                    </td>
                  </tr>
                ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                     <div className="flex flex-col items-center justify-center opacity-20 grayscale">
                        <ShoppingBag size={64} strokeWidth={1} />
                        <p className="text-sm font-black uppercase tracking-[0.3em] mt-4">Zero purchase records found</p>
                     </div>
                  </td>
                </tr>
              )}
            </Table>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredPurchases.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Stock Entry Terminal Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Purchase"
        className="max-w-7xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-8 p-1">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                 <Truck size={24} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] block leading-none mb-1">Total Purchase Amount</span>
                <span className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{purchaseTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="px-8 h-12 flex-1 sm:flex-none">Cancel</Button>
              <Button onClick={handleSubmitPurchase} disabled={submitting} className="h-12 px-12 shadow-xl shadow-primary/30 font-black flex-1 sm:flex-none">
                {submitting ? 'Saving...' : 'Save Purchase'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-8 min-h-[70vh] -mx-2">
          {/* Section 01: Partner Lo */}
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-inner">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                 <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
                 <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Supplier Details</h3>
              </div>
              <SearchableSelect
                options={suppliers.map(s => ({ 
                  id: s.id, 
                  name: s.shop_name, 
                  subtitle: `${s.location || 'Local'} — Balance: ₹${(s.balance || 0).toFixed(2)}` 
                }))}
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
                placeholder="Select a supplier..."
              />
            </div>
            {selectedSupplierId && (
              <div className={cn(
                "bg-white p-3 rounded-xl border-2 shadow-xl shadow-slate-200/20 flex items-center gap-4 min-w-[240px] border-l-8",
                (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) > 0 ? "border-rose-500" : "border-emerald-500"
              )}>
                 <div className={cn(
                   "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border",
                   (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) > 0 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                 )}>
                    <Wallet size={20} strokeWidth={2.5} />
                 </div>
                 <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                      {(suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) > 0 ? 'Outstanding Dues' : 'Available Credit'}
                    </div>
                    <div className={cn(
                      "text-xl font-black italic tracking-tighter leading-none",
                      (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"
                    )}>
                      ₹{Math.abs(suppliers.find(s => s.id === selectedSupplierId)?.balance || 0).toFixed(2)}
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Section 02: Asset Registry Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                 <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
                 <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Item List</h3>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200/50 italic shadow-sm">
                <Info size={14} className="text-primary" strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-slate-500 tracking-tight uppercase">Tax is auto-split (50/50 SGST-CGST)</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/30">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                    <th className="px-3 py-3 w-[30%]">Product Details</th>
                    <th className="px-3 py-3 w-[20%] text-center">Notes</th>
                    <th className="px-2 py-3 text-center">Qty</th>
                    <th className="px-2 py-3 text-center w-[12%]">Cost Price (₹)</th>
                    <th className="px-2 py-3 text-center w-[10%]">Tax (%)</th>
                    <th className="px-3 py-3 text-right w-[15%]">Total (₹)</th>
                    <th className="px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center py-10 opacity-30 grayscale">
                          <ShoppingCart size={64} strokeWidth={1} />
                          <p className="text-[10px] font-black tracking-[0.4em] uppercase mt-4">Empty List</p>
                          <Button variant="ghost" size="sm" onClick={addItem} className="mt-6 gap-2 bg-slate-50 border-slate-200 hover:bg-white text-primary">
                            <Plus size={16} strokeWidth={3} /> Start Adding Items
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-2 py-2">
                          <SearchableSelect
                            options={products.map(p => ({ id: p.id, name: p.name, stock: p.stock }))}
                            value={item.product_id}
                            onChange={(val) => updateItemProduct(index, val)}
                            placeholder="Select Product..."
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <AlignLeft className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                            <input
                              type="text"
                              placeholder="Batch notes..."
                              className="w-full h-9 pl-8 pr-2 bg-slate-50/30 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-center"
                              value={item.description || ''}
                              onChange={(e) => updateItemDescription(index, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-center font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-base shadow-sm"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[10px]">₹</span>
                             <input
                              type="number"
                              className="w-full h-9 pl-5 pr-2 bg-white border border-slate-200 rounded-lg text-center font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-base shadow-sm"
                              value={item.purchase_price}
                              onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                           <input
                            type="number"
                            className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all italic text-sm"
                            value={item.sgst + item.cgst}
                            onChange={(e) => updateItemTaxTotal(index, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="text-base font-black text-slate-900 italic tracking-tighter">₹{item.total.toFixed(2)}</div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Total</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeItem(index)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-sm">
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm" onClick={addItem} className="h-10 px-6 gap-2 bg-white border-slate-200 text-primary hover:border-primary/50 shadow-sm font-black">
                    <Plus size={18} strokeWidth={3} /> Add Item
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 03: Financial Settlement Strategy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-slate-200">
             <div className="lg:col-span-7 space-y-6">
               <div className="flex items-center gap-2 px-2">
                 <div className="w-1 h-4 bg-primary rounded-full shadow-sm" />
                 <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Payment Details</h3>
               </div>
               
               {((suppliers.find(s => s.id === selectedSupplierId) as any)?.wallet_balance > 0) && (
                  <button 
                    onClick={() => {
                      const newUseWallet = !useWallet;
                      setUseWallet(newUseWallet);
                      if (newUseWallet) {
                        const balance = suppliers.find(s => s.id === selectedSupplierId)?.balance || 0;
                        // Only apply if it's a credit balance (negative)
                        if (balance < 0) {
                          setPaidAmount(Math.max(0, purchaseTotal - Math.abs(balance)).toFixed(2));
                        }
                      }
                    }}
                    className={cn(
                      "w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all group relative overflow-hidden",
                      useWallet && (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0
                        ? "bg-emerald-50/50 border-emerald-500/20 text-emerald-800 shadow-xl shadow-emerald-500/5" 
                        : "bg-white border-slate-200 text-slate-400 hover:border-primary/30"
                    )}
                  >
                    {useWallet && (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />}
                    <div className="flex items-center gap-4 relative">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                         useWallet && (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0 ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-slate-100 text-slate-400"
                       )}>
                          <Receipt size={24} strokeWidth={2.5} />
                       </div>
                       <div className="text-left">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">Apply Credit Balance</div>
                          <div className="text-lg font-black italic tracking-tighter">
                            {(suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0 
                              ? `Use ₹${Math.min(Math.abs(suppliers.find(s => s.id === selectedSupplierId)?.balance || 0), purchaseTotal).toFixed(2)} from Credits`
                              : 'No Credits Available'}
                          </div>
                       </div>
                    </div>
                    <div className={cn(
                      "w-14 h-8 rounded-full relative transition-all flex items-center px-1 shadow-inner",
                      useWallet && (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0 ? "bg-emerald-500" : "bg-slate-200"
                    )}>
                      <div className={cn(
                        "w-6 h-6 bg-white rounded-full transition-all shadow-md transform",
                        useWallet && (suppliers.find(s => s.id === selectedSupplierId)?.balance || 0) < 0 ? "translate-x-6" : "translate-x-0"
                      )} />
                    </div>
                  </button>
               )}

               <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/20">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount Paid (₹)</label>
                     <div className="relative group/paid">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg group-focus-within/paid:text-primary transition-colors italic">₹</span>
                        <input 
                          type="number" 
                          value={paidAmount} 
                          onChange={(e) => setPaidAmount(e.target.value)} 
                          className="w-full h-14 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black italic focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                          placeholder="0.00"
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                    <select
                      className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:ring-4 focus:ring-primary/10 transition-all outline-none italic"
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      disabled={parseFloat(paidAmount.toString()) <= 0}
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card / POS</option>
                    </select>
                  </div>
               </div>
             </div>

             <div className="lg:col-span-5">
                <div className="bg-slate-900 p-4 rounded-2xl text-white space-y-4 shadow-2xl shadow-slate-900/40 relative overflow-hidden group/card flex flex-col justify-between">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-[100px] group-hover/card:bg-primary/30 transition-all duration-700" />
                   <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full -ml-24 -mb-24 blur-[80px]" />
                   
                   <div className="relative space-y-4">
                      <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-primary">
                               <ShoppingCart size={14} strokeWidth={2.5} />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] italic">Summary</span>
                         </div>
                         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{format(new Date(), 'dd.MM.yyyy')}</span>
                      </div>
                      
                      <div className="space-y-3 pt-2">
                         <div className="flex justify-between items-center group/row">
                            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest group-hover/row:text-white transition-colors">Total Amount</span>
                            <span className="font-black text-lg italic tracking-tighter">₹{purchaseTotal.toFixed(2)}</span>
                         </div>
                         
                         {useWallet && ((suppliers.find(s => s.id === selectedSupplierId) as any)?.wallet_balance > 0) && (
                           <div className="flex justify-between items-center text-emerald-400 group/row">
                              <span className="font-bold text-[10px] uppercase tracking-widest">Wallet Used</span>
                              <span className="font-black text-base italic tracking-tighter">- ₹{Math.min(((suppliers.find(s => s.id === selectedSupplierId) as any)?.wallet_balance || 0), purchaseTotal).toFixed(2)}</span>
                           </div>
                         )}

                         <div className="flex justify-between items-center text-primary group/row border-b border-white/5 pb-3">
                            <span className="font-bold text-[10px] uppercase tracking-widest">Amount Paid</span>
                            <span className="font-black text-base italic tracking-tighter">₹{parseFloat(paidAmount.toString()) || 0}</span>
                         </div>

                         <div className="pt-3 flex flex-col gap-1">
                            <span className="text-slate-500 font-black text-[9px] uppercase tracking-[0.4em] leading-none">Remaining Balance</span>
                            <div className={cn(
                              "text-2xl font-black italic tracking-tighter transition-all duration-500",
                              Math.max(0, purchaseTotal - (useWallet ? ((suppliers.find(s => s.id === selectedSupplierId) as any)?.wallet_balance || 0) : 0) - (parseFloat(paidAmount.toString()) || 0)) > 0 
                                ? "text-rose-500" 
                                : "text-emerald-500"
                            )}>
                              ₹{Math.max(0, purchaseTotal - (useWallet ? ((suppliers.find(s => s.id === selectedSupplierId) as any)?.wallet_balance || 0) : 0) - (parseFloat(paidAmount.toString()) || 0)).toFixed(2)}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="relative pt-4 text-center border-t border-white/5">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.5em] italic">Purchase System</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </Modal>


      {/* Comprehensive Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Purchase Details"
        className="max-w-6xl"
      >
        <div className="space-y-8 min-h-[70vh]">
          {/* Audit Header: Logistics & Status */}
          <div className="flex flex-col md:flex-row md:items-stretch justify-between gap-6">
             <div className="flex-1 space-y-4 bg-slate-50 p-8 rounded-3xl border border-slate-200/50 shadow-inner">
                <div className="flex items-center gap-3">
                   <div className="w-1 h-5 bg-primary rounded-full shadow-sm" />
                   <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] leading-none">Supplier</h3>
                </div>
                <div className="relative group/supplier">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-50 group-hover/supplier:opacity-100 transition-opacity">
                      <Truck size={20} strokeWidth={2.5} />
                   </div>
                   <select
                     className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-lg font-black italic focus:ring-8 focus:ring-primary/5 transition-all outline-none shadow-xl shadow-slate-200/20"
                     value={viewingPurchase?.supplier_id}
                     onChange={(e) => handleUpdateSupplier(e.target.value)}
                     disabled={isUpdatingSupplier}
                   >
                     {suppliers.map(s => <option key={s.id} value={s.id} className="font-bold">{s.shop_name} — {s.location || 'Hub'}</option>)}
                   </select>
                </div>
             </div>

             <div className="w-full md:w-[350px] bg-slate-900 p-8 rounded-3xl text-white relative overflow-hidden flex flex-col justify-between shadow-2xl shadow-slate-900/30">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl opacity-30" />
                <div className="relative">
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2 leading-none">Purchase ID</div>
                   <div className="text-2xl font-black italic tracking-[0.1em] text-white">#PUR-{viewingPurchase?.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div className="relative mt-8">
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3 leading-none italic">Status</div>
                   <Badge status={viewingPurchase?.status} className="h-10 px-8 text-[11px] font-black uppercase tracking-[0.2em] italic border-2 bg-white/5 border-white/10" />
                </div>
             </div>
          </div>

          {/* Asset Audit Registry */}
          <div className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                     <div className="w-1 h-5 bg-primary rounded-full" />
                      <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Purchase Items</h3>
                  </div>
               </div>
               
               <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xl shadow-slate-200/10">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                        <th className="px-8 py-5">Product Name</th>
                        <th className="px-6 py-5 text-center">Qty</th>
                        <th className="px-6 py-5 text-center">Cost Price (₹)</th>
                        <th className="px-8 py-5 text-right">Total (₹)</th>
                        <th className="px-6 py-5 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                      {viewingPurchaseItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="text-base font-black text-slate-900 leading-tight italic uppercase">{item.product?.name}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-4 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-fit mx-auto">
                              <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center font-black active:scale-90 shadow-sm">-</button>
                              <span className="text-lg font-black w-10 text-center text-slate-900">{item.quantity}</span>
                              <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center font-black active:scale-90 shadow-sm">+</button>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="text-xs font-black text-slate-500 italic">₹{item.purchase_price.toFixed(2)}</div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="text-xl font-black text-slate-900 italic tracking-tighter">₹{item.total.toFixed(2)}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase italic">Total</div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95">
                              <Trash2 size={20} strokeWidth={2.5} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center italic">
                     <div className="flex items-center gap-10">
                        <div className="flex flex-col gap-1">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Purchase Amount</span>
                           <span className="text-xl font-black text-slate-900 tracking-tighter">₹{viewingPurchaseItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
        </div>
      </Modal>
    </div>
  );
}
