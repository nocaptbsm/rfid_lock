import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '@/api';

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Could not load leaderboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLeaderboard();
  }, []);

  return { leaderboard, loading, error, refreshLeaderboard };
};
