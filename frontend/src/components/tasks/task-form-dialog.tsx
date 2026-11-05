"use client";

import { useState } from "react";
import { api, fieldErrors, useApiMutation, useFeatures, useProducts, useUsers } from "@/lib/queries";
import { PRIORITIES, PRIORITY_META, STATUS_META, TASK_STATUSES } from "@/lib/format";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string;
  featureId?: string;
  defaultStatus?: TaskStatus;
  onCreated?: (task: Task) => void;
}

export function TaskFormDialog(props: Props) {
  // Remount (not an effect) whenever the dialog reopens, so the form always starts fresh.
  return props.open ? <TaskForm key={`${props.productId ?? ""}:${props.featureId ?? ""}:${props.defaultStatus ?? ""}`} {...props} /> : null;
}

function TaskForm({ open, onOpenChange, productId: fixedProduct, featureId: defaultFeature, defaultStatus, onCreated }: Props) {
  const [productId, setProductId] = useState(fixedProduct ?? "");
  const [form, setForm] = useState(() => ({ featureId: defaultFeature ?? "", title: "", description: "", assigneeId: "", startDate: "", deadline: "", priority: "MEDIUM" as TaskPriority, status: defaultStatus ?? ("TODO" as TaskStatus) }));
  const products = useProducts({ sort: "name", order: "asc" });
  const features = useFeatures(productId);
  const users = useUsers();

  const create = useApiMutation(
    () =>
      api.post<Task>("/tasks", {
        featureId: form.featureId,
        title: form.title,
        description: form.description,
        assigneeId: form.assigneeId || undefined,
        startDate: form.startDate || undefined,
        deadline: form.deadline || undefined,
        priority: form.priority,
        status: form.status,
      }),
    { success: "Task created", onSuccess: (t) => { onOpenChange(false); onCreated?.(t); } },
  );
  const errors = fieldErrors(create.error);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="task-form">
        <DialogHeader title="New task" />
        <form id="task-form" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          {!fixedProduct && (
            <Field label="Product" className="col-span-2">
              <Select value={productId} onChange={(e) => { setProductId(e.target.value); setForm({ ...form, featureId: "" }); }} required name="productId">
                <option value="">Select a product…</option>
                {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Feature" error={errors.featureId} className="col-span-2">
            <Select value={form.featureId} onChange={set("featureId")} required disabled={!productId} name="featureId">
              <option value="">Select a feature…</option>
              {features.data?.map((f) => <option key={f.id} value={f.id}>{f.category} · {f.name}</option>)}
            </Select>
          </Field>
          <Field label="Title" error={errors.title} className="col-span-2">
            <Input value={form.title} onChange={set("title")} required autoFocus name="title" />
          </Field>
          <Field label="Description" className="col-span-2">
            <Textarea value={form.description} onChange={set("description")} name="description" />
          </Field>
          <Field label="Assignee">
            <Select value={form.assigneeId} onChange={set("assigneeId")} name="assigneeId">
              <option value="">Unassigned</option>
              {users.data?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={set("priority")} name="priority">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </Select>
          </Field>
          <Field label="Start date" error={errors.startDate}>
            <Input type="date" value={form.startDate} onChange={set("startDate")} name="startDate" />
          </Field>
          <Field label="Deadline" error={errors.deadline}>
            <Input type="date" value={form.deadline} onChange={set("deadline")} min={form.startDate || undefined} name="deadline" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")} name="status">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form" disabled={create.isPending} data-testid="task-form-submit">
            {create.isPending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
