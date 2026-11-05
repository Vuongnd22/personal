"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fieldErrors, useApiMutation, useFeatures, useUsers } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { useSetParams } from "@/lib/url";
import type { FeatureSummary } from "@/lib/types";
import { Avatar, Card, EmptyState, ErrorState, Progress, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/overlay";

const DEFAULT_CATEGORIES = ["Hardware", "Firmware", "Backend", "Frontend", "AI", "DevOps", "QA"];

function FeatureFormDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  feature: FeatureSummary | null;
  categories: string[];
}) {
  // Remount (not an effect) when the dialog opens or targets a different feature, so the form always starts fresh.
  return props.open ? <FeatureForm key={props.feature?.id ?? "new"} {...props} /> : null;
}

function FeatureForm({ open, onOpenChange, productId, feature, categories }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  feature: FeatureSummary | null;
  categories: string[];
}) {
  const users = useUsers();
  const [form, setForm] = useState(() =>
    feature
      ? { name: feature.name, description: feature.description, category: feature.category, ownerId: feature.owner?.id ?? "", startDate: feature.startDate ?? "", deadline: feature.deadline ?? "" }
      : { name: "", description: "", category: categories[0] ?? "General", ownerId: "", startDate: "", deadline: "" },
  );
  const save = useApiMutation(
    () => {
      const body = { ...form, ownerId: form.ownerId || null, startDate: form.startDate || null, deadline: form.deadline || null };
      return feature
        ? api.patch(`/features/${feature.id}`, body)
        : api.post(`/products/${productId}/features`, { ...body, ownerId: body.ownerId ?? undefined, startDate: body.startDate ?? undefined, deadline: body.deadline ?? undefined });
    },
    { success: feature ? "Feature updated" : "Feature created", onSuccess: () => onOpenChange(false) },
  );
  const errors = fieldErrors(save.error);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="feature-form">
        <DialogHeader title={feature ? "Edit feature" : "New feature"} />
        <form id="feature-form" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Name" error={errors.name ?? (save.error && !Object.keys(errors).length ? (save.error as Error).message : undefined)} className="col-span-2">
            <Input value={form.name} onChange={set("name")} required autoFocus name="name" />
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={set("category")} list="feature-categories" required name="category" />
          </Field>
          <datalist id="feature-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="Owner">
            <Select value={form.ownerId} onChange={set("ownerId")} name="ownerId">
              <option value="">No owner</option>
              {users.data?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="col-span-2">
            <Textarea value={form.description} onChange={set("description")} name="description" />
          </Field>
          <Field label="Start date" error={errors.startDate}>
            <Input type="date" value={form.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="Deadline" error={errors.deadline}>
            <Input type="date" value={form.deadline} onChange={set("deadline")} min={form.startDate || undefined} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="feature-form" disabled={save.isPending} data-testid="feature-form-submit">{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeaturesPanel({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const features = useFeatures(productId);
  const setParams = useSetParams();
  const [editing, setEditing] = useState<FeatureSummary | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<FeatureSummary | null>(null);
  const remove = useApiMutation((id: string) => api.del(`/features/${id}`), { success: "Feature deleted", onSuccess: () => setDeleting(null) });

  const groups = useMemo(() => {
    const m = new Map<string, FeatureSummary[]>();
    for (const f of features.data ?? []) m.set(f.category, [...(m.get(f.category) ?? []), f]);
    return [...m];
  }, [features.data]);
  const categories = useMemo(() => [...new Set([...groups.map(([c]) => c), ...DEFAULT_CATEGORIES])], [groups]);

  if (features.isLoading) return <div className="flex flex-col gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (features.error) return <ErrorState error={features.error} onRetry={features.refetch} />;

  return (
    <div className="flex flex-col gap-4" data-testid="features-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{features.data?.length ?? 0} features in {groups.length} categories</span>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setEditing(null)} data-testid="new-feature"><Plus /> New feature</Button>}
      </div>
      {!groups.length && <EmptyState title="No features yet" description="Break the product into features, then add tasks to each one." />}
      {groups.map(([category, list]) => {
        const total = list.reduce((s, f) => s + f.taskCount, 0);
        const done = list.reduce((s, f) => s + f.completedCount, 0);
        return (
          <Card key={category} className="overflow-hidden" data-testid={`feature-group-${category}`}>
            <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2">
              <span className="text-[13px] font-semibold">{category}</span>
              <span className="text-xs text-zinc-500">{list.length} features · {done}/{total} tasks</span>
              <div className="ml-auto flex w-40 items-center gap-2"><Progress value={total ? Math.round((100 * done) / total) : 0} /><span className="w-8 text-right text-xs tabular-nums">{total ? Math.round((100 * done) / total) : 0}%</span></div>
            </div>
            <ul>
              {list.map((f) => (
                <li
                  key={f.id}
                  className="flex cursor-pointer items-center gap-4 border-b border-zinc-50 px-4 py-2.5 last:border-0 hover:bg-zinc-50"
                  onClick={() => setParams({ tab: "tasks", feature: f.id, view: null })}
                  data-testid="feature-row"
                  data-feature-id={f.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-zinc-900">{f.name}</div>
                    {f.description && <div className="truncate text-xs text-zinc-500">{f.description}</div>}
                  </div>
                  <div className="flex w-32 items-center gap-1.5 text-xs text-zinc-600 max-md:hidden">
                    {f.owner ? <><Avatar name={f.owner.name} color={f.owner.avatarColor} size={18} /><span className="truncate">{f.owner.name}</span></> : <span className="text-zinc-400">No owner</span>}
                  </div>
                  <span className="w-24 text-xs tabular-nums text-zinc-500 max-lg:hidden">{fmtDate(f.deadline)}</span>
                  <span className="w-20 text-xs tabular-nums text-zinc-500">{f.completedCount}/{f.taskCount} tasks</span>
                  <span className="w-16 text-xs">{f.overdueCount > 0 && <span className="flex items-center gap-1 font-medium text-red-600"><AlertTriangle className="size-3" />{f.overdueCount}</span>}</span>
                  <div className="flex w-32 items-center gap-2"><Progress value={f.progress} /><span className="w-8 text-right text-xs tabular-nums" data-testid="feature-progress">{f.progress}%</span></div>
                  <div className="w-8" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${f.name}`} data-testid="feature-actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setEditing(f)}><Pencil /> Edit</DropdownMenuItem>
                          <DropdownMenuItem destructive onSelect={() => setDeleting(f)} data-testid="feature-delete"><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <FeatureFormDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} productId={productId} feature={editing ?? null} categories={categories} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete feature "${deleting?.name}"?`}
        description={
          <span data-testid="feature-delete-warning">
            {deleting?.taskCount
              ? <>This feature has <b>{deleting.taskCount} task{deleting.taskCount > 1 ? "s" : ""}</b> ({deleting.completedCount} completed). They will be permanently deleted together with their checklists, comments and attachments.</>
              : "This feature has no tasks."}
          </span>
        }
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        pending={remove.isPending}
      />
    </div>
  );
}
