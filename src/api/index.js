import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
});

// Request interceptor for Auth
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('user');
  if (user) {
    const parsed = JSON.parse(user);
    if (parsed.token) {
      config.headers.Authorization = `Bearer ${parsed.token}`;
    }
    // Send student UID for feedback identification
    if (parsed.uid) {
      config.headers['X-Student-UID'] = parsed.uid;
    }
  }
  return config;
});

// Response interceptor for Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only force-redirect on 401 if the user is not logged in at all.
    // This prevents kicking an already-authenticated admin to the landing page
    // when an individual API call fails auth (e.g. token not yet propagated).
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('user');
      if (!stored) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Student Endpoints ───────────────────────────────────────────────
export const fetchStudentStats = (roll) => 
  api.get(`/student/${encodeURIComponent(roll)}`).then(res => res.data);

export const studentLogin = (uid, password) =>
  api.post('/student/login', { uid, password }).then(res => res.data);

export const fetchStudentHistory = (roll, from, to) =>
  api.get(`/student/${encodeURIComponent(roll)}/history`, { params: { from, to } }).then(res => res.data);

export const deleteStudentLogs = (uid, roll) =>
  api.delete(`/admin/student/${encodeURIComponent(uid)}/logs`, { params: { roll } }).then(res => res.data);

export const deleteLogsByDateRange = (from, to) =>
  api.delete('/admin/logs', { params: { from, to } }).then(res => res.data);

export const updateStudentName = (uid, name) =>
  api.put(`/admin/student/${encodeURIComponent(uid)}`, { name }).then(res => res.data);

export const fetchLeaderboard = () =>
  api.get('/leaderboard').then(res => res.data);

// ─── Admin Auth ──────────────────────────────────────────────────────
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password }).then(res => res.data);

// ─── Card Management ────────────────────────────────────────────────
export const fetchCards = () =>
  api.get('/admin/cards').then(res => res.data);

export const registerCard = (uid, name, roll_no, role = 'STUDENT') =>
  api.post('/admin/cards', { uid, name, roll_no, role }).then(res => res.data);

export const updateCardDetails = (uid, data) =>
  api.put(`/admin/student/${encodeURIComponent(uid)}`, data).then(res => res.data);

export const suspendCard = (uid) =>
  api.post(`/admin/cards/${encodeURIComponent(uid)}/suspend`).then(res => res.data);

export const activateCard = (uid) =>
  api.post(`/admin/cards/${encodeURIComponent(uid)}/activate`).then(res => res.data);

export const deleteCard = (uid) =>
  api.delete(`/admin/cards/${encodeURIComponent(uid)}`).then(res => res.data);

// ─── Security Log ───────────────────────────────────────────────────
export const fetchSecurityLog = () =>
  api.get('/admin/security-log').then(res => res.data);

// ─── Feedback ───────────────────────────────────────────────────
export const submitFeedback = (message, role = 'student') =>
  api.post('/feedback', { message, role }).then(res => res.data);

export const fetchMyFeedbacks = () =>
  api.get('/feedback/mine').then(res => res.data);

export const fetchAllFeedbacks = () =>
  api.get('/admin/feedbacks').then(res => res.data);

// ─── Group System ─────────────────────────────────────────────────────
// GET /groups/me — returns { ...group, members, myRole } or null
export const fetchMyGroup = () =>
  api.get('/groups/me').then(res => res.data);

// POST /groups — { name, target_hours, penalty_points }
export const createGroup = (name, target_hours, penalty_points) =>
  api.post('/groups', { name, target_hours, penalty_points }).then(res => res.data);

// GET /groups/invites — pending invites for the logged-in student
export const fetchMyGroupInvites = () =>
  api.get('/groups/invites').then(res => res.data);

// POST /groups/invites — invite by roll number
export const sendGroupInvite = (receiver_roll) =>
  api.post('/groups/invites', { receiver_roll }).then(res => res.data);

// POST /groups/invites/:id/respond — action: 'ACCEPT' | 'REJECT'
export const respondToGroupInvite = (inviteId, action) =>
  api.post(`/groups/invites/${inviteId}/respond`, { action }).then(res => res.data);

// DELETE /groups/me/leave
export const leaveGroup = () =>
  api.delete('/groups/me/leave').then(res => res.data);

// PUT /groups/me/admin — transfer admin to another member
export const transferGroupAdmin = (new_admin_uid) =>
  api.put('/groups/me/admin', { new_admin_uid }).then(res => res.data);

// GET /groups/leaderboard — all groups ranked by cumulative points
export const fetchGroupLeaderboard = () =>
  api.get('/groups/leaderboard').then(res => res.data);

export default api;
