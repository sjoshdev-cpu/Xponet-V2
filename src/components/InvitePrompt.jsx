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

        <div className="space-y-3 py-2">
          {pendingInvites.map((org) => {
            const invite = (org.pending_invites || []).find(i => i.email === user.email);
            const busy = busyOrgId === org.id;
            return (
              <div key={org.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border text-xl">
                    {org.icon || '🏠'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Join as <span className="font-medium text-foreground">{ROLE_LABELS[invite?.role] || invite?.role || 'Member'}</span>
                    </p>
                    {invite?.invited_by && (
                      <p className="text-xs text-muted-foreground truncate">
                        Invited by {invite.invited_by}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" disabled={busy} onClick={() => handle(org, acceptInvite, 'Accepted')}>
                    {busy ? 'Working…' : 'Accept invitation'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => handle(org, declineInvite, 'Declined')}>
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
