import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewsList from './pages/NewsList';
import NewsDetail from './pages/NewsDetail';
import NewsForm from './pages/NewsForm';
import Admin from './pages/Admin';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/news" element={
            <ProtectedRoute>
              <NewsList />
            </ProtectedRoute>
          } />
          
          <Route path="/news/new" element={
            <ProtectedRoute roles={['admin', 'editor']}>
              <NewsForm />
            </ProtectedRoute>
          } />
          
          <Route path="/news/:id" element={
            <ProtectedRoute>
              <NewsDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/news/edit/:id" element={
            <ProtectedRoute roles={['admin', 'editor']}>
              <NewsForm />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/users" element={
            <ProtectedRoute roles={['admin']}>
              <Admin />
            </ProtectedRoute>
          } />
          
          <Route path="/archive" element={
            <ProtectedRoute>
              <NewsList />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <NewsList />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
