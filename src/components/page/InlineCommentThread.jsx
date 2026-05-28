import React, { useState } from 'react';
import { Comment, Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';
import { X, Send, CheckCircle2, CornerDownRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MentionInput, { renderContent, serializeContent } from './MentionInput';

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

function Avatar({ name, email, size = 'sm' }) {
  const letter = (name || email || '?').charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        'rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary shrink-0',
        size === 'sm' ? 'h-6 w-6 text-xs' : 'h-7 w-7 text-sm',
      )}
    >
      {letter}
    </span>
  );
}

function ThreadComment({ comment, allComments, pageId, orgId, members }) {
  const { user } = useWorkspace();
  const queryClient = useQueryClient();
  const [showReply, setShowReply] = useState(false);
  const [replyVal, setReplyVal] = useState({ text: '', mentions: [] });

  const replies = allComments.filter((c) => c.parent_comment_id === comment.id);

  const sendReply = useMutation({
    mutationFn: async () => {
      const content = serializeContent(replyVal.text, replyVal.mentions);
      await Comment.create({
        page_id: pageId,
        block_id: comment.block_id,
        content,
        org_id: orgId,
        parent_comment_id: comment.id,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
        is_resolved: false,
      });
      // Notify parent author
      if (comment.author_email && comment.author_email !== user?.email) {
        Notification.create({
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
      // Notify mentions
      await Promise.all(
        replyVal.mentions.map((m) =>
          m.email !== user?.email
            ? Notification.create({
                recipient_email: m.email,
                type: 'mention',
                title: `${user?.full_name || user?.email} mentioned you`,
                body: replyVal.text.slice(0, 120),
                page_id: pageId,
                org_id: orgId,
                sender_email: user?.email,
                sender_name: user?.full_name,
                is_read: false,
              })
            : null,
        ).filter(Boolean),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
      setReplyVal({ text: '', mentions: [] });
      setShowReply(false);
    },
  });

  const resolveThread = useMutation({
    mutationFn: () =>
      Comment.update(comment.id, { is_resolved: !comment.is_resolved }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', pageId] }),
  });

  return (
    <div className={cn('space-y-2', comment.is_resolved && 'opacity-50')}>
      <div className="flex gap-2">
        <Avatar name={comment.author_name} email={comment.author_email} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold">{comment.author_name || comment.author_email}</span>
            <span className="text-[10px] text-muted-foreground">
              {format(safeDate(comment.created_at || comment.created_date), 'MMM d, h:mm a')}
            </span>
            {comment.is_resolved && (
              <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                Resolved
              </span>
            )}
          </div>
          <div className="text-sm leading-relaxed mt-0.5 text-foreground/90">
            {renderContent(comment.content)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setShowReply((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <CornerDownRight className="h-2.5 w-2.5" /> Reply
            </button>
            <button
              onClick={() => resolveThread.mutate()}
              className={cn(
                'text-[10px] transition-colors flex items-center gap-1',
                comment.is_resolved
                  ? 'text-green-500 hover:text-muted-foreground'
                  : 'text-muted-foreground hover:text-green-600',
              )}
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              {comment.is_resolved ? 'Unresolve' : 'Resolve'}
            </button>
          </div>
        </div>
      </div>

      {showReply && (
        <div className="ml-8 flex gap-2">
          <MentionInput
            value={replyVal}
            onChange={setReplyVal}
            members={members}
            placeholder="Reply…"
            rows={1}
            onSubmit={() => replyVal.text.trim() && sendReply.mutate()}
            className="text-xs py-1.5 px-2"
          />
          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={!replyVal.text.trim() || sendReply.isPending}
            onClick={() => sendReply.mutate()}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      )}

      {replies.length > 0 && (
        <div className="ml-8 space-y-3 border-l-2 border-border pl-3">
          {replies.map((r) => (
            <ThreadComment
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

/**
 * InlineCommentThread
 *
 * Fixed right-side panel showing comments anchored to a specific block.
 * Props:
 *   blockId    — string
 *   pageId     — string
 *   orgId      — string
 *   members    — [{ email, name }]
 *   onClose    — () => void
 */
export default function InlineCommentThread({ blockId, pageId, orgId, members = [], onClose }) {
  const { user } = useWorkspace();
  const queryClient = useQueryClient();
  const [newVal, setNewVal] = useState({ text: '', mentions: [] });

  const { data: allComments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: () => Comment.filter({ page_id: pageId }),
    enabled: !!pageId,
  });

  const blockComments = allComments.filter(
    (c) => c.block_id === blockId && !c.parent_comment_id,
  );

  const addComment = useMutation({
    mutationFn: async () => {
      const content = serializeContent(newVal.text, newVal.mentions);
      await Comment.create({
        page_id: pageId,
        block_id: blockId,
        content,
        org_id: orgId,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
        is_resolved: false,
      });
      // Notify mentions
      await Promise.all(
        newVal.mentions.map((m) =>
          m.email !== user?.email
            ? Notification.create({
                recipient_email: m.email,
                type: 'mention',
                title: `${user?.full_name || user?.email} mentioned you`,
                body: newVal.text.slice(0, 120),
                page_id: pageId,
                org_id: orgId,
                sender_email: user?.email,
                sender_name: user?.full_name,
                is_read: false,
              })
            : null,
        ).filter(Boolean),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
      setNewVal({ text: '', mentions: [] });
    },
  });

  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length;

  return (
    <div className="fixed top-14 right-4 z-40 w-72 max-h-[80vh] flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">
            Block comments
            {unresolvedCount > 0 && (
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                {unresolvedCount}
              </span>
            )}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {blockComments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No comments on this block yet.
          </p>
        ) : (
          blockComments.map((c) => (
            <ThreadComment
              key={c.id}
              comment={c}
              allComments={allComments}
              pageId={pageId}
              orgId={orgId}
              members={members}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="border-t border-border px-3 py-2.5 shrink-0 space-y-2">
        <MentionInput
          value={newVal}
          onChange={setNewVal}
          members={members}
          placeholder="Add a comment… Type @ to mention"
          rows={2}
          onSubmit={() => newVal.text.trim() && addComment.mutate()}
          autoFocus
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!newVal.text.trim() || addComment.isPending}
            onClick={() => addComment.mutate()}
          >
            <Send className="h-3 w-3 mr-1" /> Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
