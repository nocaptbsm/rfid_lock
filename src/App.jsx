import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RfidProvider } from './context/RfidContext';
import { GroupProvider } from './context/GroupContext';
import TopBar from './components/layout/TopBar';

// Lazy load pages for performance
const StudentLogin = React.lazy(() => import('./pages/StudentLogin'));
const AdminLogin   = React.lazy(() => import('./pages/AdminLogin'));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const StudentHistory = React.lazy(() => import('./pages/StudentHistory'));
const AdminDashboard   = React.lazy(() => import('./pages/AdminDashboard'));
const AdminReports = React.lazy(() => import('./pages/AdminReports'));
const StudentGroupDashboard = React.lazy(() => import('./pages/StudentGroupDashboard'));

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin) return <Navigate to={`/student/${user.roll}`} replace />;

  return children;
};

// CRITICAL-5: Only mount GroupProvider for student sessions
// Prevents 401 API noise on every admin login.
const StudentGroupWrapper = ({ children }) => {
  const { isAdmin } = useAuth();
  if (isAdmin) return children;
  return <GroupProvider>{children}</GroupProvider>;
};

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-root dark text-foreground transition-colors duration-300">
      <div className="dashboard-bg" />
      <div className="dashboard-overlay" />
      <div className="dashboard-content flex flex-col">
        <TopBar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RfidProvider>
          <Router>
            <StudentGroupWrapper>
              <React.Suspense fallback={
                <div className="h-screen flex items-center justify-center bg-background">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              }>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/"           element={<StudentLogin />} />
                  <Route path="/admin-login" element={<AdminLogin />} />

                  {/* Student Routes */}
                  <Route
                    path="/student/:roll"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout><StudentDashboard /></DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/student/:roll/history"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout><StudentHistory /></DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/student/:roll/group"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout><StudentGroupDashboard /></DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin Routes */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute adminOnly>
                        <DashboardLayout><AdminDashboard /></DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin/reports"
                    element={
                      <ProtectedRoute adminOnly>
                        <DashboardLayout><AdminReports /></DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
            </StudentGroupWrapper>
          </Router>
        </RfidProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

