import { useState, useEffect } from 'react';
import { MOCK_GROUP_DATA } from '@/utils/mockData';
import { useAuth } from '@/context/AuthContext';
import { getCutoffTime } from '@/utils/sessionUtils';

export const useGroupData = () => {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState([]);
  
  useEffect(() => {
    // Simulate fetching group data
    const fetchGroup = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (import.meta.env.VITE_USE_MOCK) {
        // If user is Abhishek, he's in the Night Owls group by mock default
        if (user?.roll === '21CS042') {
          const groupData = { ...MOCK_GROUP_DATA };
          
          // Apply dynamic 10 PM penalty logic
          const now = new Date();
          const cutoff = getCutoffTime(now);
          if (now >= cutoff) {
            groupData.members = groupData.members.map(member => {
              if (member.todayHours < groupData.targetHours) {
                return {
                  ...member,
                  points: member.points - groupData.penaltyPoints,
                  status: 'Penalty Applied'
                };
              }
              return member;
            });
          }

          setGroup(groupData);
          setPendingInvites(groupData.pendingInvites);
        } else {
          setGroup(null);
          setPendingInvites([]);
        }
      }
      setLoading(false);
    };
    
    fetchGroup();
  }, [user]);

  const createGroup = async (name, targetHours, penaltyPoints) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newGroup = {
      id: `g-${Date.now()}`,
      name,
      targetHours: parseFloat(targetHours),
      penaltyPoints: parseFloat(penaltyPoints),
      createdBy: user?.roll,
      rank: 1,
      totalPoints: 0,
      streak: 0,
      members: [
        { 
          roll: user?.roll, 
          name: user?.name || 'You', 
          points: 0, 
          todayHours: 0, 
          status: 'In Progress' 
        }
      ],
      leaderboard: [
        { rank: 1, name, points: 0 }
      ],
      pendingInvites: []
    };
    
    setGroup(newGroup);
    setLoading(false);
    return true;
  };

  const inviteMember = async (uid) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  };

  const respondToInvite = async (inviteId, accept) => {
    setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    if (accept) {
      // Simulate joining a new group (mocking it just sets the MOCK_GROUP_DATA for simplicity)
      setGroup(MOCK_GROUP_DATA);
    }
  };

  return {
    group,
    loading,
    pendingInvites,
    createGroup,
    inviteMember,
    respondToInvite
  };
};
