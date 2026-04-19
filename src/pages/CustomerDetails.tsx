import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerService } from '../services/customers';
import { Button, Card, Table, Badge, Avatar, cn } from '../components/UI';
import { ArrowLeft, Printer, Download, Receipt, Banknote, MapPin, Phone, Wallet, Calendar } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';

export function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState<number | 'all' | 'custom'>(7);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

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

      const [cData, tData] = await Promise.all([
        customerService.getById(id!),
        customerService.getTransactions(id!, startDate) // Ideally backend supports endDate too, but we'll filter frontend if not
      ]);
      
      let filteredTData = tData;
      if (endDate) {
        filteredTData = tData.filter(t => new Date(t.created_at) <= new Date(endDate!));
      }
      
      setCustomer(cData);
      
      // Group splits (Payment + Wallet Deposit from same transaction)
      const rawTransactions = filteredTData;
      const grouped: any[] = [];
      const groups: { [key: string]: any } = {};

      rawTransactions.forEach(t => {
        if (t.type === 'INVOICE') {
          grouped.push({ ...t });
        } else {
          // Group by timestamp (minute) and method
          const timeKey = `${format(new Date(t.created_at), 'yyyy-MM-dd HH:mm')}_${t.payment_method || 'wallet'}`;
          if (!groups[timeKey]) {
            groups[timeKey] = { 
              ...t, 
              total_amount: 0, 
              breakdown: { settle: 0, deposit: 0 },
              settled_bills: [],
              isGrouped: true 
            };
            grouped.push(groups[timeKey]);
          }
          
          if (t.type === 'PAYMENT') {
            groups[timeKey].breakdown.settle += parseFloat(t.amount);
            groups[timeKey].total_amount += parseFloat(t.amount);
            if (t.bill_id) {
              groups[timeKey].settled_bills.push(t.bill_id.slice(0, 4).toUpperCase());
            }
          } else if (t.type === 'WALLET') {
            groups[timeKey].breakdown.deposit += parseFloat(t.amount);
            groups[timeKey].total_amount += parseFloat(t.amount);
          }
        }
      });

      const ledgerWithBalance = grouped;

      setTransactions(ledgerWithBalance);
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

  return (
    <div id="printable-invoice" className="space-y-8 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/customers')}
            className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Transaction Ledger</h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
               <Calendar size={14} /> Full Audit Trail for {customer?.shop_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm print:hidden gap-1">
            {[7, 30, 'all', 'custom'].map((days) => (
              <button
                key={days}
                onClick={() => setFilterDays(days as any)}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  filterDays === days 
                    ? "bg-slate-900 text-white" 
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {days === 'all' ? 'All' : days === 'custom' ? 'Custom' : `${days}D`}
              </button>
            ))}
            
            {filterDays === 'custom' && (
              <div className="flex items-center gap-2 ml-2 pr-2 border-l pl-3 border-slate-100">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-[10px] font-bold border-none bg-slate-50 rounded p-1 focus:ring-0"
                />
                <span className="text-[10px] text-slate-400 font-bold">to</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-[10px] font-bold border-none bg-slate-50 rounded p-1 focus:ring-0"
                />
              </div>
            )}
          </div>
          <Button onClick={handlePrint} variant="ghost" className="h-12 px-6 border-slate-200 text-slate-600 hover:bg-slate-50">
            <Printer size={18} strokeWidth={2.5} />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/20 flex items-center gap-6 group">
           <Avatar fallback={customer?.shop_name || 'CL'} size="xl" className="shadow-2xl shadow-slate-200 group-hover:scale-105 transition-transform" />
           <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{customer?.shop_name}</h3>
              <div className="flex flex-col gap-2 mt-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <div className="flex items-center gap-2"><MapPin size={12} className="text-primary" /> {customer?.location || 'Main Terminal'}</div>
                 <div className="flex items-center gap-2"><Phone size={12} className="text-primary" /> {customer?.phone}</div>
              </div>
           </div>
        </div>

        {/* Web-Only Cards */}
        <div className="bg-rose-50 p-8 rounded-3xl border border-rose-100 shadow-xl shadow-rose-500/5 relative overflow-hidden group print:hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-rose-200/40 transition-all duration-700" />
           <div className="relative">
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] leading-normal mb-1 block italic">Total Outstanding</span>
              <div className="text-3xl font-black text-rose-600 italic tracking-tighter leading-tight">₹{customer?.balance?.toFixed(2) || '0.00'}</div>
           </div>
        </div>

        <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-500/5 relative overflow-hidden group print:hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-200/40 transition-all duration-700" />
           <div className="relative">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] leading-normal mb-1 block italic">Wallet Advance</span>
              <div className="text-3xl font-black text-emerald-600 italic tracking-tighter leading-tight">₹{customer?.wallet_balance?.toFixed(2) || '0.00'}</div>
           </div>
        </div>

        {/* Print-Only Bulletproof Summary */}
        <div className="hidden print:block col-span-4 space-y-10">
           <div className="border-l-4 border-rose-600 pl-6 py-2">
              <div className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-4">Total Outstanding Balance</div>
              <div className="text-5xl font-black text-slate-900">₹{customer?.balance?.toFixed(2) || '0.00'}</div>
           </div>
           <div className="border-l-4 border-emerald-600 pl-6 py-2">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">Current Wallet Advance</div>
              <div className="text-5xl font-black text-slate-900">₹{customer?.wallet_balance?.toFixed(2) || '0.00'}</div>
           </div>
        </div>
      </div>

      {/* Ledger Table */}
      <Card className="p-0 border-slate-200 overflow-hidden print:overflow-visible print:border-none shadow-2xl shadow-slate-200/40 bg-white">
          <Table headers={['Date', 'Reference / TXN ID', 'Debit (+)', 'Credit (-)', 'Audit Trail']}>
            {transactions.map(t => (
              <tr key={t.id + t.type} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 italic">
                <td className="px-8 py-5 text-xs text-slate-500 font-bold whitespace-nowrap">
                  {format(new Date(t.created_at), 'dd MMM yyyy, HH:mm')}
                </td>
                <td className="px-8 py-5">
                   <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border",
                        t.type === 'INVOICE' ? "bg-rose-50 text-rose-600 border-rose-100" : 
                        (t.isGrouped && t.breakdown.deposit > 0 && t.breakdown.settle === 0) ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                         {t.type === 'INVOICE' ? <Receipt size={18} /> : 
                          (t.isGrouped && t.breakdown.deposit > 0 && t.breakdown.settle === 0) ? <Wallet size={18} /> :
                          <Banknote size={18} />}
                      </div>
                      <div>
                         <div className="font-black text-slate-900 leading-none mb-1 text-sm">
                            {t.type === 'INVOICE' ? `BILL-${t.id.slice(0, 8).toUpperCase()}` : 
                             (t.isGrouped && t.breakdown.deposit > 0 && t.breakdown.settle === 0) ? `WLT-${t.id.slice(0, 8).toUpperCase()}` :
                             `TXN-${t.id.slice(0, 8).toUpperCase()}`}
                         </div>
                         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            {t.type === 'INVOICE' ? 'Product Sale' : 
                             (t.isGrouped && t.breakdown.deposit > 0 && t.breakdown.settle === 0) ? 'Wallet Deposit' :
                             (t.isGrouped && t.breakdown.deposit > 0) ? 'Payment & Deposit' :
                             `Settlement (${(t.payment_method || 'Cash').toUpperCase()})`}
                         </div>
                      </div>
                   </div>
                </td>
                 <td className="px-8 py-5">
                    {t.type === 'INVOICE' ? (
                      <div className="font-black text-slate-900 text-sm tracking-tighter italic">₹{t.total_amount.toFixed(2)}</div>
                    ) : <span className="text-slate-200 text-sm">-</span>}
                 </td>
                 <td className="px-8 py-5">
                    {t.isGrouped ? (
                      <div className={cn(
                        "font-black text-sm tracking-tighter italic",
                        t.breakdown.deposit > 0 ? "text-amber-600" : "text-emerald-600"
                      )}>
                         ₹{t.total_amount.toFixed(2)}
                      </div>
                    ) : t.type === 'PAYMENT' ? (
                      <div className="font-black text-emerald-600 text-sm tracking-tighter italic">₹{t.amount.toFixed(2)}</div>
                    ) : t.type === 'WALLET' ? (
                      <div className="font-black text-amber-600 text-sm tracking-tighter italic">₹{t.amount.toFixed(2)}</div>
                    ) : <span className="text-slate-200 text-sm">-</span>}
                 </td>
                 <td className="px-8 py-5 min-w-[150px]">
                   {t.type === 'INVOICE' ? (
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-relaxed">
                        Paid: ₹{t.paid_amount.toFixed(2)}<br/>on {format(new Date(t.created_at), 'dd MMM yyyy')}
                     </div>
                   ) : t.isGrouped && (
                     <div className="flex flex-col gap-1.5">
                        {t.settled_bills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(t.settled_bills)).map((bid: any) => (
                              <span key={bid} className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Settled #{bid}</span>
                            ))}
                          </div>
                        )}
                        {t.breakdown.settle > 0 && t.breakdown.deposit > 0 && (
                           <div className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter opacity-80 leading-tight">
                             (₹{t.breakdown.deposit.toFixed(0)} to Wallet)
                           </div>
                        )}
                     </div>
                   )}
                 </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-10 py-32 text-center">
                   <div className="flex flex-col items-center gap-3">
                      <Receipt size={48} className="text-slate-200" />
                      <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[10px]">No ledger entries discovered</p>
                   </div>
                </td>
              </tr>
            )}
          </Table>
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block text-center pt-20 border-t-2 border-slate-900 mt-20">
         <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em] mb-2">End of Ledger Statement</p>
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated on {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: portrait; margin: 15mm; }
          body { background: white !important; color: black !important; font-size: 10pt !important; }
          .print\\:hidden, header, aside, nav, footer, button, .no-print { display: none !important; }
          
          #printable-invoice { position: static !important; width: 100% !important; border: none !important; padding: 0 !important; margin: 0 !important; visibility: visible !important; }
          #printable-invoice * { visibility: visible !important; }
          
          /* Simple Header */
          h2 { font-size: 18pt !important; border-bottom: 2px solid black !important; padding-bottom: 5mm !important; margin-bottom: 5mm !important; }
          .grid { display: block !important; border: none !important; margin-bottom: 10mm !important; }
          .bg-white, .bg-rose-50, .bg-emerald-50 { border: none !important; background: transparent !important; padding: 0 !important; margin-bottom: 2mm !important; box-shadow: none !important; }
          
          /* Modern Header in Print */
          .grid.grid-cols-4 { display: flex !important; flex-wrap: wrap !important; gap: 10px !important; }
          .grid.grid-cols-4 > div { flex: 1 !important; min-width: 200px !important; border: 1px solid #eee !important; padding: 15px !important; border-radius: 10px !important; }
          
          .italic { font-style: normal !important; }
          
          /* Absolute Table */
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid black !important; margin-top: 20px !important; }
          th { background: #f2f2f2 !important; border: 1px solid black !important; padding: 8px !important; text-transform: uppercase !important; font-size: 9pt !important; }
          td { border: 1px solid black !important; padding: 8px !important; font-size: 9pt !important; }
          
          /* Remove Icons in Print */
          .w-10.h-10 { display: none !important; }
          .badge, .Badge { border: 1px solid black !important; background: transparent !important; color: black !important; }
          
          /* Footer Fix */
          .pt-20 { page-break-inside: avoid !important; }
        }
      `}} />
    </div>
  );
}
