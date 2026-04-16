import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard';
import { Card, Table, cn, Button, Badge } from '../components/UI';
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  Receipt,
  ArrowUpRight,
  Wallet,
  Calendar,
  Filter,
  ChevronDown
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { DashboardStats, Bill } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [filterType, setFilterType] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [filterType, customRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (filterType) {
      case 'today':
        return { 
          start: startOfDay(now).toISOString(), 
          end: endOfDay(now).toISOString() 
        };
      case 'week':
        return { 
          start: startOfDay(subDays(now, 7)).toISOString(), 
          end: endOfDay(now).toISOString() 
        };
      case 'month':
        return { 
          start: startOfDay(subMonths(now, 1)).toISOString(), 
          end: endOfDay(now).toISOString() 
        };
      case 'custom':
        return customRange.start && customRange.end ? {
          start: startOfDay(new Date(customRange.start)).toISOString(),
          end: endOfDay(new Date(customRange.end)).toISOString()
        } : { start: undefined, end: undefined };
      default:
        return { start: undefined, end: undefined };
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const [sData, rData] = await Promise.all([
        dashboardService.getStats(start, end),
        dashboardService.getRecentBills()
      ]);
      setStats(sData);
      setRecentBills(rData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Sales', 
      value: `₹${stats?.totalSales.toFixed(2) || '0.00'}`, 
      icon: TrendingUp, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50 border-indigo-100',
      description: 'Total revenue from all bills'
    },
    { 
      label: 'Collected Amount', 
      value: `₹${stats?.totalPaid.toFixed(2) || '0.00'}`, 
      icon: Wallet, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50 border-emerald-100',
      description: 'Total payments received'
    },
    { 
      label: 'Pending Balance', 
      value: `₹${stats?.totalPending.toFixed(2) || '0.00'}`, 
      icon: Receipt, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50 border-amber-100',
      description: 'Outstanding payments to be collected'
    },
    { 
      label: 'Low Stock Alerts', 
      value: stats?.lowStockCount || 0, 
      icon: AlertTriangle, 
      color: (stats?.lowStockCount || 0) > 0 ? 'text-amber-600' : 'text-slate-400', 
      bg: (stats?.lowStockCount || 0) > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100',
      description: 'Items below minimum stock levels'
    },
  ];

  return (
    <div className="space-y-4 py-0">
      {/* Welcome & Filter Terminal */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic">Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3 text-[10px] text-slate-600 font-black uppercase tracking-wider">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
               Latest Updates • {format(new Date(), 'dd MMM, yyyy')}
             </div>
          </div>
        </div>

        {/* Filter Control Terminal */}
        <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: '1 Week' },
            { id: 'month', label: '1 Month' },
            { id: 'custom', label: 'Custom Range' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setFilterType(preset.id as any);
                if (preset.id !== 'custom') setShowCustomPicker(false);
                else setShowCustomPicker(!showCustomPicker);
              }}
              className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                filterType === preset.id 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {preset.label}
            </button>
          ))}
          
          {showCustomPicker && filterType === 'custom' && (
            <div className="flex items-center gap-2 ml-4 animate-in slide-in-from-left-2 duration-300">
              <input 
                type="date" 
                className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5 italic"
                value={customRange.start}
                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
              />
              <span className="text-[10px] font-black text-slate-300 uppercase">To</span>
              <input 
                type="date" 
                className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5 italic"
                value={customRange.end}
                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className={cn("group hover:shadow-md transition-all duration-300 border-l-4", stat.color.replace('text', 'border'))}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 italic tracking-tight">{stat.value}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter truncate">{stat.description}</p>
              </div>
              <div className={cn("p-2.5 rounded-lg border shadow-sm", stat.bg, stat.color)}>
                <stat.icon size={18} strokeWidth={2.5} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Ledger Workspace */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-0.5">
             <h3 className="text-lg font-bold text-slate-900 italic">Recent Sales</h3>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">A real-time record of your latest bills and payments.</p>
          </div>
          <Link to="/billing">
             <Button variant="secondary" size="sm" className="font-black italic">View All Bills</Button>
          </Link>
        </div>
        <Card className="p-0 border-slate-200 overflow-hidden shadow-lg shadow-slate-200/50">
          <Table headers={['Bill No', 'Customer Name', 'Total Amount', 'Status']}>
            {recentBills.map((bill) => (
              <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-8 py-5 font-black text-slate-900 text-xs italic">
                  #BILL-{bill.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-6 py-5">
                   <div className="text-xs font-black text-slate-700 italic uppercase">{bill.customer?.shop_name}</div>
                   <div className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-1">Customer</div>
                </td>
                <td className="px-6 py-5 font-black text-lg text-slate-900 italic tracking-tighter">₹{bill.total_amount.toFixed(2)}</td>
                <td className="px-8 py-5">
                  <Badge status={bill.status} />
                </td>
              </tr>
            ))}
            {recentBills.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                     <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Receipt size={32} className="text-slate-200" />
                     </div>
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic leading-relaxed">No sales records found for<br/>the selected timeframe</p>
                  </div>
                </td>
              </tr>
            )}
          </Table>
        </Card>
      </div>
    </div>
  );
}
