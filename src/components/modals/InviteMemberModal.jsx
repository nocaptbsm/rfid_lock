import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { useGroup } from '@/context/GroupContext';

const InviteMemberModal = ({ isOpen, onClose }) => {
  const { inviteMember, inviteError, setInviteError, sentInvites } = useGroup();
  const [rollInput, setRollInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollInput.trim()) return;
    setLoading(true);
    setSuccessMsg('');
    setInviteError(null);

    const result = await inviteMember(rollInput.trim());
    setLoading(false);

    if (result.success) {
      setSuccessMsg(`Invite sent to ${rollInput.trim().toUpperCase()}!`);
      setRollInput('');
    }
  };

  const handleClose = () => {
    setRollInput('');
    setSuccessMsg('');
    setInviteError(null);
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
                <UserPlus className="text-primary" size={22} /> Invite a Member
              </h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Student Roll Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={rollInput}
                    onChange={(e) => { setRollInput(e.target.value); setInviteError(null); setSuccessMsg(''); }}
                    placeholder="e.g. 21CS011"
                    className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50 uppercase"
                  />
                  <button
                    type="submit"
                    disabled={loading || !rollInput.trim()}
                    className="px-4 py-3 rounded-xl font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the student's roll number. They must not already be in a group.
                </p>
              </div>

              <AnimatePresence mode="popLayout">
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-sm font-medium"
                  >
                    <CheckCircle size={16} /> {successMsg}
                  </motion.div>
                )}
                {inviteError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm font-medium"
                  >
                    <AlertCircle size={16} /> {inviteError}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Sent invites list */}
            {sentInvites?.length > 0 && (
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pending Invites Sent</p>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {sentInvites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-sm px-3 py-2 bg-secondary/50 rounded-xl">
                      <span className="font-medium">{inv.receiverRoll}</span>
                      <span className="text-xs text-amber-500 font-medium">Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InviteMemberModal;
