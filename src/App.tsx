import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Brands } from './pages/Brands';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Purchases } from './pages/Purchases';
import { Billing } from './pages/Billing';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { UpdatePassword } from './pages/UpdatePassword';
import { CustomerDetails } from './pages/CustomerDetails';
import { SupplierDetails } from './pages/SupplierDetails';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return session ? <>{children}</> : <Navigate to="/login" />;
}

import { Toaster } from 'react-hot-toast';

export function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#fff', fontSize: '12px', fontWeight: 'bold' } }} />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Protected Routes */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="inventory/products" element={<Products />} />
            <Route path="inventory/categories" element={<Categories />} />
            <Route path="inventory/brands" element={<Brands />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetails />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="suppliers/:id" element={<SupplierDetails />} />
            <Route path="billing" element={<Billing />} />
            <Route path="purchases" element={<Purchases />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
