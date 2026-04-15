import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard';
import { Card, Table } from '../components/UI';
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  Receipt,
  ArrowUpRight,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { DashboardStats, Bill } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sData, rData] = await Promise.all([
        dashboardService.getStats(),
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

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Revenue', 
      value: `₹${stats.totalSales.toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bg: 'bg-green-100',
      description: 'Total billed amount'
    },
    { 
      label: 'Collections', 
      value: `₹${stats.totalPaid.toFixed(2)}`, 
      icon: Wallet, 
      color: 'text-blue-600', 
      bg: 'bg-blue-100',
      description: 'Total amount received'
    },
    { 
      label: 'Outstanding', 
      value: `₹${stats.totalPending.toFixed(2)}`, 
      icon: Receipt, 
      color: 'text-orange-600', 
      bg: 'bg-orange-100',
      description: 'Pending payments'
    },
    { 
      label: 'Low Stock', 
      value: stats.lowStockCount, 
      icon: AlertTriangle, 
      color: stats.lowStockCount > 0 ? 'text-red-600' : 'text-slate-600', 
      bg: stats.lowStockCount > 0 ? 'bg-red-100' : 'bg-slate-100',
      description: 'Items needing restock'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Business Summary</h2>
          <p className="text-slate-500 mt-1">Here's what's happening with your store today.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2 text-sm text-slate-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          System Active: {format(new Date(), 'dd MMMM, yyyy')}
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="group hover:border-primary/50 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-2">{stat.description}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                <stat.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Invoices */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Recent Invoices</h3>
            <Link to="/billing" className="text-sm font-medium text-primary hover:underline">View All</Link>
          </div>
          <Card className="p-0 overflow-hidden">
            <Table headers={['Invoice', 'Customer', 'Amount', 'Status']}>
              {recentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">
                    INV-{bill.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 text-slate-900">{bill.customer?.shop_name}</td>
                  <td className="px-6 py-4 font-semibold">₹{bill.total_amount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                      bill.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      bill.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentBills.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">No recent activity.</td>
                </tr>
              )}
            </Table>
          </Card>
        </div>

        {/* Quick Links / Inventory Status */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">Inventory Status</h3>
          <Card className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{stats.productsCount}</div>
                  <div className="text-xs text-slate-500">Total Products</div>
                </div>
              </div>
              <Link to="/inventory/products" className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors">
                <ArrowUpRight size={18} />
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{stats.customersCount}</div>
                  <div className="text-xs text-slate-500">Registered Customers</div>
                </div>
              </div>
              <Link to="/customers" className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors">
                <ArrowUpRight size={18} />
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/inventory/categories" className="flex items-center justify-center p-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Categories
                </Link>
                <Link to="/inventory/brands" className="flex items-center justify-center p-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Brands
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
