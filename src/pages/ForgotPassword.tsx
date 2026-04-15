import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { Button, Input, Card } from '../components/UI';
import { Mail, ArrowLeft } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await authService.resetPasswordForEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-slate-50 to-slate-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex w-16 h-16 bg-white border border-slate-100 rounded-2xl items-center justify-center text-primary shadow-xl shadow-slate-200/50 mb-2">
            <Mail size={32} />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Reset Password</h1>
          <p className="text-slate-500 font-medium">We'll send a recovery link to your email</p>
        </div>

        <Card className="p-10 border-slate-200/60 shadow-2xl shadow-slate-200/50">
          {success ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-medium">
                Check your email for the reset link!
              </div>
              <Link to="/login">
                <Button variant="ghost" className="w-full gap-2">
                  <ArrowLeft size={18} />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                placeholder="admin@architect.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full py-4 text-base" 
                disabled={loading}
              >
                {loading ? 'Sending link...' : 'Send Recovery Email'}
              </Button>

              <div className="text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">
                  <ArrowLeft size={14} />
                  Return to login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
