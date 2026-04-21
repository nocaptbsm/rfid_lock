import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, Clock, Activity, Search, Tag, Pencil,
  Check, X, LogIn, LogOut, ChevronDown, ChevronUp,
  Download, RefreshCw, Loader2, AlertCircle, Wifi,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRfid } from '@/context/RfidContext';
import { deleteStudentLogs, updateStudentName } from '@/api';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import LeaderboardPanel from '@/components/panels/LeaderboardPanel';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

/* ─── helpers ───────────────────────────────────────────────── */
const cn = (...c) => c.filter(Boolean).join(' ');

const badge = (type) =>
  type === 'ENTRY'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'short', timeStyle: 'short'
  });
};

/* ─── useLiveData hook ──────────────────────────────────────── */
const useLiveData = () => {
  const [logs,     setLogs]     = useState([]);
  const [live,     setLive]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [lastSync, setLastSync] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [logsRes, liveRes] = await Promise.all([
        fetch(`${BASE_URL}/admin/logs`),
        fetch(`${BASE_URL}/admin/live`),
      ]);

      if (!logsRes.ok) throw new Error(`Logs: ${logsRes.status}`);
      if (!liveRes.ok) throw new Error(`Live: ${liveRes.status}`);

      const [logsData, liveData] = await Promise.all([
        logsRes.json(),
        liveRes.json(),
      ]);

      setLogs(logsData);
      setLive(liveData);
      setError('');
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { logs, live, loading, error, lastSync, refresh: fetchAll };
};

/* ─── Stat card ─────────────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, color = 'primary', loading }) => (
  <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
    <div className={cn(
      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
      color === 'primary' && 'bg-primary/10 text-primary',
      color === 'emerald' && 'bg-emerald-500/10 text-emerald-500',
      color === 'amber'   && 'bg-amber-500/10 text-amber-500',
    )}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      {loading
        ? <div className="h-7 w-16 bg-secondary/60 rounded-lg animate-pulse mt-1" />
        : <p className="text-2xl font-bold mt-0.5">{value}</p>}
    </div>
  </div>
);

/* ─── Inline rename cell ────────────────────────────────────── */
const RenameCell = ({ rfid, fallback, onSave }) => {
  const { aliases, setAlias, removeAlias } = useRfid();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft,   setDraft]   = useState('');
  const current = aliases[rfid?.toUpperCase()];
  const display = current || fallback || rfid;

  const startEdit = () => { setDraft(current || fallback || ''); setEditing(true); };
  const save = async () => {
    if (!draft.trim()) return cancel();
    setLoading(true);
    try {
      await updateStudentName(rfid, draft.trim());
      setAlias(rfid, draft.trim());
      if (onSave) onSave();
      setEditing(false);
    } catch (err) {
      console.error('Failed to rename student:', err);
    } finally {
      setLoading(false);
    }
  };
  const cancel = () => setEditing(false);

  if (editing) return (
    <div className="flex items-center gap-1.5 text-black">
      <input
        autoFocus
        disabled={loading}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        placeholder="Student name"
        className="px-2 py-1 text-xs rounded-lg bg-secondary/60 border border-primary/40 outline-none w-36 focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
      />
      <button onClick={save} disabled={loading} className="p-1 rounded-md hover:bg-emerald-500/20 text-emerald-500 disabled:opacity-50">
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button onClick={cancel} disabled={loading} className="p-1 rounded-md hover:bg-rose-500/20 text-rose-500 disabled:opacity-50"><X size={13} /></button>
    </div>
  );

  return (
    <button onClick={startEdit} className="flex items-center gap-1.5 group/rename text-left">
      <span className={cn('text-sm', !current && 'text-muted-foreground italic')}>{display}</span>
      <Pencil size={12} className="opacity-0 group-hover/rename:opacity-60 transition-opacity text-primary shrink-0" />
    </button>
  );
};

/* ─── Active sessions panel ─────────────────────────────────── */
const LiveSessionsPanel = ({ live, loading, onDeleteStudent, onRefresh }) => (
  <div className="glass-card rounded-2xl overflow-hidden">
    <div className="px-6 py-4 border-b border-border flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <h2 className="text-base font-semibold">Live Sessions</h2>
      <span className="ml-auto text-xs text-muted-foreground">{live.length} active</span>
    </div>
    {loading ? (
      <div className="p-6 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary/40 rounded-lg animate-pulse" />)}
      </div>
    ) : live.length === 0 ? (
      <p className="text-center py-10 text-sm text-muted-foreground">No active sessions right now</p>
    ) : (
      <div className="divide-y divide-border/50">
        {live.map((s) => {
          const uid  = s.students?.uid  || '—';
          const name = s.students?.name || uid;
          const roll = s.students?.roll_no || '';
          return (
            <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-secondary/20 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Users size={14} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <RenameCell rfid={uid} fallback={name} onSave={onRefresh} />
                <p className="text-xs text-muted-foreground">{roll} • entered {fmtTime(s.entry_time)}</p>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">{uid}</code>
                <button
                   onClick={() => onDeleteStudent({ uid, name, roll })}
                   className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                   title="Delete all records for this student"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

/* ─── Full RFID log table ───────────────────────────────────── */
const RfidLogTable = ({ logs, loading, onDeleteStudent, onRefresh }) => {
  const { resolveName } = useRfid();
  const [search,     setSearch]  = useState('');
  const [typeFilter, setType]    = useState('ALL');
  const [sortDir,    setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    let rows = [...logs];
    if (typeFilter !== 'ALL') rows = rows.filter(r => r.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.students?.uid  || '').toLowerCase().includes(q) ||
        (r.students?.name || '').toLowerCase().includes(q) ||
        resolveName(r.students?.uid || '').toLowerCase().includes(q) ||
        (r.timestamp || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => sortDir === 'desc'
      ? new Date(b.timestamp) - new Date(a.timestamp)
      : new Date(a.timestamp) - new Date(b.timestamp)
    );
    return rows;
  }, [logs, search, typeFilter, sortDir, resolveName]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold">Complete RFID Access Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} records</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search RFID, name, time…"
              className="pl-8 pr-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48"
            />
          </div>
          {['ALL','ENTRY','EXIT'].map(f => (
            <button key={f} onClick={() => setType(f)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg transition-all',
                typeFilter === f
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              )}>
              {f === 'ENTRY' && '↑ '}{f === 'EXIT' && '↓ '}{f}
            </button>
          ))}
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="p-2 rounded-lg bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors">
            {sortDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({length: 5}).map((_,i) => (
              <div key={i} className="h-10 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">RFID Tag</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No records found</td></tr>
                )}
                {filtered.map((row, idx) => {
                  const uid  = row.students?.uid  || '—';
                  const name = row.students?.name || uid;
                  return (
                    <motion.tr key={row.id} layout
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                      className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-muted-foreground text-xs">{row.id}</td>
                      <td className="px-6 py-3.5">
                        <code className="text-xs font-mono bg-secondary/70 px-2 py-1 rounded-md">{uid}</code>
                      </td>
                      <td className="px-6 py-3.5 flex items-center justify-between group/row">
                        <RenameCell rfid={uid} fallback={name} onSave={onRefresh} />
                        <button
                          onClick={() => onDeleteStudent({ uid, name, roll: row.students?.roll_no })}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover/row:opacity-100"
                          title="Delete all records for this student"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', badge(row.type))}>
                          {row.type === 'ENTRY' ? <LogIn size={11} /> : <LogOut size={11} />}
                          {row.type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground text-xs tabular-nums">{fmtTime(row.timestamp)}</td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ─── Admin Dashboard ───────────────────────────────────────── */
const AdminDashboard = () => {
  const { logs, live, loading, error, lastSync, refresh } = useLiveData();
  const { leaderboard, loading: leaderLoading } = useLeaderboard();
  const [targetStudent, setTargetStudent] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!targetStudent) return;
    setDeleting(true);
    try {
      await deleteStudentLogs(targetStudent.uid, targetStudent.roll);
      setTargetStudent(null);
      refresh();
    } catch (err) {
      console.error('Failed to delete student logs:', err);
    } finally {
      setDeleting(false);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

  // Derived stats
  const totalEntries = logs.filter(l => l.type === 'ENTRY').length;
  const totalExits   = logs.filter(l => l.type === 'EXIT').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
          <p className="text-muted-foreground">
            Live RFID access log&nbsp;•&nbsp;
            {lastSync
              ? <span className="text-xs">Last sync {lastSync.toLocaleTimeString()}</span>
              : <span className="text-xs text-muted-foreground">connecting…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle size={13} /> {error}
            </span>
          )}
          <button onClick={refresh}
            className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-secondary/80 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard title="Currently Inside"  value={live.length}   icon={Users}    color="primary" loading={loading} />
        <StatCard title="Total Entries Today" value={totalEntries} icon={LogIn}    color="emerald" loading={loading} />
        <StatCard title="Total Exits Today"   value={totalExits}   icon={Activity} color="amber"   loading={loading} />
      </motion.div>

      {/* Live sessions & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div variants={item} className="lg:col-span-2">
          <LiveSessionsPanel live={live} loading={loading} onDeleteStudent={setTargetStudent} onRefresh={refresh} />
        </motion.div>
        
        <motion.div variants={item} className="h-[400px] lg:h-auto">
          <LeaderboardPanel leaderboard={leaderboard} loading={leaderLoading} currentRoll={null} />
        </motion.div>
      </div>

      {/* Full log */}
      <motion.div variants={item}>
        <RfidLogTable logs={logs} loading={loading} onDeleteStudent={setTargetStudent} onRefresh={refresh} />
      </motion.div>

      <ConfirmDeleteModal 
        student={targetStudent}
        onConfirm={confirmDelete}
        onCancel={() => setTargetStudent(null)}
        loading={deleting}
      />

    </motion.div>
  );
};

export default AdminDashboard;
