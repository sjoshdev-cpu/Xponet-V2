import React, { useState } from 'react';
import { Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, AtSign, UserPlus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const safeDate = (val) => {
  if (!val) return new Date();
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

export default function Inbox() {
  const { user } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-all', user?.email],
    queryFn: () => Notification.filter({ recipient_email: user?.email }),
    enabled: !!user?.email
  });

  const markRead = useMutation({
    mutationFn: (id) => Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    }
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => {
        if (filter === 'mentions') return n.type === 'mention';
        if (filter === 'comments') return n.type === 'comment_reply';
        if (filter === 'assignments') return n.type === 'task_assigned';
        return true;
      });

  const sorted = [...filtered].sort((a, b) => safeDate(b.created_date) - safeDate(a.created_date));

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
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} className="text-muted-foreground">
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

      <div className="space-y-1">
        {sorted.map(notif => {
          const Icon = TYPE_ICONS[notif.type] || Bell;
          return (
            <button
              key={notif.id}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                notif.is_read ? 'hover:bg-accent/50' : 'bg-primary/5 hover:bg-primary/10'
              )}
              onClick={() => {
                if (!notif.is_read) markRead.mutate(notif.id);
                if (notif.type === 'task_assigned') navigate('/tasks');
                else if (notif.page_id) navigate(`/page/${notif.page_id}`);
              }}
            >
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                notif.is_read ? 'bg-muted' : 'bg-primary/10'
              )}>
                <Icon className={cn('h-4 w-4', notif.is_read ? 'text-muted-foreground' : 'text-primary')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !notif.is_read && 'font-medium')}>{notif.title}</p>
                {notif.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(safeDate(notif.created_date), 'MMM d, h:mm a')}
                </p>
              </div>
              {!notif.is_read && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
              )}
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}