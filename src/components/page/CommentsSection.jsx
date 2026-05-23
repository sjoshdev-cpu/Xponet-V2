import React, { useState } from 'react';
import { Comment, Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};
import { MessageSquare, Send, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Extract @mentions from text, return array of emails/names
function extractMentions(text) {
  const matches = text.match(/@([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g) || [];
  return matches.map(m => m.slice(1));
}

async function createMentionNotifications(content, pageId, orgId, senderName, senderEmail) {
  const mentions = extractMentions(content);
  await Promise.all(mentions.map(email =>
    Notification.create({
      recipient_email: email,
      type: 'mention',
      title: `${senderName || senderEmail} mentioned you`,
      body: content.slice(0, 100),
      page_id: pageId,
      org_id: orgId,
      sender_email: senderEmail,
      sender_name: senderName,
      is_read: false,
    })
  ));
}

function CommentItem({ comment, allComments, onReply, pageId, orgId }) {
  const replies = allComments.filter(c => c.parent_comment_id === comment.id);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { user } = useWorkspace();
  const queryClient = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: async (content) => {
      await Comment.create({
        page_id: pageId, content, org_id: orgId,
        parent_comment_id: comment.id,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
      });
      // Notify parent comment author of reply
      if (comment.author_email && comment.author_email !== user?.email) {
        await Notification.create({
          recipient_email: comment.author_email,
          type: 'comment_reply',
          title: `${user?.full_name || user?.email} replied to your comment`,
          body: content.slice(0, 100),
          page_id: pageId,
          org_id: orgId,
          sender_email: user?.email,
          sender_name: user?.full_name,
          is_read: false,
        });
      }
      // @mention notifications
      await createMentionNotifications(content, pageId, orgId, user?.full_name, user?.email);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', pageId] }); queryClient.invalidateQueries({ queryKey: ['notifications'] }); setReplyText(''); setShowReply(false); }
  });

  return (
    <div className="space-y-1">
      <div className="flex gap-3 group">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
          {(comment.author_name || comment.author_email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold">{comment.author_name || comment.author_email}</span>
            <span className="text-xs text-muted-foreground">
              {format(safeDate(comment.created_date), 'MMM d, h:mm a')}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
          <button
            onClick={() => setShowReply(!showReply)}
            className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 transition-colors"
          >
            <CornerDownRight className="h-3 w-3" /> Reply
          </button>
        </div>
      </div>

      {showReply && (
        <div className="ml-10 flex gap-2 mt-2">
          <input
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && replyText && replyMutation.mutate(replyText)}
            placeholder="Write a reply..."
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" disabled={!replyText} onClick={() => replyMutation.mutate(replyText)}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {replies.length > 0 && (
        <div className="ml-10 space-y-3 border-l-2 border-border pl-3 mt-2">
          {replies.map(r => <CommentItem key={r.id} comment={r} allComments={allComments} onReply={onReply} pageId={pageId} orgId={orgId} />)}
        </div>
      )}
    </div>
  );
}

export default function CommentsSection({ pageId, orgId }) {
  const { user } = useWorkspace();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: () => Comment.filter({ page_id: pageId }),
    enabled: !!pageId
  });

  const addComment = useMutation({
    mutationFn: async (content) => {
      await Comment.create({
        page_id: pageId, content, org_id: orgId,
        author_name: user?.full_name || user?.email,
        author_email: user?.email,
      });
      // @mention notifications
      await createMentionNotifications(content, pageId, orgId, user?.full_name, user?.email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      setNewComment('');
    }
  });

  const topLevel = comments.filter(c => !c.parent_comment_id);

  return (
    <div className="border-t border-border mt-12 pt-8">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments.length})
      </h3>

      {/* New comment */}
      <div className="flex gap-3 mb-8">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
          {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && newComment && addComment.mutate(newComment)}
            placeholder="Add a comment... Use @email to mention someone"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" disabled={!newComment} onClick={() => addComment.mutate(newComment)}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-6">
        {topLevel.map(c => (
          <CommentItem key={c.id} comment={c} allComments={comments} pageId={pageId} orgId={orgId} />
        ))}
        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  );
}