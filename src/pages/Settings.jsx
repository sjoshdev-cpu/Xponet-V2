import React, { useState } from 'react';
import { Organization, Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Sun, Moon, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { user, currentOrg, theme, setTheme, refreshOrgs } = useWorkspace();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const updateOrg = useMutation({
    mutationFn: (data) => Organization.update(currentOrg.id, data),
    onSuccess: () => { refreshOrgs(); toast.success('Workspace updated'); }
  });

  const inviteMember = async () => {
    if (!inviteEmail) return;
    const members = [...(currentOrg.members || []), { email: inviteEmail, role: inviteRole, full_name: '' }];
    await Organization.update(currentOrg.id, { members });

    // Send notification
    await Notification.create({
      recipient_email: inviteEmail,
      type: 'invited',
      title: `You've been invited to ${currentOrg.name}`,
      body: `${user.full_name} invited you as ${inviteRole}`,
      org_id: currentOrg.id,
      sender_email: user.email,
      sender_name: user.full_name,
    });

    refreshOrgs();
    setInviteEmail('');
    toast.success(`Invited ${inviteEmail}`);
  };

  const removeMember = async (email) => {
    const members = (currentOrg.members || []).filter(m => m.email !== email);
    await Organization.update(currentOrg.id, { members });
    refreshOrgs();
    toast.success('Member removed');
  };

  const isAdmin = (currentOrg?.members || []).find(m => m.email === user?.email)?.role === 'admin' || currentOrg?.owner_email === user?.email;

  return (
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="account">
        <TabsList className="mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={user?.full_name || ''} disabled className="mt-1.5" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="mt-1.5" />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={isAdmin ? 'Admin' : 'Member'} disabled className="mt-1.5" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>Manage your workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Workspace name</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin} />
                    {isAdmin && (
                      <Button onClick={() => updateOrg.mutate({ name: orgName })}>Save</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>{(currentOrg?.members || []).length} member(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={inviteMember}>
                      <UserPlus className="h-4 w-4 mr-1.5" /> Invite
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {(currentOrg?.members || []).map(member => (
                    <div key={member.email} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">{member.full_name || member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{member.role}</Badge>
                        {isAdmin && member.email !== user?.email && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(member.email)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look of your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <Label className="mb-3 block">Theme</Label>
              <div className="flex gap-2">
                {[
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'system', icon: Monitor, label: 'System' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all',
                      theme === value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}