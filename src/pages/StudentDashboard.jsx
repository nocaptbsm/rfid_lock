import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  Clock, 
  Calendar, 
  Timer, 
  MapPin,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Award,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '@/components/cards/StatCard';
import StatusBadge from '@/components/cards/StatusBadge';
import ConnectionBadge from '@/components/cards/ConnectionBadge';
import LiveTimer from '@/components/cards/LiveTimer';
import WeeklyBarChart from '@/components/charts/WeeklyBarChart';
import MonthlyLineChart from '@/components/charts/MonthlyLineChart';
import { useStudentLive } from '@/hooks/useStudentLive';
import { isSessionActive } from '@/utils/sessionUtils';
import { useAuth } from '@/context/AuthContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import LeaderboardPanel from '@/components/panels/LeaderboardPanel';
import FeedbackSection from '@/components/panels/FeedbackSection';
import { MOCK_STUDENT_DATA } from '@/utils/mockData';

const fmtDuration = (mins) => {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtTime = (iso) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (iso) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const { roll } = useParams();
  const targetRoll = roll || user?.roll;

  const {
    profile,
    sessions,
    weeklyData,
    monthlyData,
    weeklyAvgHours,
    weeklyTotalMinutes,
    inside,
    loading,
    error,
    wsStatus,
    lastSync,
    refresh,
    todayEntry,
    todayExit,
    totalMinutes,
    lastScanTime
  } = useStudentLive(targetRoll);

  const { leaderboard, loading: leaderLoading } = useLeaderboard();

  // Extract user's rank from leaderboard
  const userRank = leaderboard?.find(li => li.roll === user?.roll)?.rank;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading && !profile) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCw size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Syncing your records...</p>
      </div>
    );
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.name || user?.roll}! Tracking your RFID activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge status={wsStatus} />
          <StatusBadge status={inside ? 'Inside' : 'Outside'} />
          <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full flex items-center gap-1.5">
            <Clock size={12} /> Last scan: {lastScanTime || '--'}
          </div>
          <button 
            onClick={() => refresh(true)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground"
            title="Force refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 text-sm">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={item}>
          <StatCard 
            title="Today's Entry" 
            value={todayEntry} 
            icon={Clock} 
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard 
            title="Total Duration" 
            value={fmtDuration(totalMinutes)} 
            icon={Timer} 
            className={(totalMinutes > 240) ? "border-rose-500/50" : ""}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard 
            title="Weekly Avg" 
            value={weeklyAvgHours !== undefined ? `${weeklyAvgHours} hrs` : '--'} 
            icon={TrendingUp} 
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard 
            title="Monthly Rank" 
            value={userRank ? `#${userRank}` : '--'} 
            icon={Award} 
            subValue={leaderboard?.length ? `out of ${leaderboard.length}` : 'out of --'}
          />
        </motion.div>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold">Weekly Activity</h3>
              <p className="text-sm text-muted-foreground">Hours spent in the library over the last 7 days</p>
            </div>
          </div>
          {weeklyData?.length > 0 ? (
            <WeeklyBarChart data={weeklyData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-xl">
               <p className="text-sm text-muted-foreground italic">No historical data available yet</p>
            </div>
          )}
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold">Monthly Summary</h3>
              <p className="text-sm text-muted-foreground">Engagement trend for {new Date().toLocaleString('default', { month: 'long' })}</p>
            </div>
          </div>
          <div className="flex flex-col gap-6 pt-2">
            {monthlyData?.length > 0 ? (
              <div className="h-[200px] sm:h-[240px] w-full shrink-0 relative">
                <MonthlyLineChart data={monthlyData} />
              </div>
            ) : (
              <div className="h-[200px] sm:h-[240px] w-full shrink-0 flex items-center justify-center border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground italic">No data available yet</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-secondary/80 border border-border flex flex-col justify-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Weekly Total</p>
                <p className="text-2xl font-bold">{weeklyTotalMinutes !== undefined ? `${(weeklyTotalMinutes / 60).toFixed(1)}h` : '--'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/80 border border-border flex flex-col justify-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Consistency</p>
                <p className="text-2xl font-bold">{weeklyData?.filter(d => d.hours > 0).length || 0}/7 days</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 3: Session History & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Recent Sessions</h3>
              <p className="text-sm text-muted-foreground">Your latest library visits</p>
            </div>
            <Link to={`/student/${targetRoll}/history`} className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="pb-4 font-medium">Date</th>
                  <th className="pb-4 font-medium">Entry</th>
                  <th className="pb-4 font-medium">Exit</th>
                  <th className="pb-4 font-medium">Duration</th>
                  <th className="pb-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                      No sessions recorded today yet.
                    </td>
                  </tr>
                ) : (
                  sessions.slice(0, 10).map((session) => (
                    <tr key={session.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-4 font-medium">{fmtDate(session.entry_time)}</td>
                      <td className="py-4">{fmtTime(session.entry_time)}</td>
                      <td className="py-4">{fmtTime(session.exit_time)}</td>
                      <td className="py-4">
                        {session.exit_time ? (
                          fmtDuration(session.duration_minutes)
                        ) : isSessionActive(session) ? (
                          <LiveTimer entryTime={session.entry_time} />
                        ) : (
                          <span className="text-amber-500 text-xs font-medium">
                            {fmtDuration(session.duration_minutes)}
                            {session._durationCapped && <span className="text-rose-500 ml-1 text-xs">(penalty applied)</span>}
                            {session._autoClosed && <span className="text-amber-500 ml-1 text-xs">(auto-closed)</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        {session.exit_time ? (
                          <span className="text-muted-foreground">Completed</span>
                        ) : isSessionActive(session) ? (
                          <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="text-amber-500 text-xs font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Auto-closed 10 PM
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div variants={item} className="h-[400px] lg:h-auto">
          <LeaderboardPanel leaderboard={leaderboard} loading={leaderLoading} currentRoll={user?.roll} />
        </motion.div>
      </div>

      {/* Row 4: Feedback */}
      <motion.div variants={item}>
        <FeedbackSection userRole="student" />
      </motion.div>
    </motion.div>
  );
};

export default StudentDashboard;
