import React from 'react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import LeaderboardPanel from '@/components/panels/LeaderboardPanel';
import { motion } from 'framer-motion';

const AdminReports = () => {
  const { leaderboard, loading } = useLeaderboard();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Reports & Leaderboard</h1>
        <p className="text-white/60 mt-1">Full overview of student engagement and ranking.</p>
      </div>
      
      <div className="h-[75vh]">
        <LeaderboardPanel 
          leaderboard={leaderboard} 
          loading={loading} 
          currentRoll={null} 
          fullPage={true} 
        />
      </div>
    </motion.div>
  );
};

export default AdminReports;
