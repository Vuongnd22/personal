"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, errorMessage, fieldErrors, useMe, useUsers } from "@/lib/queries";
import { ROLE_LABEL } from "@/lib/format";
import type { Role, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Card, SectionTitle } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { PageHeader } from "@/components/page-header";
import { PRODUCT_COLORS } from "@/components/product-icon";

function Profile({ me }: { me: User }) {
  const qc = useQueryClient();
  const [name, setName] = useState(me.name);
  const [color, setColor] = useState(me.avatarColor);
  const [pending, setPending] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const user = await api.patch<User>("/auth/me", { name, avatarColor: color });
      qc.setQueryData(["me"], user);
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionTitle>Profile</SectionTitle>
      <form onSubmit={save} className="flex max-w-md flex-col gap-3">
        <div className="flex items-center gap-3"><Avatar name={name || me.name} color={color} size={40} /><div className="text-xs text-zinc-500">{me.email} · {ROLE_LABEL[me.role]}</div></div>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Avatar colour</span>
          <div className="flex gap-1.5">
            {PRODUCT_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={cn("size-5 rounded-full ring-offset-1", color === c && "ring-2 ring-zinc-900")} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <Button type="submit" variant="primary" className="self-start" disabled={pending}>Save profile</Button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError("Passwords do not match");
    setPending(true);
    setError(null);
    try {
      await api.post("/auth/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      setError(fieldErrors(err).newPassword ?? errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionTitle>Change password</SectionTitle>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></Field>
        <Field label="New password (min. 8 characters)"><Input type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></Field>
        {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
        <Button type="submit" variant="primary" className="self-start" disabled={pending}>Change password</Button>
      </form>
    </Card>
  );
}

function UserDialog({ user, open, onOpenChange }: { user: User | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  // Only mounted while open, keyed by the target user, so its form state is always fresh — no effect needed.
  return open ? <UserForm key={user?.id ?? "new"} user={user} onOpenChange={onOpenChange} /> : null;
}

function UserForm({ user, onOpenChange }: { user: User | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => (user ? { email: user.email, name: user.name, role: user.role, password: "" } : { email: "", name: "", role: "MEMBER" as Role, password: "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (user) await api.patch(`/users/${user.id}`, { name: form.name, role: form.role, ...(form.password ? { password: form.password } : {}) });
      else await api.post("/users", form);
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(user ? "User updated" : "User created");
      onOpenChange(false);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(Object.keys(fe).length ? fe : { form: errorMessage(err) });
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="user-form">
        <DialogHeader title={user ? `Edit ${user.name}` : "New user"} />
        <form id="user-form" onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Email" error={errors.email}><Input type="email" value={form.email} disabled={!!user} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Name" error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{(["ADMIN", "MANAGER", "MEMBER"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
          <Field label={user ? "Reset password (leave empty to keep)" : "Password (min. 8 characters)"} error={errors.password}>
            <Input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!user} />
          </Field>
          {errors.form && <p className="text-[13px] text-red-600">{errors.form}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="user-form">{user ? "Save" : "Create user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserManagement({ me }: { me: User }) {
  const users = useUsers();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(u.isActive ? "User deactivated" : "User reactivated");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid="user-management">
      <SectionTitle action={<Button size="sm" variant="primary" onClick={() => setEditing(null)} data-testid="new-user"><Plus /> New user</Button>}>Users</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500"><tr>{["User", "Role", "Status", ""].map((h) => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-2 py-2"><span className="flex items-center gap-2"><Avatar name={u.name} color={u.avatarColor} size={22} /><span><span className="font-medium">{u.name}</span><span className="block text-xs text-zinc-500">{u.email}</span></span></span></td>
                <td className="px-2 py-2"><Badge>{ROLE_LABEL[u.role]}</Badge></td>
                <td className="px-2 py-2">{u.isActive ? <Badge color="#16a34a">Active</Badge> : <Badge color="#71717a">Deactivated</Badge>}</td>
                <td className="px-2 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>Edit</Button>
                  {u.id !== me.id && <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>{u.isActive ? "Deactivate" : "Reactivate"}</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserDialog user={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />
    </Card>
  );
}

export default function SettingsPage() {
  const me = useMe().data;
  if (!me) return null;
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Profile me={me} />
        <ChangePassword />
      </div>
      {me.role === "ADMIN" && <UserManagement me={me} />}
    </div>
  );
}
