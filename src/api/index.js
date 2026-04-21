import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
});

// Request interceptor for Auth
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('user');
  if (user) {
    const { token } = JSON.parse(user);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Student Endpoints
export const fetchStudentStats = (roll) => 
  api.get(`/student/${encodeURIComponent(roll)}`).then(res => res.data);

export const fetchStudentHistory = (roll, from, to) =>
  api.get(`/student/${encodeURIComponent(roll)}/history`, { params: { from, to } }).then(res => res.data);

export const deleteStudentLogs = (uid, roll) =>
  api.delete(`/admin/student/${encodeURIComponent(uid)}/logs`, { params: { roll } }).then(res => res.data);

export const updateStudentName = (uid, name) =>
  api.put(`/admin/student/${encodeURIComponent(uid)}`, { name }).then(res => res.data);

export const fetchLeaderboard = () =>
  api.get('/leaderboard').then(res => res.data);

export default api;
