import React, { useState, useEffect, useMemo } from 'react';
import { Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, AtSign, UserPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isAfter, startOfWeek } from 'date-fns';

const safeDate = (val) => {
  if (!val) return new Date(0);
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

const TYPE_ICONS = {
  mention: AtSign,
  comment_reply: MessageSquare,
  task_assigned: UserPlus,
  page_shared: Share2,
  invited: UserPlus,
};

const ACTION_LABELS = {
  mention: 'mentioned you',
  comment_reply: 'replied to a comment',
  task_assigned: 'assigned a task to you',
  page_shared: 'shared a page with you',
  invited: 'invited you',
};

const TEN_MIN_MS = 10 * 60 * 1000;

// Group notifications into bundles: same sender + type + page_id within a 10-min window
function bundleNotifications(notifications) {
  const sorted = [...notifications].sort(
    (a, b) => safeDate(b.created_date) - safeDate(a.created_date)
  );
  const seen = new Set();
  const bundles = [];

  for (const notif of sorted) {
    if (seen.has(notif.id)) continue;

    const t = safeDate(notif.created_date).getTime();
    const siblings = sorted.filter(
      n =>
        !seen.has(n.id) &&
        n.sender_email === notif.sender_email &&
        n.type === notif.type &&
        (n.page_id ?? '') === (notif.page_id ?? '') &&
        Math.abs(safeDate(n.created_date).getTime() - t) <= TEN_MIN_MS
    );

    siblings.forEach(n => seen.add(n.id));

    const count = siblings.length;
    let title = notif.title;
    if (count > 1) {
      const name = notif.sender_name || notif.sender_email || 'Someone';
      const action = ACTION_LABELS[notif.type] || 'sent you a notification';
      title = `${name} ${action} ${count} times`;
    }

    bundles.push({
      ...notif,
      title,
      count,
      is_read: siblings.every(n => n.is_read),
      ids: siblings.map(n => n.id),
    });
  }

  return bundles;
}

// Group bundles into date sections
function groupByDate(bundles) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sections = [
    { label: 'Today',             items: [] },
    { label: 'Yesterday',         items: [] },
    { label: 'Earlier this week', items: [] },
    { label: 'Older',             items: [] },
  ];

  for (const b of bundles) {
    const d = safeDate(b.created_date);
    if (isToday(d))                 sections[0].items.push(b);
    else if (isYesterday(d))        sections[1].items.push(b);
    else if (isAfter(d, weekStart)) sections[2].items.push(b);
    else                            sections[3].items.push(b);
  }

  return sections.filter(s => s.items.length > 0);
}

export default function Inbox() {
  const { user } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-all', user?.email],
    queryFn: () => Notification.filter({ recipient_email: user?.email }),
    enabled: !!user?.email,
  });

  const markRead = useMutation({
    mutationFn: (ids) =>
      Promise.all(ids.map(id => Notification.update(id, { is_read: true }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  // Clear the sidebar unread badge after a brief delay when Inbox is opened
  useEffect(() => {
    if (notifications.length === 0) return;
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    const timer = setTimeout(() => markAllRead.mutate(), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = useMemo(() =>
    notifications.filter(n => {
      if (filter === 'mentions')    return n.type === 'mention';
      if (filter === 'comments')    return n.type === 'comment_reply';
      if (filter === 'assignments') return n.type === 'task_assigned';
      return true;
    }),
    [notifications, filter]
  );

  const sections = useMemo(() => groupByDate(bundleNotifications(filtered)), [filtered]);

  const handleClick = (bundle) => {
    if (!bundle.is_read) markRead.mutate(bundle.ids);
    if (bundle.type === 'task_assigned') navigate('/tasks');
    else if (bundle.page_id) navigate(`/page/${bundle.page_id}`);
  };

  return (
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inbox</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            className="text-muted-foreground"
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mentions">Mentions</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
      </Tabs>

      {sections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {label}
              </p>
              <div className="space-y-1">
                {items.map(bundle => {
                  const Icon = TYPE_ICONS[bundle.type] || Bell;
                  return (
                    <button
                      key={bundle.id}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                        bundle.is_read
                          ? 'hover:bg-accent/50'
                          : 'bg-primary/5 hover:bg-primary/10'
                      )}
                      onClick={() => handleClick(bundle)}
                    >
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 relative',
                        bundle.is_read ? 'bg-muted' : 'bg-primary/10',
                      )}>
                        <Icon className={cn(
                          'h-4 w-4',
                          bundle.is_read ? 'text-muted-foreground' : 'text-primary',
                        )} />
                        {bundle.count > 1 && (
                          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                            {bundle.count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !bundle.is_read && 'font-medium')}>
                          {bundle.title}
                        </p>
                        {bundle.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {bundle.body}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(safeDate(bundle.created_date), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {!bundle.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}