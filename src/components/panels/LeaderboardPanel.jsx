import React from 'react';
import { Award, Trophy, Medal } from 'lucide-react';
import { cn } from '@/utils/cn';

const LeaderboardPanel = ({ leaderboard, loading, currentRoll }) => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award size={20} className="text-primary" />
            Monthly Leaderboard
          </h3>
          <p className="text-sm text-muted-foreground">Top students by total hours this month</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {leaderboard.map((student) => {
          const isCurrentUser = currentRoll && student.roll === currentRoll;
          return (
            <div 
              key={student.roll}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl transition-colors border",
                isCurrentUser 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-secondary/30 border-transparent hover:bg-secondary/60"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(student.rank)}
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isCurrentUser && "text-primary")}>
                    {student.name} {isCurrentUser && "(You)"}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{student.roll}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{student.totalHours}h</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPanel;
