import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * OfflineBanner — slim amber banner shown when the browser is offline.
 * Auto-dismisses when connectivity is restored.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [visible, setVisible] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setVisible(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Keep the banner visible briefly to confirm reconnection, then slide away
      setTimeout(() => setVisible(false), 1500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-1.5 px-4 text-sm font-medium transition-all duration-500',
        isOffline
          ? 'bg-amber-400/95 text-amber-950'
          : 'bg-emerald-500/95 text-white',
      )}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      {isOffline
        ? "You're offline — changes will sync when you reconnect"
        : 'Back online'}
    </div>
  );
}
