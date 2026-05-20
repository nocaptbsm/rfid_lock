import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Target, ShieldAlert, Loader2, AlertCircle } from 'lucide-react';

const CreateGroupModal = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [targetHours, setTargetHours] = useState('5');
  const [penaltyPoints, setPenaltyPoints] = useState('20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await onSubmit(name, targetHours, penaltyPoints);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-6 glass-card rounded-2xl shadow-xl border border-border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="text-primary" size={24} /> Create a Group
              </h2>
              <button 
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Group Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Night Owls"
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Target size={16} className="text-blue-500" /> Daily Target Hours
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="24"
                  step="0.5"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-500" /> Penalty Points (Per Missed Day)
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  max="100"
                  value={penaltyPoints}
                  onChange={(e) => setPenaltyPoints(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Points deducted from the group's total when a member fails to meet the daily target.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-foreground bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Group'}
                </button>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateGroupModal;
