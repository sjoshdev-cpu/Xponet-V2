/**
 * PagePermissionsDialog
 * Manage per-user page roles (owner / editor / viewer) and permission inheritance.
 *
 * Props:
 *   open         — boolean
 *   onOpenChange — (bool) => void
 *   page         — full page object from Firestore
 *   orgMembers   — array of { email, full_name, role }
 *   onSave       — (updatedPage) => void  (called with { permissions, inherit_permissions })
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, UserCheck, Eye, Pencil, Crown, X } from 'lucide-react';

const ROLE_META = {
  owner:  { label: 'Owner',  icon: Crown,    color: 'text-amber-500' },
  editor: { label: 'Editor', icon: Pencil,   color: 'text-blue-500' },
  viewer: { label: 'Viewer', icon: Eye,      color: 'text-muted-foreground' },
};

function RoleIcon({ role, className }) {
  const meta = ROLE_META[role] || ROLE_META.viewer;
  const Icon = meta.icon;
  return <Icon className={cn('h-3.5 w-3.5', meta.color, className)} />;
}

function MemberAvatar({ member }) {
  const initials = (member.full_name || member.email || '?').charAt(0).toUpperCase();
  return (
    <span className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
      {initials}
    </span>
  );
}

export default function PagePermissionsDialog({ open, onOpenChange, page, orgMembers = [], onSave }) {
  const [perms, setPerms] = useState([]);
  const [inherit, setInherit] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Sync from page on open
  useEffect(() => {
    if (open) {
      setPerms(page?.permissions || []);
      setInherit(page?.inherit_permissions !== false); // default true
      setDirty(false);
    }
  }, [open, page]);

  const setRole = (email, role) => {
    setPerms((prev) => {
      const existing = prev.find((p) => p.email === email);
      if (existing) {
        return prev.map((p) => p.email === email ? { ...p, role } : p);
      }
      return [...prev, { email, role }];
    });
    setDirty(true);
  };

  const removeEntry = (email) => {
    setPerms((prev) => prev.filter((p) => p.email !== email));
    setDirty(true);
  };

  const getRole = (email) => perms.find((p) => p.email === email)?.role || null;

  const handleSave = () => {
    onSave?.({ permissions: perms, inherit_permissions: inherit });
    setDirty(false);
    onOpenChange(false);
  };

  // Members with explicit permission entries first, then rest of org
  const membersWithPerms = orgMembers.filter((m) => getRole(m.email));
  const membersWithout = orgMembers.filter((m) => !getRole(m.email));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Page Permissions
          </DialogTitle>
          <DialogDescription>
            Control who can view or edit "{page?.title || 'Untitled'}". Org admins always have full access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Inheritance toggle */}
          {page?.parent_id && (
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Inherit parent permissions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, users without an explicit role here inherit from the parent page.
                </p>
              </div>
              <Switch
                checked={inherit}
                onCheckedChange={(v) => { setInherit(v); setDirty(true); }}
              />
            </div>
          )}

          {/* Members with explicit permissions */}
          {membersWithPerms.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Explicit access</Label>
              {membersWithPerms.map((member) => {
                const role = getRole(member.email);
                return (
                  <div key={member.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <MemberAvatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RoleIcon role={role} />
                      <Select value={role} onValueChange={(v) => setRole(member.email, v)}>
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEntry(member.email)}
                        title="Remove explicit permission"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add members */}
          {membersWithout.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                {membersWithPerms.length > 0 ? 'Add more members' : 'Org members'}
              </Label>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {membersWithout.map((member) => (
                  <div key={member.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors group">
                    <MemberAvatar member={member} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(['viewer', 'editor', 'owner']).map((r) => (
                        <Button
                          key={r}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setRole(member.email, r)}
                        >
                          {ROLE_META[r].label}
                        </Button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:hidden">
                      {inherit ? 'inherited' : 'no access'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orgMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No other org members found.
            </p>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Changes take effect immediately after saving.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" disabled={!dirty} onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Hook: resolve effective role for a user on a page ──────────────────────
/**
 * Returns 'owner' | 'editor' | 'viewer' | null for a given email on a page.
 * Checks explicit perms first; if inherit is true and parent perms are provided,
 * falls back to those. Org admin check is handled separately by the caller.
 */
export function resolvePageRole(page, email, parentPage = null) {
  if (!email) return null;
  const find = (p) => (p?.permissions || []).find((e) => e.email === email)?.role;
  const direct = find(page);
  if (direct) return direct;
  if (page?.inherit_permissions !== false && parentPage) {
    return find(parentPage) || null;
  }
  return null;
}

/**
 * Returns true if the user can edit the page.
 * Org owner/admin → always true.
 * Otherwise checks permissions array.
 */
export function canEdit(page, email, isOrgAdmin = false) {
  if (isOrgAdmin) return true;
  const role = resolvePageRole(page, email);
  return role === 'owner' || role === 'editor';
}

/**
 * Returns true if the user can view the page.
 */
export function canView(page, email, isOrgAdmin = false) {
  if (isOrgAdmin) return true;
  const role = resolvePageRole(page, email);
  return role !== null;
}
