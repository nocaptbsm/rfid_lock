import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, Clock, Activity, Search, Tag, Pencil,
  Check, X, LogIn, LogOut, ChevronDown, ChevronUp,
  Download, RefreshCw, Loader2, AlertCircle, Wifi,
  Trash2, Shield, ShieldAlert, ShieldCheck, ShieldX,
  CreditCard, Plus, Ban, CheckCircle2, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { useRfid } from '@/context/RfidContext';
import api, { deleteStudentLogs, updateStudentName, fetchCards, suspendCard, activateCard, registerCard, fetchSecurityLog, deleteCard, updateCardDetails, deleteLogsByDateRange } from '@/api';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import LeaderboardPanel from '@/components/panels/LeaderboardPanel';
import { getCutoffTime } from '@/utils/sessionUtils';

/* ─── helpers ───────────────────────────────────────────────── */
const cn = (...c) => c.filter(Boolean).join(' ');

const badge = (type) => {
  if (type === 'ENTRY') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
  if (type === 'DENIED') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
  return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
};

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
        api.get('/admin/logs'),
        api.get('/admin/live'),
      ]);

      setLogs(logsRes.data);
      setLive(liveRes.data);
      setError('');
      setLastSync(new Date());
    } catch (err) {
      setError(err.response?.data?.error || err.message);
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

/**
 * Check if a live session is truly active (before 9 PM cutoff).
 * Live sessions from the admin endpoint have entry_time but no exit_time.
 */
const isLiveSessionActive = (session) => {
  if (!session || !session.entry_time) return false;
  const cutoff = getCutoffTime(new Date(session.entry_time));
  return new Date() < cutoff;
};

/* ─── Stat card ─────────────────────────────────────────────── */
const StatCard = ({ title, value, icon, color = 'primary', loading }) => {
  const IconComponent = icon;
  return (
    <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
        color === 'primary' && 'bg-primary/10 text-primary',
        color === 'emerald' && 'bg-emerald-500/10 text-emerald-500',
        color === 'amber'   && 'bg-amber-500/10 text-amber-500',
      )}>
        <IconComponent size={22} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        {loading
          ? <div className="h-7 w-16 bg-secondary/60 rounded-lg animate-pulse mt-1" />
          : <p className="text-2xl font-bold mt-0.5">{value}</p>}
      </div>
    </div>
  );
};

/* ─── Inline rename cell ────────────────────────────────────── */
const RenameCell = ({ rfid, fallback, onSave }) => {
  const { aliases, setAlias } = useRfid();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft,   setDraft]   = useState('');
  const current = aliases[rfid?.toUpperCase()];
  const isRegisteredName = fallback && fallback !== rfid && fallback !== 'UNKNOWN_CARD' && fallback !== 'CARD_SUSPENDED';
  const display = isRegisteredName ? fallback : (current || fallback || rfid);

  const startEdit = () => { setDraft(current || fallback || ''); setEditing(true); };
  const save = async () => {
    if (!draft.trim()) return cancel();
    setLoading(true);
    try {
      const res = await updateStudentName(rfid, draft.trim());
      setAlias(rfid, draft.trim());
      if (onSave) onSave();
      setEditing(false);
      if (res?.generatedPassword) {
        window.alert(`Name updated. New password for ${draft.trim()}: ${res.generatedPassword}`);
      }
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
const LiveSessionsPanel = ({ live, loading, onDeleteStudent, onRefresh }) => {
  const activeSessions = live.filter(s => isLiveSessionActive(s));
  const autoClosedSessions = live.filter(s => !isLiveSessionActive(s));

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="text-base font-semibold">Live Sessions</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {activeSessions.length} active
          {autoClosedSessions.length > 0 && ` • ${autoClosedSessions.length} auto-closed at 9 PM`}
        </span>
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
            const active = isLiveSessionActive(s);
            return (
              <div key={s.id} className={cn(
                "flex items-center gap-4 px-6 py-3 hover:bg-secondary/20 transition-colors group",
                !active && "opacity-60"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  active ? "bg-emerald-500/10" : "bg-amber-500/10"
                )}>
                  <Users size={14} className={active ? "text-emerald-500" : "text-amber-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <RenameCell rfid={uid} fallback={name} onSave={onRefresh} />
                  <p className="text-xs text-muted-foreground">
                    {roll} • entered {fmtTime(s.entry_time)}
                    {!active && <span className="text-amber-500 ml-1">• auto-closed 9 PM</span>}
                  </p>
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
};

/* ─── Full RFID log table ───────────────────────────────────── */
const RfidLogTable = ({ logs, loading, onDeleteStudent, onRefresh }) => {
  const { resolveName } = useRfid();
  const [search,     setSearch]  = useState('');
  const [typeFilter, setType]    = useState('ALL');
  const [sortDir,    setSortDir] = useState('desc');
  const [page,       setPage]    = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const pageSize = 10;

  // Reset page to 1 when search or filters change (derived, avoids setState in effect)

  const filtered = useMemo(() => {
    let rows = [...logs];
    if (selectedDate) {
      rows = rows.filter(r => {
        const rDate = new Date(r.timestamp);
        // Adjust for local timezone of the selected date
        const localDateStr = new Date(rDate.getTime() - rDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        return localDateStr === selectedDate;
      });
    }
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
  }, [logs, search, typeFilter, sortDir, selectedDate, resolveName]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  // Clamp page so it resets automatically when filters reduce totalPages
  const effectivePage = Math.min(page, totalPages);
  const paginated = filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

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
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                {paginated.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No records found</td></tr>
                )}
                {paginated.map((row, idx) => {
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
                      <td className="px-6 py-3.5 text-muted-foreground text-xs tabular-nums">
                        {new Date(row.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {filtered.length > pageSize && (
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/20">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{((effectivePage - 1) * pageSize) + 1}</span> to{' '}
            <span className="font-medium text-foreground">{Math.min(effectivePage * pageSize, filtered.length)}</span> of{' '}
            <span className="font-medium text-foreground">{filtered.length}</span> records
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={effectivePage === 1}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-medium px-2">Page {effectivePage} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={effectivePage === totalPages}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Card Management Panel ─────────────────────────────────── */
const CardManagementPanel = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [newCard, setNewCard] = useState({ uid: '', name: '', role: 'STUDENT' });
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const [editingCard, setEditingCard] = useState(null);
  const [editForm, setEditForm] = useState({ uid: '', name: '' });

  const handleUpdateCard = async (oldUid) => {
    if (!editForm.uid || (!editForm.name && cards.find(c => c.uid === oldUid)?.role === 'STUDENT')) return;
    setActionLoading(`edit-${oldUid}`);
    try {
      const res = await updateCardDetails(oldUid, editForm);
      setEditingCard(null);
      await loadCards();
      if (res?.generatedPassword) {
        window.alert(`Card updated. New password for ${editForm.name || res.name}: ${res.generatedPassword}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const loadCards = useCallback(async () => {
    try {
      const data = await fetchCards();
      setCards(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleToggleStatus = async (uid, currentStatus) => {
    setActionLoading(uid);
    try {
      if (currentStatus === 'AUTHORIZED') {
        await suspendCard(uid);
      } else {
        await activateCard(uid);
      }
      await loadCards();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCard = async (uid) => {
    if (!window.confirm(`Are you sure you want to permanently delete card ${uid}? This will also delete all of the student's access records.`)) return;
    setActionLoading(`delete-${uid}`);
    try {
      await deleteCard(uid);
      await loadCards();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newCard.uid) return;
    if (newCard.role === 'STUDENT' && !newCard.name) return;
    setActionLoading('register');
    try {
      const res = await registerCard(newCard.uid.toUpperCase(), newCard.name, '', newCard.role);
      setNewCard({ uid: '', name: '', role: 'STUDENT' });
      setShowRegister(false);
      await loadCards();
      if (res.generatedPassword) {
        window.alert(`Successfully registered ${newCard.name}. Generated Password for student login: ${res.generatedPassword}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = cards.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.uid.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.roll_no || '').toLowerCase().includes(q);
  });

  const CARDS_PER_PAGE = 8;
  const [cardPage, setCardPage] = useState(1);

  // Reset page on search change
  useEffect(() => { setCardPage(1); }, [search]);

  const totalCardPages = Math.ceil(filtered.length / CARDS_PER_PAGE) || 1;
  const paginatedCards = filtered.slice((cardPage - 1) * CARDS_PER_PAGE, cardPage * CARDS_PER_PAGE);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-primary" />
          <h2 className="text-base font-semibold">RFID Card Management</h2>
          <span className="text-xs text-muted-foreground ml-1">{cards.length} cards</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="pl-8 pr-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 w-44"
            />
          </div>
          <button onClick={() => setShowRegister(!showRegister)}
            className={cn('px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all',
              showRegister ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary')}>
            <Plus size={14} /> Register Card
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-2">
          <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 p-2 rounded-lg">
            <AlertCircle size={13} /> {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showRegister && (
          <motion.form onSubmit={handleRegister}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border">
            <div className="px-6 py-4 bg-secondary/10 space-y-4">
              <div className="flex items-center gap-4 border-b border-border/50 pb-3">
                <label className="text-sm font-medium">Card Role:</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewCard(p => ({...p, role: 'STUDENT'}))}
                    className={cn('px-3 py-1 text-xs font-semibold rounded-full transition-colors', 
                      newCard.role === 'STUDENT' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                    Student
                  </button>
                  <button type="button" onClick={() => setNewCard(p => ({...p, role: 'MASTER'}))}
                    className={cn('px-3 py-1 text-xs font-semibold rounded-full transition-colors', 
                      newCard.role === 'MASTER' ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground')}>
                    Master Key
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Card UID</label>
                  <input value={newCard.uid} onChange={(e) => setNewCard(p => ({...p, uid: e.target.value}))}
                    placeholder="e.g. A3B2C1D4" className="px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg w-32 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                {newCard.role === 'STUDENT' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Student Name</label>
                    <input value={newCard.name} onChange={(e) => setNewCard(p => ({...p, name: e.target.value}))}
                      placeholder="Full name" className="px-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg w-40 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                )}
                <button type="submit" disabled={actionLoading === 'register'}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                  {actionLoading === 'register' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Register
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-secondary/40 rounded-lg animate-pulse" />)}</div>
      ) : (
        <>
          <div className="divide-y divide-border/50">
            {paginatedCards.length === 0 && <p className="text-center py-10 text-sm text-muted-foreground">No cards found</p>}
            {paginatedCards.map((card) => {
              const isEditing = editingCard === card.uid;
              
              return (
              <div key={card.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-secondary/20 transition-colors group border-b border-border/50 last:border-0">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    card.status === 'AUTHORIZED' ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
                    {card.status === 'AUTHORIZED' ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldX size={14} className="text-rose-500" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          value={editForm.name} 
                          onChange={(e) => setEditForm(p => ({...p, name: e.target.value}))} 
                          placeholder="Name"
                          className="px-2 py-1.5 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/50 w-full sm:w-32"
                        />
                        <input 
                          value={editForm.uid} 
                          onChange={(e) => setEditForm(p => ({...p, uid: e.target.value}))} 
                          placeholder="UID"
                          className="px-2 py-1.5 text-sm font-mono bg-secondary/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/50 w-full sm:w-32 uppercase"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{card.name}</p>
                          {card.role === 'MASTER' && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">Master</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{card.roll_no} • <code className="font-mono">{card.uid}</code></p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-1 sm:mt-0">
                  <span className={cn('text-xs font-semibold px-2 py-1 rounded-full shrink-0',
                    card.status === 'AUTHORIZED' 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
                    {card.status}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleUpdateCard(card.uid)} disabled={actionLoading === `edit-${card.uid}`}
                          className="p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                          {actionLoading === `edit-${card.uid}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={() => setEditingCard(null)} disabled={actionLoading === `edit-${card.uid}`}
                          className="p-1.5 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingCard(card.uid); setEditForm({ uid: card.uid, name: card.name }); }} disabled={actionLoading}
                          className="p-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors" title="Edit Card">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleToggleStatus(card.uid, card.status)} disabled={actionLoading === card.uid || actionLoading === `delete-${card.uid}`}
                          className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5',
                            card.status === 'AUTHORIZED' 
                              ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20')}>
                          {actionLoading === card.uid ? <Loader2 size={12} className="animate-spin" /> 
                            : card.status === 'AUTHORIZED' ? <><Ban size={12} /> Suspend</> : <><CheckCircle2 size={12} /> Activate</>}
                        </button>
                        <button onClick={() => handleDeleteCard(card.uid)} disabled={actionLoading === card.uid || actionLoading === `delete-${card.uid}`}
                          className="p-1.5 rounded-lg transition-all flex items-center gap-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" title="Delete Card">
                          {actionLoading === `delete-${card.uid}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Pagination */}
          {filtered.length > CARDS_PER_PAGE && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/20">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{((cardPage - 1) * CARDS_PER_PAGE) + 1}</span> to{' '}
                <span className="font-medium text-foreground">{Math.min(cardPage * CARDS_PER_PAGE, filtered.length)}</span> of{' '}
                <span className="font-medium text-foreground">{filtered.length}</span> cards
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCardPage(p => Math.max(1, p - 1))}
                  disabled={cardPage === 1}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs font-medium px-2">Page {cardPage} of {totalCardPages}</span>
                <button
                  onClick={() => setCardPage(p => Math.min(totalCardPages, p + 1))}
                  disabled={cardPage === totalCardPages}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ─── Security Alert Panel ──────────────────────────────────── */
const SecurityAlertPanel = ({ logs = [] }) => {
  const [secAlerts, setSecAlerts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchSecurityLog()
      .then(data => { setSecAlerts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(err => {
        setFetchError(err?.response?.data?.error || 'Failed to load security log');
        setLoading(false);
      });
  }, []);

  // Merge: deduplicate by id — security log alerts + DENIED scans from main logs
  const deniedFromLogs = logs
    .filter(l => l.type === 'DENIED')
    .map(l => ({
      id: `denied-${l.id}`,
      student_uid: l.students?.uid || l.uid || '—',
      students: l.students,
      device_id: l.device_id || null,
      timestamp: l.timestamp,
      _source: 'log',
    }));

  const secAlertIds = new Set(secAlerts.map(a => a.id));
  const combined = [
    ...secAlerts,
    ...deniedFromLogs.filter(d => !secAlertIds.has(d.id)),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <ShieldAlert size={18} className="text-amber-500" />
        <h2 className="text-base font-semibold">Unauthorized Scan Alerts</h2>
        <span className="ml-auto text-xs text-muted-foreground">{combined.length} events</span>
      </div>

      {fetchError && (
        <div className="px-6 py-2">
          <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-500/10 p-2 rounded-lg">
            <AlertCircle size={13} /> Security log: {fetchError} — showing DENIED scans from main log instead.
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-secondary/40 rounded-lg animate-pulse" />)}</div>
      ) : combined.length === 0 ? (
        <div className="text-center py-10">
          <ShieldCheck size={32} className="mx-auto mb-2 text-emerald-500/50" />
          <p className="text-sm text-muted-foreground">No unauthorized scan attempts</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
          {combined.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-6 py-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <ShieldX size={14} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {a.students?.name || 'Unknown Card'}
                  {a.students?.status === 'SUSPENDED' && <span className="text-xs text-rose-500 ml-2">(Suspended)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  UID: <code className="font-mono">{a.student_uid}</code>
                  {a.device_id && <> • Device: {a.device_id}</>}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtTime(a.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Admin Dashboard ───────────────────────────────────────── */
const AdminDashboard = () => {
  const { logs, live, loading, error, lastSync, refresh } = useLiveData();
  const { leaderboard, loading: leaderLoading } = useLeaderboard();
  const [targetStudent, setTargetStudent] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  // ─── Delete Records by Date Range ──────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRange, setDeleteRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [deletingRange, setDeletingRange] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  const handleDeleteByRange = async () => {
    if (!deleteRange.from || !deleteRange.to) return;
    if (new Date(deleteRange.from) > new Date(deleteRange.to)) {
      setDeleteError('Start date must be before or equal to end date.');
      return;
    }
    setDeletingRange(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      const result = await deleteLogsByDateRange(deleteRange.from, deleteRange.to);
      const msg = result?.message || `Records from ${deleteRange.from} to ${deleteRange.to} deleted.`;
      setDeleteSuccess(msg);
      refresh();
      // Auto-close after 2 seconds
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Failed to delete logs:', err);
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete records.');
    } finally {
      setDeletingRange(false);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

  // Derived stats
  const isToday = (ts) => {
    if (!ts) return false;
    const d = new Date(ts);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const todayLogs = logs.filter(l => isToday(l.timestamp));
  const uniqueEntriesToday = new Set(todayLogs.filter(l => l.type === 'ENTRY').map(l => l.students?.uid || l.uid)).size;

  // Calculate daily average unique entries
  const entriesByDate = {};
  logs.filter(l => l.type === 'ENTRY').forEach(l => {
    if (!l.timestamp) return;
    const d = new Date(l.timestamp).toLocaleDateString(); // just get date string
    const uid = l.students?.uid || l.uid;
    if (!entriesByDate[d]) entriesByDate[d] = new Set();
    entriesByDate[d].add(uid);
  });
  
  const totalDaysWithEntries = Object.keys(entriesByDate).length;
  let sumOfUniqueDailyEntries = 0;
  Object.values(entriesByDate).forEach(set => {
    sumOfUniqueDailyEntries += set.size;
  });
  const dailyAvg = totalDaysWithEntries > 0 ? Math.round(sumOfUniqueDailyEntries / totalDaysWithEntries) : 0;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'security',  label: 'Security',  icon: Shield },
  ];

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
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle size={13} /> {error}
            </span>
          )}
          
          <button onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Trash2 size={14} /> Delete Records
          </button>
          
          <button onClick={refresh}
            className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-secondary/80 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item} className="flex items-center gap-1 bg-secondary/30 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50')}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </motion.div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats */}
          <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard title="Currently Inside"  value={live.filter(s => isLiveSessionActive(s)).length}   icon={Users}    color="primary" loading={loading} />
            <StatCard title="Total Entries Today" value={uniqueEntriesToday} icon={LogIn}    color="emerald" loading={loading} />
            <StatCard title="Daily Avg Entries"   value={dailyAvg}   icon={Activity} color="amber"   loading={loading} />
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
        </>
      )}

      {activeTab === 'security' && (
        <div className="space-y-8">
          <motion.div variants={item}>
            <CardManagementPanel />
          </motion.div>
          <motion.div variants={item}>
            <SecurityAlertPanel logs={logs} />
          </motion.div>
        </div>
      )}

      <ConfirmDeleteModal 
        student={targetStudent}
        onConfirm={confirmDelete}
        onCancel={() => setTargetStudent(null)}
        loading={deleting}
      />

      {/* Delete Records by Date Range Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => { setShowDeleteModal(false); setDeleteError(''); setDeleteSuccess(''); }}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                      <Trash2 size={20} className="text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Delete Records</h3>
                      <p className="text-xs text-muted-foreground">Select a date range to delete RFID logs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteError(''); setDeleteSuccess(''); }}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Date inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar size={12} /> From
                    </label>
                    <input
                      type="date"
                      value={deleteRange.from}
                      onChange={e => setDeleteRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar size={12} /> To
                    </label>
                    <input
                      type="date"
                      value={deleteRange.to}
                      onChange={e => setDeleteRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Today', fn: () => { const d = new Date().toISOString().split('T')[0]; setDeleteRange({ from: d, to: d }); }},
                    { label: 'Last 7 days', fn: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 7); setDeleteRange({ from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }); }},
                    { label: 'Last 30 days', fn: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 30); setDeleteRange({ from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }); }},
                  ].map(preset => (
                    <button key={preset.label} onClick={preset.fn}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>This will permanently delete all RFID entry, exit, and session logs in the selected range. This action cannot be undone.</span>
                </div>

                {/* Error / Success */}
                {deleteError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-500 rounded-xl text-xs">
                    <AlertCircle size={14} /> {deleteError}
                  </div>
                )}
                {deleteSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs">
                    <CheckCircle2 size={14} /> {deleteSuccess}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteError(''); setDeleteSuccess(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteByRange}
                    disabled={deletingRange || !deleteRange.from || !deleteRange.to}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-lg shadow-rose-500/20"
                  >
                    {deletingRange ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete Records
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default AdminDashboard;
