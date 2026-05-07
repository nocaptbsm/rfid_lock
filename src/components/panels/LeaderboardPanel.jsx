import React, { useState, useMemo } from 'react';
import { Award, Trophy, Medal, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

const LeaderboardPanel = ({ leaderboard, loading, currentRoll, fullPage = false }) => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLeaderboard = useMemo(() => {
    if (!leaderboard) return [];
    if (!fullPage || !searchQuery) return leaderboard;
    const q = searchQuery.toLowerCase();
    return leaderboard.filter(student => 
      student.name.toLowerCase().includes(q) || 
      (student.roll && student.roll.toLowerCase().includes(q))
    );
  }, [leaderboard, searchQuery, fullPage]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground mt-4">Loading leaderboard...</p>
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
        <Trophy size={48} className="text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground text-center">No leaderboard data this month.</p>
      </div>
    );
  }

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1: return <Trophy size={18} className="text-amber-500" />;
      case 2: return <Medal size={18} className="text-slate-400" />;
      case 3: return <Medal size={18} className="text-amber-700" />;
      default: return <span className="text-sm font-semibold text-muted-foreground w-[18px] text-center">{rank}</span>;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award size={20} className="text-primary" />
            Monthly Leaderboard
          </h3>
          <p className="text-sm text-muted-foreground">Top students by total hours this month</p>
        </div>
        
        {fullPage && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll no..."
              className="pl-8 pr-3 py-2 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-64"
            />
          </div>
        )}
      </div>

      <div className={cn("flex-1 overflow-y-auto pr-2 space-y-3", !fullPage && "max-h-[640px]")}>
        {(fullPage ? filteredLeaderboard : filteredLeaderboard.slice(0, 10)).map((student) => {
          const isCurrentUser = currentRoll && student.roll === currentRoll;
          const InnerContent = (
            <div 
              className={cn(
                "flex items-center justify-between p-3 rounded-xl transition-colors border w-full",
                isCurrentUser 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-secondary/30 border-transparent hover:bg-secondary/60"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(student.rank)}
                </div>
                <div className="text-left">
                  <p className={cn("text-sm font-medium", isCurrentUser && "text-primary")}>
                    {student.name} {isCurrentUser && "(You)"}
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{student.roll}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{student.totalHours}h</p>
              </div>
            </div>
          );

          return isAdmin ? (
            <Link key={student.roll} to={`/student/${student.roll}`} className="block w-full">
              {InnerContent}
            </Link>
          ) : (
            <div key={student.roll} className="w-full">
              {InnerContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPanel;
