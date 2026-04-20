import React, { useEffect, useState } from 'react';
import { Card, Badge, cn, Button } from '../components/UI';
import { 
  BarChart3, TrendingUp, DollarSign, ShoppingBag, 
  Truck, PieChart, Activity, Calendar, AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

interface ReportStats {
  gross_purchases: number;
  purchase_returns: number;
  net_purchases: number;
  supplier_paid: number;
  supplier_balance: number;
  
  gross_sales: number;
  sales_returns: number;
  net_sales: number;
  customer_paid: number;
  customer_balance: number;
  
  profit: number;
  damaged_cost: number;
}

export function Reports() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState<number | 'all' | 'custom'>(7);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchStats();
  }, [filterDays, dateRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (filterDays === 'custom') {
        startDate = dateRange.start ? startOfDay(new Date(dateRange.start)).toISOString() : null;
        endDate = dateRange.end ? endOfDay(new Date(dateRange.end)).toISOString() : null;
      } else if (filterDays !== 'all') {
        const days = filterDays as number;
        startDate = startOfDay(subDays(new Date(), days)).toISOString();
        endDate = endOfDay(new Date()).toISOString();
      }

      const { data, error } = await supabase.rpc('get_financial_reports', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
         <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 animate-pulse">Synchronizing Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-2 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4 italic uppercase">
             <BarChart3 className="text-primary" size={40} />
             Business Intelligence
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">Net Analysis & Performance Metrics</p>
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
          {[7, 30, 'all', 'custom'].map((days) => (
            <button
              key={days}
              onClick={() => setFilterDays(days as any)}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
                filterDays === days 
                  ? "bg-slate-900 text-white shadow-lg" 
                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {days === 'all' ? 'All Time' : days === 'custom' ? 'Custom' : `${days} Days`}
            </button>
          ))}
        </div>
      </div>

      {filterDays === 'custom' && (
        <Card className="p-4 bg-slate-50 border-slate-200 animate-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</span>
              <input 
                type="date" 
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</span>
              <input 
                type="date" 
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
          </div>
        </Card>
      )}

      {/* PRIMARY PERFORMANCE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Sales */}
        <Card className="bg-slate-900 border-0 shadow-2xl relative overflow-hidden group p-6 min-h-[180px] flex flex-col justify-between">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShoppingBag size={80} className="text-white" />
           </div>
           <div className="relative">
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] italic mb-3 block">Total Net Sale</span>
              <div className="text-3xl font-black text-white italic tracking-tighter">₹{stats?.net_sales.toLocaleString()}</div>
              <div className="text-[9px] font-medium text-slate-500 mt-1 uppercase italic">Gross: ₹{stats?.gross_sales.toLocaleString()} — Ret: ₹{stats?.sales_returns.toLocaleString()}</div>
           </div>
           <div className="relative pt-4 border-t border-white/5 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Collections</span>
                <span className="text-xs font-black text-emerald-400">₹{stats?.customer_paid.toLocaleString()}</span>
              </div>
           </div>
        </Card>

        {/* Net Profit */}
        <Card className="bg-primary border-0 shadow-2xl shadow-primary/20 relative overflow-hidden group p-6 min-h-[180px] flex flex-col justify-between">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign size={80} className="text-white" />
           </div>
           <div className="relative">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.4em] italic mb-3 block">Profit Realized</span>
              <div className="text-3xl font-black text-white italic tracking-tighter">₹{stats?.profit.toLocaleString()}</div>
              <div className="text-[9px] font-medium text-white/40 mt-1 uppercase italic tracking-wide">Margin Index: {((stats?.profit || 0) / (stats?.net_sales || 1) * 100).toFixed(1)}%</div>
           </div>
           <div className="relative pt-4 border-t border-white/10 mt-4">
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (stats?.profit || 0) / (stats?.net_sales || 1) * 100)}%` }} 
                />
              </div>
           </div>
        </Card>

        {/* Damaged Cost */}
        <Card className="bg-white border border-slate-200 shadow-xl relative overflow-hidden group p-6 min-h-[180px] flex flex-col justify-between">
           <div className="absolute top-0 right-0 p-4 opacity-5">
              <AlertTriangle size={80} className="text-rose-600" />
           </div>
           <div className="relative">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] italic mb-3 block text-rose-500">Damage Liability</span>
              <div className="text-3xl font-black text-rose-600 italic tracking-tighter">₹{stats?.damaged_cost.toLocaleString()}</div>
              <div className="text-[9px] font-medium text-slate-400 mt-1 uppercase italic">Inventory Value Loss</div>
           </div>
           <div className="relative pt-4 border-t border-slate-100 mt-4">
              <div className="flex items-center gap-2 text-rose-500/50">
                 <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                 <span className="text-[8px] font-black uppercase tracking-widest">Active Leakage</span>
              </div>
           </div>
        </Card>

        {/* Net Purchase */}
        <Card className="bg-white border border-slate-200 shadow-xl relative overflow-hidden group p-6 min-h-[180px] flex flex-col justify-between">
           <div className="absolute top-0 right-0 p-4 opacity-5">
              <Truck size={80} className="text-slate-900" />
           </div>
           <div className="relative">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] italic mb-3 block">Net Procurement</span>
              <div className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{stats?.net_purchases.toLocaleString()}</div>
              <div className="text-[9px] font-medium text-slate-400 mt-1 uppercase italic">Gross: ₹{stats?.gross_purchases.toLocaleString()} — Ret: ₹{stats?.purchase_returns.toLocaleString()}</div>
           </div>
           <div className="relative pt-4 border-t border-slate-100 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Outflow</span>
                <span className="text-xs font-black text-slate-900">₹{stats?.supplier_paid.toLocaleString()}</span>
              </div>
           </div>
        </Card>
      </div>

      {/* ANALYSIS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Supplier Reconciliation */}
         <Card className="p-0 border-slate-200 overflow-hidden shadow-2xl border flex flex-col">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary">
                     <Activity size={20} />
                   </div>
                   <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase italic leading-none">Procurement Analysis</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Supplier Liability Reconciliation</p>
                   </div>
                </div>
                <Badge variant={stats && stats.supplier_balance <= 0 ? 'success' : 'warning'}>
                   {stats && stats.supplier_balance <= 0 ? 'SETTLED' : 'DUE'}
                </Badge>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white grow">
               <div className="space-y-6">
                  <div className="space-y-1">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block italic">Procurement Outlay</span>
                     <div className="text-2xl font-black text-slate-900 italic tracking-tight">₹{stats?.net_purchases.toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block italic">Total Paid Out</span>
                     <div className="text-2xl font-black text-emerald-600 italic tracking-tight">₹{stats?.supplier_paid.toLocaleString()}</div>
                  </div>
                  <div className="pt-6 border-t border-slate-100 space-y-1">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block italic">Net Balance to Pay</span>
                     <div className="text-3xl font-black text-rose-500 italic tracking-tighter">₹{stats?.supplier_balance.toLocaleString()}</div>
                  </div>
               </div>
               <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-32 h-32">
                     <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                          strokeDasharray={364.42}
                          strokeDashoffset={364.42 * (1 - (stats?.supplier_paid || 0) / (stats?.net_purchases || 1))}
                          className="text-primary transition-all duration-1000"
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black italic">{((stats?.supplier_paid || 0) / (stats?.net_purchases || 1) * 100).toFixed(0)}%</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cleared</span>
                     </div>
                  </div>
                  <p className="text-[10px] text-center font-bold text-slate-400 uppercase italic leading-relaxed px-4">
                     Cleared <span className="text-primary">{((stats?.supplier_paid || 0) / (stats?.net_purchases || 1) * 100).toFixed(1)}%</span> of procurement debt in this period.
                  </p>
               </div>
            </div>
         </Card>

         {/* Customer Collection Analysis */}
         <Card className="p-0 border-slate-200 overflow-hidden shadow-2xl border flex flex-col">
            <div className="bg-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-primary">
                     <PieChart size={20} />
                   </div>
                   <div>
                      <h3 className="text-sm font-black text-white uppercase italic leading-none text-white">Market Recoveries</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Customer Receivables Analytics</p>
                   </div>
                </div>
                <div className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/20 italic">Liquidity Tracking</div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900 grow">
               <div className="space-y-6">
                  <div className="space-y-1">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block italic">Total Market Value</span>
                     <div className="text-2xl font-black text-white italic tracking-tight">₹{stats?.net_sales.toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block italic">Collected Assets</span>
                     <div className="text-2xl font-black text-emerald-400 italic tracking-tight">₹{stats?.customer_paid.toLocaleString()}</div>
                  </div>
                  <div className="pt-6 border-t border-white/5 space-y-1">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block italic">Market Outstanding</span>
                     <div className="text-3xl font-black text-white italic tracking-tighter">₹{stats?.customer_balance.toLocaleString()}</div>
                  </div>
               </div>
               <div className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Collection Ratio</span>
                     <span className="text-xs font-black text-emerald-400 italic">{((stats?.customer_paid || 0) / (stats?.net_sales || 1) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-emerald-400 transition-all duration-1000 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                        style={{ width: `${Math.min(100, (stats?.customer_paid || 0) / (stats?.net_sales || 1) * 100)}%` }}
                     />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase italic leading-relaxed pt-2">
                     Your accounts receivable portfolio consists of <span className="text-white font-black">₹{stats?.customer_balance.toLocaleString()}</span> in uncollected funds from this period.
                  </p>
                  <Button variant="ghost" className="w-full h-10 border-white/10 hover:bg-white/5 text-[10px] text-white">
                     View Defaulters Analysis <ArrowRight size={14} className="ml-2" />
                  </Button>
               </div>
            </div>
         </Card>
      </div>
    </div>
  );
}
