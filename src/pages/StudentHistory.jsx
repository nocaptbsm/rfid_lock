import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Calendar, Clock, ArrowLeft } from 'lucide-react';
import { fetchStudentHistory } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/cards/StatusBadge';

const fmtDate = (iso) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDuration = (mins) => {
  if (mins == null) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StudentHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.roll) {
      const fetchHistory = async () => {
        try {
          const res = await fetchStudentHistory(user.roll);
          // Backend might return an array or an object { sessions: [...] }
          setHistory(Array.isArray(res) ? res : (res.sessions || []));
        } catch (error) {
          console.error('Failed to fetch history:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/student/${user?.roll}`} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/70 hover:text-white">
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
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Session Records</h2>
          <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-medium text-white/70">
            Total Records: {history.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-8 text-center text-white/50">Loading records...</div>
          ) : history.length === 0 ? (
             <div className="p-8 text-center text-white/50">No records found.</div>
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
                {history.map((session, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/80">
                        <Calendar size={14} className="text-white/40" />
                        {fmtDate(session.entry_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {fmtTime(session.entry_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {session.exit_time ? (
                        <div className="flex items-center gap-2 text-white/70">
                          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                          {fmtTime(session.exit_time)}
                        </div>
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
                      ) : (
                        <span className="text-amber-400 text-xs font-semibold px-2 py-1 bg-amber-400/10 rounded-md">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <StatusBadge active={!session.exit_time} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default StudentHistory;
