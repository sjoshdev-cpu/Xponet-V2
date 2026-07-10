import React, { useState, useEffect } from 'react';
import { Organization, Notification, ReminderConfig } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Sun, Moon, Monitor, Bell, User, Building2, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/layout/PageHeader';
import { ROLES, ROLE_LABELS, ASSIGNABLE_ROLES, canChangeRole, buildMemberFields } from '@/lib/permissions';

export default function Settings() {
  const { user, currentOrg, theme, setTheme, refreshOrgs, role } = useWorkspace();
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
    await Organization.update(currentOrg.id, buildMemberFields(members));

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
    await Organization.update(currentOrg.id, buildMemberFields(members));
    refreshOrgs();
    toast.success('Member removed');
  };

  const changeRole = async (email, newRole) => {
    const target = (currentOrg.members || []).find((m) => m.email === email);
    if (!target || !canChangeRole(role, target.role, newRole)) {
      toast.error("You don't have permission to make that change");
      return;
    }
    const adminCount = (currentOrg.members || []).filter((m) => m.role === ROLES.ADMIN).length;
    if (target.role === ROLES.ADMIN && newRole !== ROLES.ADMIN && adminCount <= 1) {
      toast.error('A workspace needs at least one admin');
      return;
    }
    const members = (currentOrg.members || []).map((m) =>
      m.email === email ? { ...m, role: newRole } : m
    );
    await Organization.update(currentOrg.id, buildMemberFields(members));
    refreshOrgs();
    toast.success(`${target.full_name || email} is now ${ROLE_LABELS[newRole]}`);
  };

  const isAdmin = role === ROLES.ADMIN;

  const OFFSET_OPTIONS = [
    { value: 7, label: '1 week before' },
    { value: 3, label: '3 days before' },
    { value: 1, label: '1 day before' },
    { value: 0, label: 'On the due date' },
  ];

  const HOUR_OFFSET_OPTIONS = [
    { value: 5, label: '5 hours before' },
    { value: 3, label: '3 hours before' },
    { value: 1, label: '1 hour before' },
  ];

  const { data: reminderConfig } = useQuery({
    queryKey: ['reminder-config', currentOrg?.id],
    queryFn: () => ReminderConfig.get(currentOrg.id),
    enabled: !!currentOrg?.id,
  });

  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [offsetsDays, setOffsetsDays] = useState([1]);
  const [offsetsHours, setOffsetsHours] = useState([]);
  const [sendHourUtc, setSendHourUtc] = useState(8);

  useEffect(() => {
    if (!reminderConfig) return;
    setRemindersEnabled(!!reminderConfig.enabled);
    setOffsetsDays(reminderConfig.offsets_days ?? [1]);
    setOffsetsHours(reminderConfig.offsets_hours || []);
    setSendHourUtc(reminderConfig.send_hour_utc ?? 8);
  }, [reminderConfig]);

  const toggleOffset = (value) => {
    setOffsetsDays((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort((a, b) => b - a)
    );
  };

  const toggleHourOffset = (value) => {
    setOffsetsHours((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort((a, b) => b - a)
    );
  };

  const noTimingsSelected = offsetsDays.length === 0 && offsetsHours.length === 0;

  const saveReminderConfig = useMutation({
    mutationFn: () => ReminderConfig.upsert(currentOrg.id, {
      org_id: currentOrg.id,
      enabled: remindersEnabled,
      offsets_days: offsetsDays,
      offsets_hours: offsetsHours,
      send_hour_utc: sendHourUtc,
      updated_by: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-config', currentOrg?.id] });
      toast.success('Reminder settings saved');
    },
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon="⚙️" title="Settings" />
      <div className="max-w-[700px] mx-auto px-6 py-8 w-full">

      <Tabs defaultValue="account">
        <TabsList className="mb-6 h-auto w-full sm:w-fit p-1">
          <TabsTrigger value="account" className="gap-1.5 px-3 py-1.5">
            <User className="h-3.5 w-3.5" /> Account
          </TabsTrigger>
          <TabsTrigger value="workspace" className="gap-1.5 px-3 py-1.5">
            <Building2 className="h-3.5 w-3.5" /> Workspace
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="reminders" className="gap-1.5 px-3 py-1.5">
              <Bell className="h-3.5 w-3.5" /> Reminders
            </TabsTrigger>
          )}
          <TabsTrigger value="appearance" className="gap-1.5 px-3 py-1.5">
            <Palette className="h-3.5 w-3.5" /> Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-base font-semibold text-primary">
                  {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-1.5"><User className="h-4 w-4" /> Profile</CardTitle>
                  <CardDescription>Your account information</CardDescription>
                </div>
              </div>
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
                <Input value={ROLE_LABELS[role] || 'Member'} disabled className="mt-1.5" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Workspace Settings</CardTitle>
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
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={inviteMember}>
                      <UserPlus className="h-4 w-4 mr-1.5" /> Invite
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {(currentOrg?.members || []).map(member => {
                    const availableRoles = ASSIGNABLE_ROLES.filter(
                      (r) => r !== member.role && canChangeRole(role, member.role, r)
                    );
                    const canEditThisRole = member.email !== user?.email && availableRoles.length > 0;
                    return (
                      <div key={member.email} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium">{member.full_name || member.email}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditThisRole ? (
                            <Select value={member.role} onValueChange={(v) => changeRole(member.email, v)}>
                              <SelectTrigger className="h-7 w-[110px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={member.role}>{ROLE_LABELS[member.role]}</SelectItem>
                                {availableRoles.map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{ROLE_LABELS[member.role] || member.role}</Badge>
                          )}
                          {isAdmin && member.email !== user?.email && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(member.email)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="reminders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Due-Date Reminders</CardTitle>
                <CardDescription>Email assignees automatically as their tasks approach the due date</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable email reminders</p>
                    <p className="text-xs text-muted-foreground">Sends once per task per selected timing — never duplicated</p>
                  </div>
                  <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
                </div>

                <div className={cn(!remindersEnabled && 'opacity-50 pointer-events-none')}>
                  <Label className="mb-2 block">Send a reminder</Label>
                  <div className="space-y-2">
                    {OFFSET_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={offsetsDays.includes(value)}
                          onCheckedChange={() => toggleOffset(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className={cn(!remindersEnabled && 'opacity-50 pointer-events-none')}>
                  <Label className="mb-2 block">Last-minute reminders</Label>
                  <div className="space-y-2">
                    {HOUR_OFFSET_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={offsetsHours.includes(value)}
                          onCheckedChange={() => toggleHourOffset(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Counted down to end of business on the due date — 17:00 Lusaka time (15:00 UTC) — so they arrive as the deadline approaches. The send time below doesn't apply.
                  </p>
                </div>

                <div className={cn(!remindersEnabled && 'opacity-50 pointer-events-none')}>
                  <Label className="mb-1.5 block">Send time</Label>
                  <Select value={String(sendHourUtc)} onValueChange={(v) => setSendHourUtc(Number(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00 UTC</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Times are in UTC. Lusaka (CAT) is UTC+2 — e.g. 06:00 UTC = 08:00 CAT.
                  </p>
                </div>

                <Button
                  onClick={() => saveReminderConfig.mutate()}
                  disabled={saveReminderConfig.isPending || noTimingsSelected}
                >
                  Save reminder settings
                </Button>
                {remindersEnabled && noTimingsSelected && (
                  <p className="text-xs text-destructive">Select at least one timing, or turn reminders off.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5"><Palette className="h-4 w-4" /> Appearance</CardTitle>
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
    </div>
  );
}