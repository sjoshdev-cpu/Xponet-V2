import { lazy, Suspense } from 'react';
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';
import { canAccessCommandCenter } from '@/lib/permissions';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { PeekProvider } from '@/contexts/PeekContext';
import PeekPanel from '@/components/page/PeekPanel';

// Auth pages stay eager — they're the first paint for logged-out users.
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import Home from '@/pages/Home';

// Route-level code splitting: each heavy page loads on first visit instead
// of shipping the whole app (editor, three database stacks, recharts) in one
// bundle. Vite emits a chunk per lazy() import.
const PageEditor     = lazy(() => import('@/pages/PageEditor'));
const Inbox          = lazy(() => import('@/pages/Inbox'));
const Trash          = lazy(() => import('@/pages/Trash'));
const Settings       = lazy(() => import('@/pages/Settings'));
const Templates      = lazy(() => import('@/pages/Templates'));
const SharedPage     = lazy(() => import('@/pages/SharedPage'));
const Tasks          = lazy(() => import('@/pages/Tasks'));
const Databases      = lazy(() => import('@/pages/Databases'));
const DatabaseDetail = lazy(() => import('@/pages/DatabaseDetail'));
const DocumentHub    = lazy(() => import('@/pages/DocumentHub'));
const Tickets        = lazy(() => import('@/pages/Tickets'));
const TicketDetail   = lazy(() => import('@/pages/TicketDetail'));
const CommandCenter  = lazy(() => import('@/pages/CommandCenter'));

const RouteFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[40vh]">
    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const WorkspaceWrapper = () => {
  return (
    <WorkspaceProvider>
      <PeekProvider>
        <WorkspaceLayout />
        <PeekPanel />
      </PeekProvider>
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
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:ticketId" element={<TicketDetail />} />
          <Route element={<RoleProtectedRoute check={canAccessCommandCenter} />}>
            <Route path="/command-center" element={<CommandCenter />} />
          </Route>
          <Route path="/databases" element={<Databases />} />
          <Route path="/database/:dbId" element={<DatabaseDetail />} />
          <Route path="/document-hub" element={<DocumentHub />} />
          <Route path="/document-hub/:databaseId" element={<DocumentHub />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
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