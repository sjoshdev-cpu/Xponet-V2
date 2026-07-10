import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth, getKnownAccounts } from '@/lib/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, Plus, Settings, UserPlus, LogOut, UserRound, Mail } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Notion-style workspace switcher for the sidebar header.
 *
 * - Lists every workspace this account belongs to; click to switch.
 * - Pending invitations appear inline with a Join action.
 * - "New workspace" creates another workspace under the same account.
 * - Accounts section: other accounts previously signed in on this device.
 *   Firebase Auth keeps one active session, so choosing one signs out and
 *   returns to the login screen pre-filled with that account's email.
 */
export default function WorkspaceSwitcher() {
  const { user, currentOrg, orgs, switchOrg, pendingInvites, acceptInvite, createWorkspace } = useWorkspace();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [newWsOpen, setNewWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creating, setCreating] = useState(false);

  const otherAccounts = getKnownAccounts().filter((a) => a.email !== user?.email);
  const memberCount = (currentOrg?.members || []).length;

  const handleCreate = async () => {
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(newWsName.trim());
      toast.success(`Workspace "${newWsName.trim()}" created`);
      setNewWsOpen(false);
      setNewWsName('');
      navigate('/');
    } catch (err) {
      toast.error(`Could not create workspace — ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (org) => {
    try {
      await acceptInvite(org);
      toast.success(`Joined "${org.name}"`);
    } catch (err) {
      toast.error(`Could not join — ${err.message}`);
    }
  };

  const switchAccount = async (email) => {
    // Pre-fill the login form for the account being switched to
    localStorage.setItem('xponet-login-hint', email || '');
    await logout();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-1.5 py-1 transition-colors min-w-0 flex-1 text-left">
            <span className="text-lg shrink-0">{currentOrg?.icon || '🏠'}</span>
            <span className="font-semibold text-sm truncate">{currentOrg?.name || 'Workspace'}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {/* Current workspace header */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="text-2xl shrink-0">{currentOrg?.icon || '🏠'}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{currentOrg?.name || 'Workspace'}</p>
              <p className="text-xs text-muted-foreground">
                {memberCount} member{memberCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <DropdownMenuItem onSelect={() => navigate('/settings')} className="gap-2 text-xs">
            <Settings className="h-3.5 w-3.5" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/settings')} className="gap-2 text-xs">
            <UserPlus className="h-3.5 w-3.5" /> Invite members
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* This account's workspaces */}
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground truncate">
            {user?.email}
          </DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem key={org.id} onSelect={() => switchOrg(org)} className="gap-2">
              <span className="text-base shrink-0">{org.icon || '🏠'}</span>
              <span className="truncate flex-1 text-sm">{org.name}</span>
              {currentOrg?.id === org.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}

          {/* Workspaces this account has been invited to */}
          {pendingInvites.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={(e) => { e.preventDefault(); handleJoin(org); }}
              className="gap-2"
            >
              <span className="text-base shrink-0">{org.icon || '🏠'}</span>
              <span className="truncate flex-1 text-sm">{org.name}</span>
              <span className="text-[10px] font-semibold text-primary shrink-0">Join</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuItem onSelect={() => setNewWsOpen(true)} className="gap-2 text-xs text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> New workspace
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Other accounts on this device */}
          {otherAccounts.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                Other accounts
              </DropdownMenuLabel>
              {otherAccounts.map((acc) => (
                <DropdownMenuItem key={acc.email} onSelect={() => switchAccount(acc.email)} className="gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    {acc.name && <p className="text-xs font-medium truncate">{acc.name}</p>}
                    <p className="text-[11px] text-muted-foreground truncate">{acc.email}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuItem onSelect={() => switchAccount('')} className="gap-2 text-xs">
            <Mail className="h-3.5 w-3.5" /> Add another account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => logout()} className="gap-2 text-xs text-destructive focus:text-destructive">
            <LogOut className="h-3.5 w-3.5" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* New workspace dialog */}
      <Dialog open={newWsOpen} onOpenChange={setNewWsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>Create another workspace under {user?.email}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Workspace name"
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWsOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newWsName.trim()}>
              {creating ? 'Creating…' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
