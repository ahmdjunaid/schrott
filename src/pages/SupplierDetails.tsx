import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supplierService } from '../services/suppliers';
import { Button, Card, Table, Avatar, cn } from '../components/UI';
import { ArrowLeft, Printer, ShoppingBag, MapPin, Phone, Calendar, CheckCircle2 } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { Pagination } from '../components/UI';

export function SupplierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState<number | 'all' | 'custom'>(7);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (id) fetchLedger();
  }, [id, filterDays, dateRange]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (filterDays === 'custom') {
        if (dateRange.start) startDate = startOfDay(new Date(dateRange.start)).toISOString();
        if (dateRange.end) endDate = endOfDay(new Date(dateRange.end)).toISOString();
      } else if (filterDays !== 'all') {
        startDate = subDays(new Date(), filterDays as number).toISOString();
      }

      const [sData, tData] = await Promise.all([
        supplierService.getById(id!),
        supplierService.getTransactions(id!, startDate)
      ]);
      
      let filteredTData = tData;
      if (endDate) {
        filteredTData = tData.filter(t => new Date(t.created_at) <= new Date(endDate!));
      }
      
      setSupplier(sData);
      
      // Calculate Running Balance (Option B: Pure Ledger)
      const typePriority: { [key: string]: number } = { 'INVOICE': 0, 'PAYMENT': 1, 'RETURN': 2, 'REFUND': 3 };
      
      const sorted = [...filteredTData].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (Math.abs(timeA - timeB) < 10000) {
          return typePriority[a.type as string] - typePriority[b.type as string];
        }
        return timeA - timeB;
      });

      let currentBalance = 0;
      const ledgerWithBalance = sorted.map(t => {
        if (t.type === 'INVOICE') {
          currentBalance += parseFloat(t.total_amount || 0);
        } else if (t.type === 'RETURN') {
          currentBalance -= parseFloat(t.total_amount || 0);
        } else {
          currentBalance -= parseFloat(t.amount || t.total_amount || 0);
        }
        return { ...t, running_balance: currentBalance };
      });

      setTransactions([...ledgerWithBalance].reverse());
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4 md:space-y-8 py-2 md:py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 print:hidden">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => navigate('/suppliers')}
            className="p-2 md:p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase md:normal-case italic">Supplier Ledger</h2>
            <p className="text-[9px] md:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5 md:mt-1">
               <Calendar size={12} /> STATEMENT: {supplier?.shop_name}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
          <div className="flex items-center overflow-x-auto bg-white border border-slate-200 rounded-xl p-1 shadow-sm print:hidden gap-1 no-scrollbar">
            {[7, 30, 'all', 'custom'].map((days) => (
              <button
                key={days}
                onClick={() => {
                  setFilterDays(days as any);
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                  filterDays === days 
                    ? "bg-slate-900 text-white" 
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {days === 'all' ? 'All' : days === 'custom' ? 'Custom' : `${days}D`}
              </button>
            ))}
          </div>
          
          <Button onClick={handlePrint} variant="ghost" className="h-10 md:h-12 px-4 md:px-6 border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] md:text-sm italic font-black">
            <Printer size={16} />
            Export Statement
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/20 flex items-center gap-4 md:gap-6 group">
           <Avatar fallback={supplier?.shop_name || 'SP'} size="lg" className="shadow-2xl shadow-slate-200 group-hover:scale-105 transition-transform" />
           <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none italic uppercase">{supplier?.shop_name}</h3>
              <div className="flex flex-col gap-1.5 md:gap-2 mt-2 md:mt-3 text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <div className="flex items-center gap-2"><MapPin size={12} className="text-primary" /> {supplier?.location || 'Main Hub'}</div>
                 <div className="flex items-center gap-2"><Phone size={12} className="text-primary" /> {supplier?.phone}</div>
              </div>
           </div>
        </div>

        <div className="lg:w-1/3 bg-slate-900 p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-800 shadow-xl shadow-slate-900/10 relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
           <div className="relative">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-relaxed mb-1 md:mb-3 block italic">Closing Balance</span>
              <div className={cn(
                "text-2xl md:text-3xl font-black italic tracking-tighter leading-tight",
                supplier?.balance > 0 ? "text-rose-500" : "text-emerald-500"
              )}>
                 ₹{Math.abs(supplier?.balance || 0).toFixed(2)}
                 <span className="text-[10px] ml-2 opacity-50 uppercase tracking-widest font-bold">
                    {supplier?.balance > 0 ? 'To Pay' : 'Credit'}
                 </span>
              </div>
           </div>
        </div>
      </div>

      <Card className="p-0 border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/40 bg-white">
        <div className="overflow-x-auto">
          <Table headers={['Date', 'Transaction / ID', 'Debit (+)', 'Credit (-)', 'Running Balance']}>
            {paginatedTransactions.map(t => (
              <tr key={t.id + t.type} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 italic">
                <td className="px-8 py-5 text-xs text-slate-500 font-bold whitespace-nowrap">
                  {format(new Date(t.created_at), 'dd MMM yyyy, HH:mm')}
                </td>
                <td className="px-8 py-5">
                   <div>
                      <div className={cn(
                        "font-black text-sm leading-none mb-1",
                        t.type === 'INVOICE' ? 'text-rose-600' : 
                        t.type === 'RETURN' ? 'text-amber-600' : 
                        t.type === 'REFUND' ? 'text-rose-500' : 'text-emerald-600'
                      )}>
                         {t.type === 'INVOICE' ? 'PURCHASE' : 
                          t.type === 'RETURN' ? 'RETURN' : 
                          t.type === 'REFUND' ? 'REFUND' : 'PAYMENT'}
                         <span className="ml-2 opacity-30 text-[10px] tracking-normal font-bold uppercase">
                           {t.id.slice(0, 8)}
                         </span>
                      </div>
                      <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                         Method: {t.payment_method || 'N/A'}
                      </div>
                   </div>
                </td>
                <td className="px-8 py-5">
                    {t.type === 'INVOICE' || t.type === 'REFUND' ? (
                      <div className={cn(
                        "font-black text-sm italic",
                        t.type === 'INVOICE' ? "text-slate-900" : "text-rose-500"
                      )}>
                        {t.type === 'REFUND' ? '+ ' : ''}₹{parseFloat(t.amount || t.total_amount || 0).toFixed(2)}
                      </div>
                    ) : <span className="opacity-20 text-slate-300">-</span>}
                </td>
                <td className="px-8 py-5">
                    {t.type === 'PAYMENT' ? (
                      <div className="font-black text-emerald-600 text-sm italic">
                        ₹{parseFloat(t.amount || 0).toFixed(2)}
                      </div>
                    ) : t.type === 'RETURN' ? (
                       <div className="font-black text-amber-600 text-sm italic">
                         ₹{parseFloat(t.total_amount || 0).toFixed(2)}
                       </div>
                    ) : <span className="opacity-20 text-slate-300">-</span>}
                </td>
                <td className="px-8 py-5">
                   <div className={cn(
                     "font-black text-sm italic",
                     t.running_balance > 0 ? "text-rose-600" : "text-emerald-600"
                   )}>
                      ₹{Math.abs(t.running_balance).toFixed(2)}
                      <span className="text-[8px] ml-2 opacity-50 uppercase tracking-tighter">
                        {t.running_balance > 0 ? 'Due' : 'Credit'}
                      </span>
                   </div>
                </td>
              </tr>
            ))}
            
            {transactions.length > 0 && currentPage === Math.ceil(transactions.length / itemsPerPage) && (
              <tr className="bg-slate-50/30">
                <td colSpan={5} className="px-8 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <CheckCircle2 size={24} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">End of Ledger Statement</span>
                  </div>
                </td>
              </tr>
            )}

            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-10 py-32 text-center">
                   <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No transaction history discovered</p>
                </td>
              </tr>
            )}
          </Table>
        </div>

        {transactions.length > itemsPerPage && (
          <div className="p-6 border-t border-slate-100 print:hidden">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(transactions.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
