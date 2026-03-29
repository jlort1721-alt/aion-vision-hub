import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, UserPlus, Shield, Loader2, Search, MailPlus, Copy, Key, Save } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import ErrorState from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { ALL_MODULES, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-destructive text-destructive-foreground' },
  tenant_admin: { label: 'Admin', color: 'bg-primary text-primary-foreground' },
  operator: { label: 'Operator', color: 'bg-secondary text-secondary-foreground' },
  viewer: { label: 'Viewer', color: 'bg-muted text-muted-foreground' },
  auditor: { label: 'Auditor', color: 'bg-accent text-accent-foreground' },
};

interface UserWithRoles {
  id: string;
  user_id: string;
  tenant_id: string;
  full_name: string;
  is_active: boolean;
  last_login: string | null;
  roles: string[];
}

export default function AdminPage() {
  const { hasAnyRole, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');
  const [inviteName, setInviteName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ temp_password?: string; activation_link?: string } | null>(null);

  const isAdmin = hasAnyRole(['super_admin', 'tenant_admin']);

  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const data = await apiClient.get<UserWithRoles[]>('/users');
      return data;
    },
    enabled: isAdmin,
  });

  const PAGE_SIZE = 25;

  const filtered = users.filter(u =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginatedUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    setInviteResult(null);
    try {
      const data = await apiClient.post<{ temp_password?: string; activation_link?: string }>('/users/invite', {
        email: inviteEmail,
        full_name: inviteName || inviteEmail,
        role: inviteRole,
      });
      setInviteResult({ temp_password: data?.temp_password, activation_link: data?.activation_link });
      toast.success(`User created: ${inviteEmail}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await apiClient.patch('/users/' + userId, { is_active: !currentActive });
      toast.success(`User ${currentActive ? 'deactivated' : 'activated'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const handleRoleChange = async (userId: string, tenantId: string, newRole: string) => {
    setLoading(true);
    try {
      await apiClient.patch('/users/' + userId + '/role', { role: newRole, tenant_id: tenantId });
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error('Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('admin.access_denied')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.access_denied_desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> {t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={o => { setInviteOpen(o); if (!o) { setInviteResult(null); setInviteEmail(''); setInviteName(''); } }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Invite User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5" /> Invite New User</DialogTitle></DialogHeader>
            {inviteResult ? (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-md bg-success/10 border border-success/30 text-sm">
                  <p className="font-medium text-success">User created successfully!</p>
                  <p className="text-muted-foreground mt-1">Share these credentials securely with the user.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      <Input value={inviteEmail} readOnly className="text-sm font-mono" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(inviteEmail, 'Email')}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Key className="h-3 w-3" /> Temporary Password</Label>
                    <div className="flex items-center gap-2">
                      <Input value={inviteResult.temp_password || ''} readOnly className="text-sm font-mono" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(inviteResult.temp_password || '', 'Password')}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {inviteResult.activation_link && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Activation Link</Label>
                      <div className="flex items-center gap-2">
                        <Input value={inviteResult.activation_link} readOnly className="text-xs font-mono" />
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(inviteResult.activation_link || '', 'Link')}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => { setInviteOpen(false); setInviteResult(null); setInviteEmail(''); setInviteName(''); }}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="John Doe" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="auditor">Auditor</SelectItem>
                        <SelectItem value="tenant_admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button onClick={handleInvite} disabled={!inviteEmail || loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                    Create & Generate Credentials
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{users.filter(u => u.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{users.filter(u => u.roles.includes('tenant_admin') || u.roles.includes('super_admin')).length}</p>
            <p className="text-xs text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{users.filter(u => u.roles.includes('operator')).length}</p>
            <p className="text-xs text-muted-foreground">Operators</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="permissions">Module Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Users</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map(user => {
                      const initials = user.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??';
                      const primaryRole = user.roles[0] || 'viewer';
                      const isSelf = user.user_id === profile?.user_id;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{user.full_name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                                <p className="text-xs text-muted-foreground">{user.user_id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={primaryRole} onValueChange={v => handleRoleChange(user.user_id, user.tenant_id, v)} disabled={isSelf || loading}>
                              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                                <SelectItem value="tenant_admin">Admin</SelectItem>
                                <SelectItem value="operator">Operator</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="auditor">Auditor</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-[10px]">
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user.user_id, user.is_active)} disabled={isSelf} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsEditor tenantId={profile?.tenant_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Editable permissions component
interface PermissionRow {
  role: string;
  module: string;
  enabled: boolean;
  tenant_id: string;
}

function PermissionsEditor({ tenantId }: { tenantId?: string }) {
  const EDITABLE_ROLES = useMemo(() => ['operator', 'viewer', 'auditor'], []);
  const queryClient = useQueryClient();
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load custom permissions from API
  const { data: dbPerms, isLoading } = useQuery({
    queryKey: ['role-module-permissions', tenantId],
    queryFn: async () => {
      const data = await apiClient.get<PermissionRow[]>('/roles/permissions');
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Initialize local state from API response or defaults
  useEffect(() => {
    const map: Record<string, Set<string>> = {};
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      map[role] = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
    }
    // Override with API values
    if (dbPerms && dbPerms.length > 0) {
      // For editable roles, start from empty and only add enabled ones
      for (const role of EDITABLE_ROLES) {
        const rolePerms = dbPerms.filter((p) => p.role === role);
        if (rolePerms.length > 0) {
          map[role] = new Set(rolePerms.filter((p) => p.enabled).map((p) => p.module));
        }
      }
    }
    setPerms(map);
    setDirty(false);
  }, [dbPerms, EDITABLE_ROLES]);

  const togglePerm = (role: string, module: string) => {
    setPerms(prev => {
      const next = { ...prev };
      const s = new Set(next[role]);
      if (s.has(module)) s.delete(module); else s.add(module);
      next[role] = s;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const rows: Array<{ tenant_id: string; role: string; module: string; enabled: boolean }> = [];
      for (const role of EDITABLE_ROLES) {
        for (const mod of ALL_MODULES) {
          rows.push({
            tenant_id: tenantId,
            role,
            module: mod.module,
            enabled: perms[role]?.has(mod.module) ?? false,
          });
        }
      }
      await apiClient.put('/roles/permissions', { permissions: rows });
      toast.success('Permissions saved');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!tenantId) return;
    // Reset local state to defaults
    const map: Record<string, Set<string>> = {};
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      map[role] = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
    }
    setPerms(map);
    // Delete all custom permissions via API
    setSaving(true);
    try {
      await apiClient.delete('/roles/permissions');
      toast.success('Permissions reset to defaults');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Module Access by Role</CardTitle>
            <p className="text-xs text-muted-foreground">Customize which modules each role can access. Admin roles always have full access.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleResetDefaults} disabled={saving}>
              Reset to Defaults
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Module</TableHead>
                  {Object.keys(DEFAULT_ROLE_PERMISSIONS).map(role => (
                    <TableHead key={role} className="text-center text-xs capitalize">
                      {ROLE_LABELS[role]?.label || role}
                      {!EDITABLE_ROLES.includes(role) && <span className="block text-[9px] text-muted-foreground">(locked)</span>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_MODULES.map(mod => (
                  <TableRow key={mod.module}>
                    <TableCell className="text-sm font-medium">{mod.label}</TableCell>
                    {Object.keys(DEFAULT_ROLE_PERMISSIONS).map(role => {
                      const isAdmin = role === 'super_admin' || role === 'tenant_admin';
                      const checked = isAdmin || (perms[role]?.has(mod.module) ?? false);
                      return (
                        <TableCell key={role} className="text-center">
                          <Checkbox
                            checked={checked}
                            disabled={isAdmin}
                            onCheckedChange={() => togglePerm(role, mod.module)}
                            className="mx-auto"
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
