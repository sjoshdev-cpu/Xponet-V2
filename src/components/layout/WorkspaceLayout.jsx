import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceLayout() {
  const { loading, sidebarOpen, setSidebarOpen } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setSidebarOpen]);

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

      {/* Sidebar */}
      {sidebarOpen && (
        <div className={isMobile ? 'fixed inset-y-0 left-0 z-30' : ''}>
          <Sidebar onOpenSearch={() => setSearchOpen(true)} />
        </div>
      )}

      {/* Mobile hamburger */}
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

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}