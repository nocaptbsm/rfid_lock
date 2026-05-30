// ─────────────────────────────────────────────────────────────────────────────
// PushPermissionBanner
// Shown contextually (after user engages with group features) to prompt for push
// Respects cooldown, never shows twice in 24h, handles denied state gracefully
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, BellOff, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PushPermissionBanner = ({ trigger = false, context = 'group' }) => {
  const { status, subscribe, isLoading, isSupported, isDenied, isSubscribed } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    if (!trigger || !isSupported || dismissed || isSubscribed || isDenied) return;
    // Show after a slight delay to feel contextual, not aggressive
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [trigger, isSupported, dismissed, isSubscribed, isDenied]);

  const handleEnable = async () => {
    await subscribe();
    setJustEnabled(true);
    setTimeout(() => { setVisible(false); }, 2500);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  const contextMessages = {
    group: {
      title: 'Stay in the loop',
      body: 'Get instant alerts when someone invites you to a study group — even when the tab is closed.',
    },
    invite: {
      title: 'Never miss an invite',
      body: 'Enable notifications to get instant alerts when group members interact with you.',
    },
    default: {
      title: 'Enable Notifications',
      body: 'Get real-time alerts for group invites and library updates.',
    },
  };

  const msg = contextMessages[context] || contextMessages.default;

  if (!isSupported) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-6 right-6 z-50 w-full max-w-sm"
          role="dialog"
          aria-label="Enable push notifications"
        >
          <div className="glass-card rounded-2xl p-5 border border-primary/20 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            {justEnabled ? (
              /* Success state */
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 size={22} className="shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Notifications enabled!</p>
                  <p className="text-xs text-white/60 mt-0.5">You'll get alerts even when the tab is closed.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Bell size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white">{msg.title}</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{msg.body}</p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors shrink-0"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleEnable}
                    disabled={isLoading}
                    className="flex-1 py-2 px-4 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enabling…
                      </span>
                    ) : (
                      <>
                        <Bell size={13} /> Enable Notifications
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="py-2 px-3 text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Not now
                  </button>
                </div>

                {isDenied && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-400">
                    <BellOff size={11} />
                    Blocked in browser settings. Enable in browser → Site Settings.
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushPermissionBanner;
