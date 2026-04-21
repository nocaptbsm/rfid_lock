import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchStudentStats } from '@/api';
import { Library, ArrowRight, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const StudentLogin = () => {
  const [roll, setRoll]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const { login }           = useAuth();
  const navigate            = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!roll) return setError('Please enter your roll number');

    setLoading(true);
    setError('');

    try {
      // 1. Attempt to fetch student stats from backend
      const result = await fetchStudentStats(roll.toUpperCase());
      
      // 2. If successful, use the student name from the DB
      login({ 
        roll: result.student.roll_no, 
        name: result.student.name || 'Student', 
        uid: result.student.uid,
        role: 'student' 
      });
      
      navigate(`/student/${result.student.roll_no}`);
    } catch (err) {
      console.error('Login error:', err);
      // If student doesn't exist, we could auto-register or show error.
      // Recommendation: Show error if no record exists (must scan RFID once first)
      if (err.response?.status === 404) {
        setError('Record not found. Have you scanned your RFID card yet?');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl animate-pulse delay-700" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-4"
      >
        {/* ── Student Login card ── */}
        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20 mb-4">
              <Library size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LibraryTrack</h1>
            <p className="text-muted-foreground">Scan your RFID or enter Roll Number</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="roll" className="text-sm font-medium pl-1">Roll Number</label>
              <input
                id="roll"
                type="text"
                placeholder="e.g. 21CS042"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase placeholder:normal-case"
              />
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
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 flex items-center justify-center gap-2 hover:translate-y-[-2px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>Login to Portal <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            RFID Reader Active • Point your card to the scanner
          </p>
        </div>

        {/* ── Admin Portal entry ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/admin-login"
            id="admin-portal-btn"
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/70 text-sm font-medium text-muted-foreground hover:text-foreground transition-all group"
          >
            <ShieldCheck size={16} className="text-primary group-hover:scale-110 transition-transform" />
            Admin Portal
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default StudentLogin;
