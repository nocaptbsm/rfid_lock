import { useState, useEffect, useCallback } from 'react';
import { fetchLeaderboard } from '@/api';

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshLeaderboard = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await fetchLeaderboard();
      // Guard: don't update state if the effect was cleaned up
      if (signal?.aborted) return;
      setLeaderboard(data);
      setError('');
    } catch (err) {
      if (signal?.aborted) return; // Ignore abort errors
      console.error('Failed to fetch leaderboard:', err);
      setError('Could not load leaderboard data.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshLeaderboard(controller.signal);
    return () => controller.abort();
  }, [refreshLeaderboard]);

  return { leaderboard, loading, error, refreshLeaderboard };
};
