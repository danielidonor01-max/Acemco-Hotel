"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil, Loader2, Lock, Trash2, Users as UsersIcon, KeyRound, History } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/providers/auth-provider";
import {
  listRoles, createRole, updateRole, deleteRole, listPermissions,
  listUsers, createUser, updateUser,
  type AdminRole, type AdminUser, type PermissionGroup,
} from "@/lib/data/admin";
import { listAuditLogs } from "@/lib/data/operations";

const labelize = (s: string) => s.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

export default function AdministrationPage() {
  const { user } = useAuth();

  return (
    <PageShell
      title="Administration"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Administration" }]}
    >
      <Card className="mb-6">
        <CardHeader><CardTitle>Your Access</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface-3 font-semibold text-foreground">
            {initials(user?.name ?? "?")}
          </div>
          <div>
            <p className="font-medium text-foreground">{user?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">
              {(user?.roles ?? []).map(labelize).join(", ") || "No role"} · {(user?.permissions ?? []).length} permissions
            </p>
          </div>
          {(user?.roles ?? []).slice(0, 1).map((r) => (
            <Badge key={r} tone="brand" className="ml-auto"><Shield size={12} className="mr-1" /> {labelize(r)}</Badge>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="roles">
        <TabsList className="mb-4">
          <TabsTrigger value="roles"><Shield size={15} className="mr-1.5" /> Roles</TabsTrigger>
          <TabsTrigger value="users"><UsersIcon size={15} className="mr-1.5" /> Users</TabsTrigger>
          <TabsTrigger value="activity"><History size={15} className="mr-1.5" /> Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

/* ============================ Roles ============================ */

function RolesTab() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const { data: perms = [] } = useQuery({ queryKey: ["admin", "permissions"], queryFn: listPermissions });
  const [editing, setEditing] = useState<AdminRole | null | "new">(null);

  const columns: Column<AdminRole>[] = [
    {
      key: "name", header: "Role", sortValue: (r) => r.name,
      render: (r) => <span className="font-medium text-foreground">{labelize(r.name)}</span>,
    },
    { key: "description", header: "Description", render: (r) => <span className="text-muted-foreground">{r.description}</span> },
    {
      key: "permissions", header: "Permissions", align: "center", sortValue: (r) => r.permissions.length,
      render: (r) => <Badge tone="neutral">{r.permissions.length}</Badge>,
    },
    {
      key: "userCount", header: "Users", align: "center", sortValue: (r) => r.userCount,
      render: (r) => <span className="text-muted-foreground">{r.userCount}</span>,
    },
    { key: "isSystem", header: "Type", render: (r) => <Badge tone={r.isSystem ? "brand" : "neutral"}>{r.isSystem ? "System" : "Custom"}</Badge> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
          <Pencil size={14} /> Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus size={16} /> New Role</Button>
      </div>
      <DataTable columns={columns} data={roles} isLoading={isLoading} />
      {editing !== null && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          groups={perms}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "roles"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function RoleDialog({ role, groups, onClose, onSaved }: {
  role: AdminRole | null;
  groups: PermissionGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const locked = role?.name === "SUPER_ADMIN";
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (key: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleModule = (group: PermissionGroup, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    group.actions.forEach((a) => (on ? next.add(a.key) : next.delete(a.key)));
    return next;
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim(), permissions: [...selected] };
      if (isEdit) return updateRole(role!.id, locked ? { description: payload.description } : payload);
      return createRole(payload);
    },
    onSuccess: () => { toast.success(isEdit ? "Role updated." : "Role created."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteRole(role!.id),
    onSuccess: () => { toast.success("Role deleted."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = name.trim().length >= 2 && description.trim().length >= 1 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {locked && <Lock size={15} className="text-muted-foreground" />}
            {isEdit ? `Edit ${labelize(role!.name)}` : "New Role"}
          </DialogTitle>
          <DialogDescription>
            {locked
              ? "The Super Admin role always has unrestricted access — only its description is editable."
              : "Define what this role can see and do across the platform."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Desk Supervisor"
              disabled={locked || role?.isSystem}
            />
            {role?.isSystem && !locked && <p className="text-xs text-muted-foreground">System roles cannot be renamed.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-2">
            <Label>Permissions <span className="text-muted-foreground">({selected.size} selected)</span></Label>
            <div className="rounded-lg border border-line divide-y divide-line">
              {groups.map((g) => {
                const all = g.actions.every((a) => selected.has(a.key));
                return (
                  <div key={g.module} className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{labelize(g.module)}</span>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => toggleModule(g, !all)}
                        className="text-xs text-primary hover:underline disabled:opacity-40"
                      >
                        {all ? "Clear" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {g.actions.map((a) => (
                        <label key={a.key} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={selected.has(a.key)}
                            disabled={locked}
                            onCheckedChange={() => toggle(a.key)}
                          />
                          {labelize(a.action)}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div>
            {isEdit && !role!.isSystem && (
              confirmDelete ? (
                <Button variant="destructive" size="sm" disabled={del.isPending} onClick={() => del.mutate()}>
                  {del.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Confirm delete
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> Delete
                </Button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!canSave} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 size={14} className="animate-spin" />} {isEdit ? "Save changes" : "Create role"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Activity (audit log) ============================ */

function ActivityTab() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["admin", "audit"], queryFn: listAuditLogs });
  const columns: Column<(typeof logs)[number]>[] = [
    { key: "occurredAt", header: "When", sortValue: (l) => l.occurredAt, render: (l) => <span className="text-muted-foreground">{new Date(l.occurredAt).toLocaleString()}</span> },
    { key: "user", header: "User", render: (l) => <span className="font-medium text-foreground">{l.user}</span> },
    { key: "action", header: "Action", render: (l) => <Badge tone="neutral">{l.action}</Badge> },
    { key: "module", header: "Module", render: (l) => <span className="capitalize text-muted-foreground">{l.module.replace(/_/g, " ")}</span> },
    { key: "targetId", header: "Target", render: (l) => <span className="text-xs text-muted-foreground">{l.targetId ?? "—"}</span> },
  ];
  return <DataTable columns={columns} data={logs} isLoading={isLoading} />;
}

/* ============================ Users ============================ */

function UsersTab() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: listUsers });
  const { data: roles = [] } = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const [editing, setEditing] = useState<AdminUser | null | "new">(null);

  const columns: Column<AdminUser>[] = [
    { key: "name", header: "Name", sortValue: (u) => u.name, render: (u) => <span className="font-medium text-foreground">{u.name}</span> },
    { key: "email", header: "Email", render: (u) => <span className="text-muted-foreground">{u.email}</span> },
    {
      key: "roles", header: "Roles",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.length ? u.roles.map((r) => <Badge key={r.id} tone="neutral">{labelize(r.name)}</Badge>) : <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    { key: "isActive", header: "Status", render: (u) => <Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</Badge> },
    {
      key: "actions", header: "", align: "right",
      render: (u) => <Button variant="ghost" size="sm" onClick={() => setEditing(u)}><Pencil size={14} /> Edit</Button>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus size={16} /> New User</Button>
      </div>
      <DataTable columns={columns} data={users} isLoading={isLoading} />
      {editing !== null && (
        <UserDialog
          userRow={editing === "new" ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function UserDialog({ userRow, roles, onClose, onSaved }: {
  userRow: AdminUser | null;
  roles: AdminRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!userRow;
  const [name, setName] = useState(userRow?.name ?? "");
  const [email, setEmail] = useState(userRow?.email ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(userRow?.isActive ?? true);
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set(userRow?.roles.map((r) => r.id) ?? []));

  const toggleRole = (id: string) => setRoleIds((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return updateUser(userRow!.id, {
          name: name.trim(),
          isActive,
          roleIds: [...roleIds],
          ...(password ? { password } : {}),
        });
      }
      return createUser({ name: name.trim(), email: email.trim(), password, roleIds: [...roleIds] });
    },
    onSuccess: () => { toast.success(isEdit ? "User updated." : "User created."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const pwOk = isEdit ? (password === "" || password.length >= 8) : password.length >= 8;
  const canSave = name.trim().length >= 2 && emailOk && pwOk && roleIds.size >= 1 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${userRow!.name}` : "New Staff Account"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this account, reset its password, or reassign roles." : "Create a staff account and assign one or more roles."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-pw" className="flex items-center gap-1.5"><KeyRound size={13} /> {isEdit ? "New password" : "Password"}</Label>
            <Input id="u-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "Leave blank to keep current" : "At least 8 characters"} />
          </div>

          <div className="grid gap-2">
            <Label>Roles <span className="text-muted-foreground">({roleIds.size} selected)</span></Label>
            <div className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
              {roles.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={roleIds.has(r.id)} onCheckedChange={() => toggleRole(r.id)} />
                  {labelize(r.name)}
                </label>
              ))}
            </div>
          </div>

          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
              Account active
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} {isEdit ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
