import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Page } from '@/api/firestoreClient';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import QuickAddTask from '@/components/tasks/QuickAddTask';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function WorkspaceLayout() {
  const { loading, sidebarOpen, setSidebarOpen, currentOrg, user } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Ref tracks the current mobile state synchronously so effects and callbacks always see the latest value
  const isMobileRef = useRef(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const handleNewPage = async () => {
    if (!currentOrg?.id) return;
    const page = await Page.create({
      org_id: currentOrg.id,
      title: '',
      icon: '📄',
      content: JSON.stringify([{ id: Math.random().toString(36).slice(2, 9), type: 'paragraph', content: '' }]),
      is_deleted: false,
      created_by_email: user?.email || '',
      created_by_name: user?.full_name || user?.email || '',
      category: null,
      reviewers: [],
    });
    navigate(`/page/${page.id}`);
  };

  // Global shortcut: Cmd/Ctrl+Shift+T → quick add task
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
        e.preventDefault();
        setQuickTaskOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Track mobile breakpoint; auto-open sidebar when viewport widens to desktop
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      const wasMobile = isMobileRef.current;
      isMobileRef.current = mobile;
      setIsMobile(mobile);
      if (!mobile) {
        // Entering or staying on desktop — sidebar always open
        setSidebarOpen(true);
      } else if (!wasMobile && mobile) {
        // Just crossed into mobile — close sidebar
        setSidebarOpen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setSidebarOpen]);

  // On every route change: reopen sidebar on desktop, close it on mobile
  useEffect(() => {
    if (isMobileRef.current) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [location.pathname, setSidebarOpen]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar: always mounted so local state (expanded pages, scroll) survives mobile open/close.
           Hidden via CSS on mobile when closed rather than unmounted. */}
      <div className={cn(
        isMobile ? 'fixed inset-y-0 left-0 z-30' : 'shrink-0',
        isMobile && !sidebarOpen && 'hidden'
      )}>
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      </div>

      {/* Mobile hamburger — shown when sidebar is CSS-hidden */}
      {isMobile && !sidebarOpen && (
        <div className="fixed top-3 left-3 z-20">
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur border shadow-sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onNewTask={() => setQuickTaskOpen(true)} onNewPage={handleNewPage} />
      <QuickAddTask open={quickTaskOpen} onClose={() => setQuickTaskOpen(false)} />
    </div>
  );
}