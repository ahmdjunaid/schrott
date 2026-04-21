import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { Button, Input, Card } from '../components/UI';
import { LogIn } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-slate-50 to-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
           <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
                 <LogIn size={20} className="text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">Schrott.<span className="text-slate-400">Billing</span></h1>
           </div>
           <p className="text-slate-500 font-bold text-sm">Professional Billing & Inventory Management</p>
        </div>

        <Card className="shadow-2xl shadow-slate-200/60 border-slate-200/60">
          <div className="space-y-6">
            <div className="space-y-1">
               <h2 className="text-xl font-bold text-slate-900">Sign In</h2>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Enter credentials to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="space-y-2">
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end px-1">
                  <Link 
                    to="/forgot-password" 
                    className="text-[10px] font-black text-primary hover:text-primary-hover transition-colors uppercase tracking-widest"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[11px] font-bold text-center animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full py-4 rounded-lg shadow-lg shadow-primary/20" 
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-4">
           <p className="text-center text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">
             Schrott Billing v2.0
           </p>
           <div className="h-px w-12 bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
