import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, Copy, Check, ShieldCheck } from 'lucide-react';

/**
 * GeneratedPasswordModal — replaces window.alert() for showing newly created
 * student passwords. Shows password in a copyable field.
 *
 * Props:
 *   isOpen   {boolean}
 *   name     {string}  — student name
 *   password {string}  — generated password
 *   onClose  {fn}
 */
const GeneratedPasswordModal = ({ isOpen, name, password, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = password;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">Card Registered</h3>
                    <p className="text-xs text-muted-foreground">Save this password now</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Student <span className="font-semibold text-foreground">{name}</span> has been
                  registered. Their generated login password is shown below.
                </p>

                {/* Password display */}
                <div className="flex items-center gap-2 p-3 bg-secondary/50 border border-border rounded-xl">
                  <KeyRound size={16} className="text-muted-foreground shrink-0" />
                  <code className="flex-1 text-sm font-mono text-foreground tracking-widest select-all">
                    {password}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
                    title="Copy to clipboard"
                    aria-label="Copy password"
                  >
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.span
                          key="check"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        >
                          <Check size={15} className="text-emerald-500" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        >
                          <Copy size={15} className="text-muted-foreground" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ This password will not be shown again. Please share it with the student securely.
                </div>
              </div>

              {/* Footer */}
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GeneratedPasswordModal;
