import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  Copyright, 
  Users, 
  Receipt, 
  BarChart3, 
  LogOut,
  Menu,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { cn, Avatar } from './UI';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth';

const sidebarLinks = [
  { name: 'Dashboard', id: 'dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Billing', id: 'billing', href: '/billing', icon: Receipt },
  { name: 'Purchases', id: 'purchases', href: '/purchases', icon: ShoppingBag },
  { name: 'Products', id: 'products', href: '/inventory/products', icon: Package },
  { name: 'Suppliers', id: 'suppliers', href: '/suppliers', icon: Truck },
  { name: 'Customers', id: 'customers', href: '/customers', icon: Users },
  { name: 'Reports', id: 'reports', href: '/reports', icon: BarChart3 },
];

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-[280px] bg-white border-r border-slate-100 z-50 transition-all duration-300 transform",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col p-6">
          {/* Logo Section */}
          <div className="flex items-center px-6 mb-6">
            <h1 className="text-4xl italic font-bold text-blue-700 tracking-wider" style={{ fontFamily: "'Anton', sans-serif" }}>
              Schrott
            </h1>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href || (link.href !== '/' && location.pathname.startsWith(link.href));
              
              return (
                <Link
                  key={link.id}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group",
                    isActive 
                      ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)]" 
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={20} className={cn(
                    "transition-colors",
                    isActive ? "text-[var(--sidebar-text-active)]" : "text-slate-300 group-hover:text-slate-600"
                  )} />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* User Section Bottom */}
          <div className="pt-6 border-t border-slate-50 mt-6">
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3 w-full rounded-2xl text-[13px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all group"
            >
              <LogOut size={20} className="text-slate-300 group-hover:text-red-400" />
              Logout Session
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-24 px-10 flex items-center justify-between sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-xl z-30">
          {/* Left: Mobile Menu */}
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-600 hover:bg-white rounded-xl shadow-sm border border-slate-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Right: Search Bar */}
          <div className="flex items-center justify-end flex-1">
            <div className="relative group max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search inventory, IDs..."
                className="w-full h-12 pl-12 pr-4 bg-white border-transparent focus:border-slate-100 rounded-2xl text-sm transition-all focus:ring-4 focus:ring-slate-200/40 shadow-sm outline-none"
              />
            </div>
          </div>

          {/* Right: Notifications & Profile - REMOVED */}
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-10 pt-4 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
