import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Calendar, Clock, ArrowLeft, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchStudentStats } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { Link, useParams, Navigate } from 'react-router-dom';
import StatusBadge from '@/components/cards/StatusBadge';
import { applySessionsCutoff, isSessionActive } from '@/utils/sessionUtils';
import { fmtDate, fmtTime, fmtDuration } from '@/utils/formatUtils';

const PAGE_SIZE = 15;

// ─── Skeleton Row ───────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-white/10 rounded-md animate-pulse" style={{ width: i === 0 ? '80px' : i === 4 ? '60px' : '70px' }} />
      </td>
    ))}
  </tr>
);

const StudentHistory = () => {
  const { user } = useAuth();
  const { roll } = useParams();
  const targetRoll = roll || user?.roll;

  // CRITICAL-6: URL guard for history page
  if (roll && user?.roll && roll !== user.roll) {
    return <Navigate to={`/student/${user.roll}/history`} replace />;
  }

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Filter / Pagination state ───────────────────────────────
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);

  useEffect(() => {
    if (targetRoll) {
      const fetchHistory = async () => {
        try {
          const res = await fetchStudentStats(targetRoll);
          const allSessions = [];
          if (res.weeklySessions?.length > 0) allSessions.push(...res.weeklySessions);
          if (res.todaySessions?.length > 0) {
            const existingIds = new Set(allSessions.map(s => s.id));
            res.todaySessions.forEach(s => { if (!existingIds.has(s.id)) allSessions.push(s); });
          }
          allSessions.sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));
          setHistory(applySessionsCutoff(allSessions));
        } catch (error) {
          console.error('Failed to fetch history:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [targetRoll]);

  // ─── Filtered results ────────────────────────────────────────
  const filtered = history.filter(s => {
    const entryDate = new Date(s.entry_time);
    const localStr = entryDate.toISOString().split('T')[0];
    if (dateFrom && localStr < dateFrom) return false;
    if (dateTo   && localStr > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!fmtDate(s.entry_time).toLowerCase().includes(q) &&
          !fmtTime(s.entry_time).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const paginated = filtered.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/student/${targetRoll}`} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/70 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <History size={24} className="text-primary" /> My History
            </h1>
            <p className="text-white/60 text-sm mt-1">Complete log of your library sessions</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        {/* ── Filters header ── */}
        <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h2 className="font-semibold text-lg">Session Records</h2>
            <p className="text-xs text-white/50 mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} of ${history.length} records`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search date / time…"
                className="pl-8 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-primary/50 w-44 text-white placeholder:text-white/30"
              />
            </div>
            {/* Date from */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-primary/50 text-white/70"
              title="From date"
            />
            {/* Date to */}
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-primary/50 text-white/70"
              title="To date"
            />
            {(search || dateFrom || dateTo) && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/25 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-white/50 uppercase bg-black/20 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Entry Time</th>
                  <th className="px-6 py-4 font-semibold">Exit Time</th>
                  <th className="px-6 py-4 font-semibold text-right">Duration</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-white/50">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No records found</p>
              {(search || dateFrom || dateTo) && (
                <button onClick={clearFilters} className="mt-3 text-xs text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-white/50 uppercase bg-black/20 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Entry Time</th>
                  <th className="px-6 py-4 font-semibold">Exit Time</th>
                  <th className="px-6 py-4 font-semibold text-right">Duration</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.map((session, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/80">
                        <Calendar size={14} className="text-white/40" />
                        {fmtDate(session.entry_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {fmtTime(session.entry_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {session.exit_time ? (
                        <div className="flex items-center gap-2 text-white/70">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          {fmtTime(session.exit_time)}
                          {session._autoClosed && (
                            <span className="text-xs text-amber-400 ml-1">(10 PM cutoff)</span>
                          )}
                        </div>
                      ) : isSessionActive(session) ? (
                        <span className="text-emerald-400 italic text-xs font-semibold">Active now</span>
                      ) : (
                        <span className="text-white/40 italic">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-primary">
                      {session.exit_time ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock size={14} />
                          {fmtDuration(session.duration_minutes)}
                        </div>
                      ) : isSessionActive(session) ? (
                        <span className="text-amber-400 text-xs font-semibold px-2 py-1 bg-amber-400/10 rounded-md">Active</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-semibold px-2 py-1 bg-amber-400/10 rounded-md">Auto-closed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge active={!session.exit_time && isSessionActive(session)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/10">
            <p className="text-xs text-white/50">
              Showing{' '}
              <span className="font-medium text-white">{(effectivePage - 1) * PAGE_SIZE + 1}</span>
              {' '}–{' '}
              <span className="font-medium text-white">{Math.min(effectivePage * PAGE_SIZE, filtered.length)}</span>
              {' '}of{' '}
              <span className="font-medium text-white">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={effectivePage === 1}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-white/70 min-w-[60px] text-center">
                Page {effectivePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={effectivePage === totalPages}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default StudentHistory;
