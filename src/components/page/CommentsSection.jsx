import React, { useState } from 'react';
import { Comment, Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';
import { MessageSquare, Send, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MentionInput, { renderContent, serializeContent } from './MentionInput';

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

async function notifyMentions(mentions, { pageId, orgId, senderName, senderEmail, body }) {
  await Promise.all(
    (mentions || []).map((m) =>
      m.email !== senderEmail
        ? Notification.create({
            recipient_email: m.email,
            type: 'mention',
            title: `${senderName || senderEmail} mentioned you`,
            body: body?.slice(0, 120),
            page_id: pageId,
            org_id: orgId,
            sender_email: senderEmail,
            sender_name: senderName,
            is_read: false,
          })
        : null,
    ).filter(Boolean),
  );
}

function CommentItem({ comment, allComments, pageId, orgId, members }) {
  const replies = allComments.filter((c) => c.parent_comment_id === comment.id);
  const [showReply, setShowReply] = useState(false);
  const [replyVal, setReplyVal] = useState({ text: '', mentions: [] });
  const { user } = useWorkspace();
  const queryClient = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: async () => {
      const content = serializeContent(replyVal.text, replyVal.mentions);
      await Comment.create({
        page_id: pageId,
        content,
        org_id: orgId,
        parent_comment_id: comment.id,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
        is_resolved: false,
      });
      // Notify the parent comment author
      if (comment.author_email && comment.author_email !== user?.email) {
        await Notification.create({
          recipient_email: comment.author_email,
          type: 'comment_reply',
          title: `${user?.full_name || user?.email} replied to your comment`,
          body: replyVal.text.slice(0, 120),
          page_id: pageId,
          org_id: orgId,
          sender_email: user?.email,
          sender_name: user?.full_name,
          is_read: false,
        });
      }
      // Notify @mentions from tokens (not regex)
      await notifyMentions(replyVal.mentions, {
        pageId,
        orgId,
        senderName: user?.full_name,
        senderEmail: user?.email,
        body: replyVal.text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setReplyVal({ text: '', mentions: [] });
      setShowReply(false);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => Comment.update(comment.id, { is_resolved: !comment.is_resolved }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', pageId] }),
  });

  return (
    <div className={cn('space-y-1', comment.is_resolved && 'opacity-60')}>
      <div className="flex gap-3 group">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
          {(comment.author_name || comment.author_email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold">{comment.author_name || comment.author_email}</span>
            <span className="text-xs text-muted-foreground">
              {format(safeDate(comment.created_at || comment.created_date), 'MMM d, h:mm a')}
            </span>
            {comment.is_resolved && (
              <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {renderContent(comment.content)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <CornerDownRight className="h-3 w-3" /> Reply
            </button>
            <button
              onClick={() => resolveMutation.mutate()}
              className={cn(
                'text-xs transition-colors flex items-center gap-1',
                comment.is_resolved
                  ? 'text-green-500 hover:text-muted-foreground'
                  : 'text-muted-foreground hover:text-green-600',
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {comment.is_resolved ? 'Unresolve' : 'Resolve'}
            </button>
          </div>
        </div>
      </div>

      {showReply && (
        <div className="ml-10 flex gap-2 mt-2">
          <MentionInput
            value={replyVal}
            onChange={setReplyVal}
            members={members}
            placeholder="Write a reply… Type @ to mention"
            rows={1}
            onSubmit={() => replyVal.text.trim() && replyMutation.mutate()}
            autoFocus
            className="text-sm"
          />
          <Button
            size="sm"
            disabled={!replyVal.text.trim() || replyMutation.isPending}
            onClick={() => replyMutation.mutate()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {replies.length > 0 && (
        <div className="ml-10 space-y-3 border-l-2 border-border pl-3 mt-2">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              allComments={allComments}
              pageId={pageId}
              orgId={orgId}
              members={members}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentsSection({ pageId, orgId, members = [] }) {
  const { user } = useWorkspace();
  const queryClient = useQueryClient();
  const [newVal, setNewVal] = useState({ text: '', mentions: [] });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: () => Comment.filter({ page_id: pageId }),
    enabled: !!pageId,
  });

  // Page-level comments only (no block_id)
  const topLevel = comments.filter((c) => !c.parent_comment_id && !c.block_id);

  const addComment = useMutation({
    mutationFn: async () => {
      const content = serializeContent(newVal.text, newVal.mentions);
      await Comment.create({
        page_id: pageId,
        content,
        org_id: orgId,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
        is_resolved: false,
      });
      // Notify @mentions from structured tokens — no regex
      await notifyMentions(newVal.mentions, {
        pageId,
        orgId,
        senderName: user?.full_name,
        senderEmail: user?.email,
        body: newVal.text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      setNewVal({ text: '', mentions: [] });
    },
  });

  return (
    <div className="border-t border-border mt-12 pt-8">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
        <MessageSquare className="h-4 w-4" />
        Comments ({topLevel.length})
      </h3>

      {/* New comment */}
      <div className="flex gap-3 mb-8">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
          {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 flex gap-2">
          <MentionInput
            value={newVal}
            onChange={setNewVal}
            members={members}
            placeholder="Add a comment… Type @ to mention someone"
            rows={2}
            onSubmit={() => newVal.text.trim() && addComment.mutate()}
          />
          <Button
            size="sm"
            disabled={!newVal.text.trim() || addComment.isPending}
            onClick={() => addComment.mutate()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-6">
        {topLevel.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            allComments={comments}
            pageId={pageId}
            orgId={orgId}
            members={members}
          />
        ))}
        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
