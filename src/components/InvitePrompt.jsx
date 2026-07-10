import React, { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/permissions';
import { toast } from 'sonner';

/**
 * Shown whenever the signed-in user has pending workspace invitations.
 * Accepting moves them from the org's pending-invite fields into the member
 * fields (the only transition the security rules allow them to make).
 */
export default function InvitePrompt() {
  const { user, pendingInvites, acceptInvite, declineInvite } = useWorkspace();
  const [busyOrgId, setBusyOrgId] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed || pendingInvites.length === 0) return null;

  const handle = async (org, action, label) => {
    setBusyOrgId(org.id);
    try {
      await action(org);
      toast.success(`${label} invitation to "${org.name}"`);
    } catch (err) {
      console.error('[InvitePrompt]', err);
      toast.error(`Could not update the invitation — ${err.message}`);
    } finally {
      setBusyOrgId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) setDismissed(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Workspace invitation{pendingInvites.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            You've been invited to join {pendingInvites.length > 1 ? 'these workspaces' : 'a workspace'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {pendingInvites.map((org) => {
            const invite = (org.pending_invites || []).find(i => i.email === user.email);
            const busy = busyOrgId === org.id;
            return (
              <div key={org.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{org.icon || '🏠'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      as {ROLE_LABELS[invite?.role] || invite?.role || 'member'}
                      {invite?.invited_by ? ` · invited by ${invite.invited_by}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" disabled={busy} onClick={() => handle(org, acceptInvite, 'Accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => handle(org, declineInvite, 'Declined')}>
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
