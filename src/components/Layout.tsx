import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  Copyright, 
  Users, 
  Receipt, 
  LogOut,
  Menu,
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
];

const moreLinks = [
  { name: 'Categories', id: 'categories', href: '/inventory/categories', icon: Tags },
  { name: 'Brands', id: 'brands', href: '/inventory/brands', icon: Copyright },
];

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-expand "More" if active link is inside it
  React.useEffect(() => {
    if (moreLinks.some(link => location.pathname === link.href)) {
      setIsMoreOpen(true);
    }
  }, [location.pathname]);

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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-[240px] bg-white border-r border-slate-200 z-50 transition-all duration-300 transform",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="h-20 flex items-center px-6 border-b border-slate-100 mb-2">
            <h1 className="text-2xl font-black text-primary tracking-tighter" style={{ fontFamily: "var(--font-sans)" }}>
              Schrott.<span className="text-slate-400">Billing</span>
            </h1>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href || (link.href !== '/' && location.pathname.startsWith(link.href));
              
              return (
                <Link
                  key={link.id}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all relative group",
                    isActive 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={16} className={cn(
                    "transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  {link.name}
                </Link>
              );
            })}

            {/* Collapsible More Section */}
            <div className="pt-2">
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className="flex items-center justify-between w-full px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                More
                <ChevronDown size={14} className={cn("transition-transform duration-300", isMoreOpen && "rotate-180")} />
              </button>
              
              {isMoreOpen && (
                <div className="mt-1 space-y-1 animate-in slide-in-from-top-2 duration-300">
                  {moreLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.href;
                    
                    return (
                      <Link
                        key={link.id}
                        to={link.href}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-bold transition-all relative group ml-2",
                          isActive 
                            ? "bg-slate-900 text-white shadow-md shadow-slate-900/20" 
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                        )}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <Icon size={14} className={cn(
                          "transition-colors",
                          isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                        )} />
                        {link.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* User Section Bottom */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group"
            >
              <LogOut size={16} className="text-slate-400 group-hover:text-red-500" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-4 w-full max-w-7xl mx-auto">
            <button 
              className="lg:hidden p-2 text-slate-600 hover:bg-white rounded-lg shadow-sm border border-slate-200"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div className="flex-1 flex items-center justify-between gap-8">

               <div className="flex items-center gap-3 ml-auto">
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-xs font-bold text-slate-900">{user?.email?.split('@')[0]}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Administrator</span>
                  </div>
                  <Avatar fallback={user?.email || 'AD'} size="md" />
               </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
