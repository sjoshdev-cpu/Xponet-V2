/**
 * PresenceAvatars — stacked circular avatar row for live presence.
 *
 * Props:
 *   viewers  — Array<{ uid, displayName, photoURL, email, status }>
 *   max      — max avatars before overflow "+N" chip (default 3)
 *   className — extra classes on the wrapper
 */
import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Deterministic color palette keyed by uid hash.
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-cyan-500',
];

function colorForUid(uid = '') {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(viewer) {
  const name = viewer.displayName || viewer.email || '?';
  return name
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function SingleAvatar({ viewer }) {
  const color = colorForUid(viewer.uid);
  const label = viewer.displayName || viewer.email || 'Unknown';
  const statusLabel = viewer.status === 'editing' ? 'editing' : 'viewing';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* animate-in zoom-in-75 requires tailwindcss-animate (ships with shadcn) */}
          <div
            className={cn(
              'relative h-7 w-7 rounded-full border-2 border-background flex items-center justify-center overflow-hidden',
              'text-[10px] font-bold text-white select-none cursor-default',
              'animate-in zoom-in-75 duration-200',
              color,
            )}
          >
            {viewer.photoURL ? (
              <img
                src={viewer.photoURL}
                alt={label}
                className="h-full w-full rounded-full object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              initials(viewer)
            )}
            {/* viewing / editing status dot */}
            <span
              className={cn(
                'absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background',
                viewer.status === 'editing' ? 'bg-emerald-400' : 'bg-blue-400',
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs px-2 py-1">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground ml-1">— {statusLabel}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PresenceAvatars({ viewers = [], max = 3, className }) {
  if (viewers.length === 0) return null;

  const visible  = viewers.slice(0, max);
  const overflow = viewers.length - max;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map(v => (
        <SingleAvatar key={v.uid} viewer={v} />
      ))}
      {overflow > 0 && (
        <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground animate-in zoom-in-75 duration-200">
          +{overflow}
        </div>
      )}
    </div>
  );
}
