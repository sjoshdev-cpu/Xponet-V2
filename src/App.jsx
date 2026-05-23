import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import Home from '@/pages/Home';
import PageEditor from '@/pages/PageEditor';
import Inbox from '@/pages/Inbox';
import Trash from '@/pages/Trash';
import Settings from '@/pages/Settings';
import Templates from '@/pages/Templates';
import SharedPage from '@/pages/SharedPage';
import Tasks from '@/pages/Tasks';

const WorkspaceWrapper = () => {
  return (
    <WorkspaceProvider>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-medium">Xponet</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/shared/:token" element={<SharedPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<WorkspaceWrapper />}>
          <Route path="/" element={<Home />} />
          <Route path="/page/:pageId" element={<PageEditor />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/tasks" element={<Tasks />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <SonnerToaster position="bottom-right" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App