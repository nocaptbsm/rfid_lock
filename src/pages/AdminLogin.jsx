import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, ArrowRight, AlertCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

// Hard-coded admin credentials (in production these come from a secure backend)
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username || !password) return setError('Please fill in both fields');

    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      if (
        username.toLowerCase() === ADMIN_CREDENTIALS.username &&
        password            === ADMIN_CREDENTIALS.password
      ) {
        login({ roll: 'ADMIN', name: 'Administrator', role: 'admin' });
        navigate('/admin');
      } else {
        setError('Invalid username or password');
      }
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-600/10 rounded-full blur-3xl animate-pulse delay-700" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-8 space-y-8">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to Student Login
          </Link>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20 mb-4">
              <ShieldCheck size={30} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
            <p className="text-muted-foreground text-sm">
              Secure access for library administrators
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="admin-username" className="text-sm font-medium pl-1">Username</label>
              <input
                id="admin-username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="admin-password" className="text-sm font-medium pl-1">Password</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              id="admin-login-btn"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 flex items-center justify-center gap-2 hover:translate-y-[-2px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>Access Dashboard <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Default: admin / admin123
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
