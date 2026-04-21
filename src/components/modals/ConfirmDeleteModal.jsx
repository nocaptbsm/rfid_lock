import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';

const ConfirmDeleteModal = ({ student, onConfirm, onCancel, loading }) => {
  if (!student) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle size={24} />
            </div>
            <button
              onClick={onCancel}
              className="p-1 hover:bg-secondary rounded-md text-muted-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-2 mb-8">
            <h3 className="text-xl font-bold">Delete Student Records?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all attendance logs for 
              <span className="text-foreground font-semibold px-1">
                {student.name || student.roll || student.uid}
              </span>. 
              This action cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              disabled={loading}
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Delete All Records'
              )}
            </button>
          </div>

          {/* Decor */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDeleteModal;
