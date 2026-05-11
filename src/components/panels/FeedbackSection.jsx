import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Send, Loader2, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitFeedback, fetchMyFeedbacks, fetchAllFeedbacks } from '@/api';

const MAX_CHARS = 500;
const MAX_PER_WEEK = 4;

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const FeedbackSection = ({ userRole = 'student' }) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAll, setShowAll] = useState(false);

  const loadFeedbacks = useCallback(async () => {
    try {
      const data = await fetchMyFeedbacks();
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load feedbacks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Count feedbacks submitted this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekCount = feedbacks.filter(f => new Date(f.created_at) >= weekStart).length;
  const remainingThisWeek = Math.max(0, MAX_PER_WEEK - thisWeekCount);
  const canSubmit = remainingThisWeek > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) return;
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await submitFeedback(trimmed, userRole);
      setSuccess('Thank you for your feedback! 🎉');
      setFeedbackText('');
      await loadFeedbacks();
      // Auto-clear success after 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to submit feedback.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const charsLeft = MAX_CHARS - feedbackText.length;
  const isOverLimit = charsLeft < 0;
  const displayedFeedbacks = showAll ? feedbacks : feedbacks.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ─── Beta Banner ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="relative px-6 py-5">
          {/* Decorative gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-lg">🚀</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground mb-1.5">Beta Testing Phase</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This platform is currently running in demo mode, and you are among our early beta users.
                We're actively improving the system, so your feedback and suggestions are highly appreciated.
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                Thank you for helping us build a better experience. ✨
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Feedback Form ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-primary" />
          <h2 className="text-base font-semibold">Share Your Feedback</h2>
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock size={12} />
            {canSubmit
              ? <>{remainingThisWeek} of {MAX_PER_WEEK} remaining this week</>
              : <span className="text-amber-500 font-medium">Weekly limit reached</span>
            }
          </span>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="relative">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={canSubmit ? "What's on your mind? Share suggestions, bugs, or improvements…" : "You've used all 4 feedbacks for this week. Come back next week!"}
              disabled={!canSubmit || submitting}
              rows={4}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm outline-none resize-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/60"
            />
            {/* Character counter */}
            <div className={`absolute bottom-3 right-3 text-xs font-mono transition-colors ${
              isOverLimit ? 'text-rose-500 font-semibold' : charsLeft <= 50 ? 'text-amber-500' : 'text-muted-foreground/50'
            }`}>
              {feedbackText.length}/{MAX_CHARS}
            </div>
          </div>

          {/* Status messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-500 rounded-xl text-xs"
              >
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs"
              >
                <CheckCircle2 size={14} /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit || submitting || !feedbackText.trim() || isOverLimit}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Submit Feedback
            </button>
          </div>
        </form>
      </motion.div>

      {/* ─── My Feedbacks ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-emerald-500" />
          <h2 className="text-base font-semibold">My Feedbacks</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {feedbacks.length} {feedbacks.length === 1 ? 'feedback' : 'feedbacks'}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-secondary/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 px-6">
            <MessageSquarePlus size={36} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Be the first to share your thoughts!</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/50">
              <AnimatePresence>
                {displayedFeedbacks.map((fb, idx) => (
                  <motion.div
                    key={fb.id || idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="px-6 py-4 hover:bg-secondary/20 transition-colors"
                  >
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {fb.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-xs text-muted-foreground/70">{timeAgo(fb.created_at)}</span>
                      {fb.status && (
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          fb.status === 'read'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : fb.status === 'resolved'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-secondary/60 text-muted-foreground'
                        }`}>
                          {fb.status}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Show more / less */}
            {feedbacks.length > 3 && (
              <div className="px-6 py-3 border-t border-border/50 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 mx-auto transition-colors"
                >
                  {showAll ? (
                    <>Show Less <ChevronUp size={12} /></>
                  ) : (
                    <>View All {feedbacks.length} Feedbacks <ChevronDown size={12} /></>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export const AllFeedbacksPanel = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAllFeedbacks();
        const studentFeedbacks = data.filter(f => f.user_role === 'student');
        setFeedbacks(studentFeedbacks);
      } catch (err) {
        setError('Failed to load student feedbacks.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8 flex justify-center mt-8">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 mt-8 flex items-center gap-3 text-rose-500">
        <AlertCircle size={18} />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (feedbacks.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
        <MessageSquarePlus size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">Student Feedbacks</h3>
      </div>
      <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
        {feedbacks.map((fb) => (
          <div key={fb.id} className="p-6 hover:bg-secondary/20 transition-colors">
            <div className="flex justify-between items-start gap-4 mb-2">
              <span className="text-sm font-medium text-foreground">{fb.user_name || 'Student'}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                <Clock size={12} />
                {timeAgo(fb.created_at)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fb.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackSection;
