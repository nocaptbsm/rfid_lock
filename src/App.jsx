import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RfidProvider } from './context/RfidContext';
import TopBar from './components/layout/TopBar';

// Lazy load pages for performance
const StudentLogin = React.lazy(() => import('./pages/StudentLogin'));
const AdminLogin   = React.lazy(() => import('./pages/AdminLogin'));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const AdminDashboard   = React.lazy(() => import('./pages/AdminDashboard'));

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin) return <Navigate to={`/student/${user.roll}`} replace />;

  return children;
};

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col">
      <TopBar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RfidProvider>
          <Router>
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
                      <Layout><StudentDashboard /></Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly>
                      <Layout><AdminDashboard /></Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </Router>
        </RfidProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
