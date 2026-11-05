"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  api, useApiMutation, useAttachments, useComments, useFeatures, useHistory, useMe, useTask, useUsers,
} from "@/lib/queries";
import { apiRequest } from "@/lib/api-client";
import { canManage, fmtAgo, fmtDate, fmtDateTime, fmtSize, PRIORITIES, PRIORITY_META, STATUS_META, TASK_STATUSES } from "@/lib/format";
import { useSetParams } from "@/lib/url";
import type { TaskDetail } from "@/lib/types";
import { Avatar, ErrorState, Progress, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { ProductIcon } from "@/components/product-icon";
import { StatusBadge, TaskFlags } from "./task-bits";

export function TaskSheet() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const taskId = params.get("task");
  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && setParams({ task: null }, { replace: true })} title="Task details">
      {taskId && <TaskDetailView key={taskId} taskId={taskId} onClose={() => setParams({ task: null }, { replace: true })} />}
    </Sheet>
  );
}

function Section({ title, children, action, testId }: { title: string; children: React.ReactNode; action?: React.ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-4" data-testid={testId}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TaskDetailView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, error, refetch, isLoading } = useTask(taskId);
  const me = useMe().data;
  const users = useUsers();
  const features = useFeatures(task?.product.id ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = useApiMutation((body: Record<string, unknown>) => api.patch(`/tasks/${taskId}`, body));
  const remove = useApiMutation(() => api.del(`/tasks/${taskId}`), { success: "Task deleted", onSuccess: onClose });

  if (isLoading) return <div className="flex flex-col gap-3 p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (error || !task) return <div className="p-5"><ErrorState error={error} onRetry={refetch} /></div>;

  const manager = canManage(me);
  const isCreator = task.creator.id === me?.id;
  const isAssignee = task.assignee?.id === me?.id;
  const canEdit = manager || isCreator;
  const canWork = canEdit || isAssignee;
  const canDelete = manager || isCreator;

  return (
    <div className="flex h-full flex-col" data-testid="task-sheet">
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-3">
        <Link href={`/products/${task.product.id}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
          <ProductIcon icon={task.product.icon} color={task.product.color} size={18} />
          {task.product.name} · {task.feature.name}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {canDelete && (
            <Button variant="ghost" size="icon-sm" aria-label="Delete task" onClick={() => setConfirmDelete(true)} data-testid="task-delete">
              <Trash2 className="text-zinc-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 px-5 py-4">
          <EditableTitle value={task.title} disabled={!canEdit} onSave={(title) => patch.mutate({ title })} />
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.effectiveStatus} />
            <TaskFlags task={task} />
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-2 px-5 pb-4 text-[13px]">
          <span className="text-zinc-500">Status</span>
          <Select value={task.status} disabled={!canWork} onChange={(e) => patch.mutate({ status: e.target.value })} className="w-48" data-testid="task-status-select" aria-label="Status">
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
          <span className="text-zinc-500">Priority</span>
          <Select value={task.priority} disabled={!canEdit} onChange={(e) => patch.mutate({ priority: e.target.value })} className="w-48" aria-label="Priority">
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </Select>
          <span className="text-zinc-500">Assignee</span>
          <Select value={task.assignee?.id ?? ""} disabled={!canEdit} onChange={(e) => patch.mutate({ assigneeId: e.target.value || null })} className="w-48" data-testid="task-assignee-select" aria-label="Assignee">
            <option value="">Unassigned</option>
            {users.data?.filter((u) => u.isActive || u.id === task.assignee?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <span className="text-zinc-500">Start date</span>
          <Input type="date" className="w-48" disabled={!canEdit} value={task.startDate ?? ""} onChange={(e) => patch.mutate({ startDate: e.target.value || null })} aria-label="Start date" />
          <span className="text-zinc-500">Deadline</span>
          <Input type="date" className="w-48" disabled={!canEdit} value={task.deadline ?? ""} onChange={(e) => patch.mutate({ deadline: e.target.value || null })} data-testid="task-deadline-input" aria-label="Deadline" />
          <span className="text-zinc-500">Feature</span>
          <Select value={task.feature.id} disabled={!canEdit} onChange={(e) => patch.mutate({ featureId: e.target.value })} className="w-64" aria-label="Feature">
            {(features.data ?? [{ id: task.feature.id, name: task.feature.name, category: task.feature.category }]).map((f) => (
              <option key={f.id} value={f.id}>{f.category} · {f.name}</option>
            ))}
          </Select>
          <span className="text-zinc-500">Created by</span>
          <span className="flex items-center gap-1.5"><Avatar name={task.creator.name} color={task.creator.avatarColor} size={18} /> {task.creator.name} · {fmtDateTime(task.createdAt)}</span>
          {task.completedAt && (
            <>
              <span className="text-zinc-500">Completed</span>
              <span>{fmtDateTime(task.completedAt)}</span>
            </>
          )}
        </div>

        <Section title="Description">
          <EditableDescription value={task.description} disabled={!canEdit} onSave={(description) => patch.mutate({ description })} />
        </Section>
        <Checklist task={task} canEdit={canWork} />
        <Attachments taskId={task.id} canUpload={canWork} myId={me?.id} manager={manager} />
        <Comments taskId={task.id} myId={me?.id} isAdmin={me?.role === "ADMIN"} />
        <History taskId={task.id} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={<>&ldquo;{task.title}&rdquo; and its checklist, comments and attachments will be permanently deleted.</>}
        onConfirm={() => remove.mutate(undefined)}
        pending={remove.isPending}
      />
    </div>
  );
}

function EditableTitle({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  // Draft state resets whenever the saved value changes, via remount (key) instead of a setState-in-effect.
  return <EditableTitleInput key={value} value={value} onSave={onSave} disabled={disabled} />;
}

function EditableTitleInput({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };
  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-full rounded px-1 -mx-1 text-[17px] font-semibold text-zinc-900 outline-none hover:bg-zinc-50 focus:bg-zinc-50 disabled:bg-transparent"
      aria-label="Task title"
      data-testid="task-title-input"
    />
  );
}

function EditableDescription({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  return <EditableDescriptionTextarea key={value} value={value} onSave={onSave} disabled={disabled} />;
}

function EditableDescriptionTextarea({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(value);
  return (
    <Textarea
      value={draft}
      disabled={disabled}
      placeholder={disabled ? "No description" : "Add a description…"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      className="min-h-24"
      aria-label="Description"
    />
  );
}

function Checklist({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const add = useApiMutation((t: string) => api.post(`/tasks/${task.id}/checklist`, { title: t }), { onSuccess: () => setTitle("") });
  const update = useApiMutation(({ id, ...body }: { id: string; title?: string; done?: boolean }) => api.patch(`/checklist/${id}`, body));
  const remove = useApiMutation((id: string) => api.del(`/checklist/${id}`));
  const pct = task.checklist.total ? Math.round((100 * task.checklist.done) / task.checklist.total) : 0;
  return (
    <Section title={`Checklist ${task.checklist.done}/${task.checklist.total}`} testId="task-checklist">
      {task.checklist.total > 0 && <Progress value={pct} />}
      <ul className="flex flex-col">
        {task.checklistItems.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-zinc-50">
            <Checkbox checked={item.done} disabled={!canEdit} onCheckedChange={(v) => update.mutate({ id: item.id, done: v === true })} aria-label={item.title} />
            {editing === item.id ? (
              <Input
                autoFocus
                defaultValue={item.title}
                className="h-7"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.title) update.mutate({ id: item.id, title: v }); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }}
              />
            ) : (
              <span className={item.done ? "flex-1 text-zinc-400 line-through" : "flex-1"}>{item.title}</span>
            )}
            {canEdit && editing !== item.id && (
              <span className="flex opacity-0 group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" aria-label="Rename" onClick={() => setEditing(item.id)}><Pencil className="size-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => remove.mutate(item.id)}><Trash2 className="size-3.5" /></Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(title.trim()); }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item…" data-testid="checklist-input" />
          <Button type="submit" variant="outline" disabled={!title.trim() || add.isPending}><Plus /> Add</Button>
        </form>
      )}
    </Section>
  );
}

function Attachments({ taskId, canUpload, myId, manager }: { taskId: string; canUpload: boolean; myId?: string; manager: boolean }) {
  const { data } = useAttachments(taskId);
  const input = useRef<HTMLInputElement>(null);
  const upload = useApiMutation(
    (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiRequest(`/tasks/${taskId}/attachments`, { method: "POST", body: fd });
    },
    { success: "File uploaded" },
  );
  const remove = useApiMutation((id: string) => api.del(`/attachments/${id}`));
  return (
    <Section
      title={`Attachments ${data?.length ?? ""}`}
      testId="task-attachments"
      action={canUpload && (
        <>
          <input ref={input} type="file" hidden data-testid="attachment-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}><Paperclip /> {upload.isPending ? "Uploading…" : "Upload"}</Button>
        </>
      )}
    >
      {!data?.length && <p className="text-[13px] text-zinc-400">No files</p>}
      <ul className="flex flex-col gap-1">
        {data?.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded border border-zinc-100 px-2 py-1.5 text-[13px]">
            <Paperclip className="size-3.5 text-zinc-400" />
            <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
            <span className="text-xs text-zinc-400">{fmtSize(a.size)} · {a.uploader.name}</span>
            <Button variant="ghost" size="icon-sm" asChild aria-label="Download">
              <a href={`/api/attachments/${a.id}/download`} download><Download className="size-3.5" /></a>
            </Button>
            {(a.uploader.id === myId || manager) && (
              <Button variant="ghost" size="icon-sm" aria-label="Delete attachment" onClick={() => remove.mutate(a.id)}><Trash2 className="size-3.5" /></Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Comments({ taskId, myId, isAdmin }: { taskId: string; myId?: string; isAdmin: boolean }) {
  const { data } = useComments(taskId);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const add = useApiMutation((b: string) => api.post(`/tasks/${taskId}/comments`, { body: b }), { onSuccess: () => setBody("") });
  const update = useApiMutation(({ id, b }: { id: string; b: string }) => api.patch(`/comments/${id}`, { body: b }), { onSuccess: () => setEditing(null) });
  const remove = useApiMutation((id: string) => api.del(`/comments/${id}`));
  return (
    <Section title={`Comments ${data?.length ?? ""}`} testId="task-comments">
      <ul className="flex flex-col gap-3">
        {data?.map((c) => (
          <li key={c.id} className="group flex gap-2">
            <Avatar name={c.author.name} color={c.author.avatarColor} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-zinc-800">{c.author.name}</span>
                <span className="text-zinc-400">{fmtAgo(c.createdAt)}{c.updatedAt !== c.createdAt && " · edited"}</span>
                <span className="ml-auto flex opacity-0 group-hover:opacity-100">
                  {c.author.id === myId && <Button variant="ghost" size="icon-sm" aria-label="Edit comment" onClick={() => setEditing({ id: c.id, body: c.body })}><Pencil className="size-3.5" /></Button>}
                  {(c.author.id === myId || isAdmin) && <Button variant="ghost" size="icon-sm" aria-label="Delete comment" onClick={() => remove.mutate(c.id)}><Trash2 className="size-3.5" /></Button>}
                </span>
              </div>
              {editing?.id === c.id ? (
                <form className="mt-1 flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); if (editing.body.trim()) update.mutate({ id: c.id, b: editing.body.trim() }); }}>
                  <Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="min-h-16" autoFocus />
                  <div className="flex gap-1.5"><Button type="submit" size="sm" variant="primary">Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                </form>
              ) : (
                <p className="whitespace-pre-wrap text-[13px] text-zinc-700">{c.body}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form className="flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(body.trim()); }}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" className="min-h-16" data-testid="comment-input" maxLength={5000} />
        <Button type="submit" size="sm" variant="primary" className="self-end" disabled={!body.trim() || add.isPending} data-testid="comment-submit">Comment</Button>
      </form>
    </Section>
  );
}

const FIELD_LABEL: Record<string, string> = {
  title: "title", description: "description", priority: "priority", startDate: "start date", deadline: "deadline",
  featureId: "feature", assignee: "assignee", status: "status", checklist: "checklist", "checklist.title": "checklist item",
  "checklist.done": "checklist item", attachment: "attachment",
};
const pretty = (field: string | null, v: string | null) => (v && field === "status" ? STATUS_META[v as keyof typeof STATUS_META]?.label ?? v : field === "deadline" || field === "startDate" ? fmtDate(v) : v ?? "—");

function History({ taskId }: { taskId: string }) {
  const { data } = useHistory(taskId);
  return (
    <Section title="History" testId="task-history">
      <ul className="flex flex-col gap-1.5">
        {data?.map((h) => (
          <li key={h.id} className="flex gap-2 text-xs text-zinc-600">
            <span className="w-28 shrink-0 text-zinc-400">{fmtDateTime(h.createdAt)}</span>
            <span>
              <b className="font-medium text-zinc-800">{h.actor.name}</b>{" "}
              {h.action === "CREATED" && "created the task"}
              {h.action === "COMMENTED" && "commented"}
              {h.action === "UPDATED" && <>changed {FIELD_LABEL[h.field ?? ""] ?? h.field} from <i>{pretty(h.field, h.oldValue)}</i> to <i>{pretty(h.field, h.newValue)}</i></>}
              {(h.action === "CHECKLIST" || h.action === "ATTACHMENT") && (
                <>{h.newValue && !h.oldValue ? "added" : !h.newValue ? "removed" : "updated"} {FIELD_LABEL[h.field ?? ""] ?? "item"} <i>{h.newValue && h.oldValue && h.field === "checklist.done" ? (h.newValue === "true" ? "✓ done" : "not done") : h.newValue ?? h.oldValue}</i></>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
