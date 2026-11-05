"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Columns3, GanttChart, List, MessageSquare, Paperclip, Plus, X,
} from "lucide-react";
import { api, useApiMutation, useFeatures, useMe, useProducts, useTasks, useUsers } from "@/lib/queries";
import { canManage, fmtDate, fmtShortDate, PRIORITIES, PRIORITY_META, STATUS_META, TASK_STATUSES, todayLocal } from "@/lib/format";
import { parseFilterState, type TaskView } from "@/lib/tasks/filter-state";
import { computeTimelineLayout, dayWidthForZoom, type TimelineZoom } from "@/lib/tasks/timeline";
import { buildCalendarMonth, bucketTasksByDeadline } from "@/lib/tasks/calendar";
import { useOpenTask, useSetParams } from "@/lib/url";
import type { Task, TasksQuery, TaskStatus, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/overlay";
import { PriorityBadge, TaskFlags } from "./task-bits";
import { TaskFormDialog } from "./task-form-dialog";

type Scope = "all" | "my" | "overdue";
const STATUS_FILTERS = [...TASK_STATUSES, "OVERDUE"] as const;

const canWork = (t: Task, me?: User) => !!me && (canManage(me) || t.creator.id === me.id || t.assignee?.id === me.id);

export function TasksWorkspace({ productId, scope = "all" }: { productId?: string; scope?: Scope }) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const filters = parseFilterState(params);
  const view = filters.view;
  const [creating, setCreating] = useState<TaskStatus | null>(null);
  const me = useMe().data;

  const query: TasksQuery = {
    productId: productId ?? filters.productId,
    featureId: filters.featureId,
    assigneeId: scope === "my" ? "me" : filters.assigneeId,
    status: scope === "overdue" ? "OVERDUE" : filters.status?.join(","),
    priority: filters.priority?.join(","),
    overdue: filters.overdueOnly || undefined,
    from: filters.from,
    to: filters.to,
    search: filters.search,
    sort: (params.get("sort") as TasksQuery["sort"]) ?? (view === "kanban" ? "sortOrder" : "deadline"),
    order: (params.get("order") as "asc" | "desc") ?? "asc",
    pageSize: 500,
  };
  const tasks = useTasks(query);

  return (
    <div className="flex flex-col gap-3" data-testid="tasks-workspace">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<TaskView>
          value={view}
          onChange={(v) => setParams({ view: v === "list" ? null : v }, { replace: true })}
          options={[
            { value: "list", label: "List", icon: List },
            { value: "kanban", label: "Kanban", icon: Columns3 },
            { value: "timeline", label: "Timeline", icon: GanttChart },
            { value: "calendar", label: "Calendar", icon: CalendarDays },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-500">{tasks.data ? `${tasks.data.total} task${tasks.data.total === 1 ? "" : "s"}` : ""}</span>
          <Button variant="primary" size="sm" onClick={() => setCreating("TODO")} data-testid="new-task"><Plus /> New task</Button>
        </div>
      </div>
      <FilterBar productId={productId} scope={scope} />

      {tasks.isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={tasks.refetch} />
      ) : !tasks.data?.items.length && view !== "kanban" && view !== "calendar" ? (
        <EmptyState title="No tasks match" description="Try clearing filters, or create a new task." action={<Button variant="outline" size="sm" onClick={() => setCreating("TODO")}><Plus /> New task</Button>} />
      ) : view === "kanban" ? (
        <KanbanView tasks={tasks.data!.items} me={me} onCreate={setCreating} />
      ) : view === "timeline" ? (
        <TimelineView tasks={tasks.data!.items} />
      ) : view === "calendar" ? (
        <CalendarView tasks={tasks.data!.items} />
      ) : (
        <ListView tasks={tasks.data!.items} me={me} showProduct={!productId} />
      )}

      <TaskFormDialog
        open={creating !== null}
        onOpenChange={(o) => !o && setCreating(null)}
        productId={productId}
        featureId={filters.featureId}
        defaultStatus={creating ?? "TODO"}
      />
    </div>
  );
}

function MultiSelect({ label, values, options, onChange, testId }: { label: string; values: string[]; options: { value: string; label: string; color?: string }[]; onChange: (v: string[]) => void; testId?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid={testId} className={cn(values.length && "border-blue-300 bg-blue-50/50")}>
          {label}{values.length ? `: ${values.length}` : ""}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50">
            <Checkbox
              checked={values.includes(o.value)}
              onCheckedChange={(c) => onChange(c ? [...values, o.value] : values.filter((v) => v !== o.value))}
            />
            {o.color && <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />}
            {o.label}
          </label>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterBar({ productId, scope }: { productId?: string; scope: Scope }) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const f = parseFilterState(params);
  const users = useUsers();
  const products = useProducts({ sort: "name", order: "asc" });
  const features = useFeatures(productId ?? f.productId ?? "");
  const [search, setSearch] = useState(f.search ?? "");
  const set = (patch: Record<string, string | null>) => setParams(patch, { replace: true });
  const active = !!(f.featureId || f.assigneeId || f.status?.length || f.priority?.length || f.overdueOnly || f.from || f.to || f.search || (!productId && f.productId));

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="task-filters">
      <form onSubmit={(e) => { e.preventDefault(); set({ search: search.trim() || null }); }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => set({ search: search.trim() || null })} placeholder="Search tasks…" className="h-7 w-48" data-testid="task-search" />
      </form>
      {!productId && (
        <Select value={f.productId ?? ""} onChange={(e) => set({ productId: e.target.value || null, feature: null })} className="h-7 w-40" aria-label="Product filter">
          <option value="">All products</option>
          {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}
      {(productId || f.productId) && (
        <Select value={f.featureId ?? ""} onChange={(e) => set({ feature: e.target.value || null })} className="h-7 w-48" aria-label="Feature filter" data-testid="feature-filter">
          <option value="">All features</option>
          {features.data?.map((ft) => <option key={ft.id} value={ft.id}>{ft.category} · {ft.name}</option>)}
        </Select>
      )}
      {scope !== "my" && (
        <Select value={f.assigneeId ?? ""} onChange={(e) => set({ assigneeId: e.target.value || null })} className="h-7 w-40" aria-label="Assignee filter">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      )}
      {scope !== "overdue" && (
        <MultiSelect
          label="Status"
          testId="status-filter"
          values={f.status ?? []}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))}
          onChange={(v) => set({ status: v.join(",") || null })}
        />
      )}
      <MultiSelect
        label="Priority"
        values={f.priority ?? []}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, color: PRIORITY_META[p].color }))}
        onChange={(v) => set({ priority: v.join(",") || null })}
      />
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        Due
        <Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value || null })} className="h-7 w-34" aria-label="Deadline from" />
        –
        <Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} className="h-7 w-34" aria-label="Deadline to" />
      </div>
      {scope !== "overdue" && (
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Checkbox checked={!!f.overdueOnly} onCheckedChange={(c) => set({ overdueOnly: c ? "true" : null })} data-testid="overdue-only" /> Overdue only
        </label>
      )}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); set({ productId: null, feature: null, assigneeId: null, status: null, priority: null, overdueOnly: null, from: null, to: null, search: null }); }}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}

// ---- List ------------------------------------------------------------------------------------
function SortHeader({ field, children, className }: { field: NonNullable<TasksQuery["sort"]>; children: React.ReactNode; className?: string }) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const sort = params.get("sort") ?? "deadline";
  const order = params.get("order") ?? "asc";
  const activeSort = sort === field;
  return (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button className="inline-flex items-center gap-1 hover:text-zinc-900" onClick={() => setParams({ sort: field, order: activeSort && order === "asc" ? "desc" : "asc" }, { replace: true })}>
        {children}
        {activeSort && (order === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function ListView({ tasks, me, showProduct }: { tasks: Task[]; me?: User; showProduct: boolean }) {
  const openTask = useOpenTask();
  const patch = useApiMutation(({ id, status }: { id: string; status: TaskStatus }) => api.patch(`/tasks/${id}`, { status }));
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[860px] text-[13px]" data-testid="task-list">
        <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500">
          <tr>
            <SortHeader field="title">Task</SortHeader>
            {showProduct && <th className="px-3 py-2 text-left font-medium">Product</th>}
            <th className="px-3 py-2 text-left font-medium">Feature</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <SortHeader field="priority">Priority</SortHeader>
            <th className="px-3 py-2 text-left font-medium">Assignee</th>
            <SortHeader field="deadline">Deadline</SortHeader>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50" onClick={() => openTask(t.id)} data-testid="task-row" data-task-id={t.id}>
              <td className="max-w-[320px] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-900">{t.title}</span>
                  <TaskFlags task={t} />
                </div>
                <div className="mt-0.5 flex gap-2 text-[11px] text-zinc-400">
                  {t.checklist.total > 0 && <span>☑ {t.checklist.done}/{t.checklist.total}</span>}
                  {t.commentCount > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{t.commentCount}</span>}
                  {t.attachmentCount > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" />{t.attachmentCount}</span>}
                </div>
              </td>
              {showProduct && <td className="px-3 py-2 text-zinc-600">{t.product.name}</td>}
              <td className="px-3 py-2 text-zinc-600">{t.feature.name}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={t.status}
                  disabled={!canWork(t, me)}
                  onChange={(e) => patch.mutate({ id: t.id, status: e.target.value as TaskStatus })}
                  className="h-7 w-32 border-transparent bg-transparent hover:border-zinc-200"
                  style={{ color: STATUS_META[t.effectiveStatus].color }}
                  aria-label="Change status"
                  data-testid="row-status-select"
                >
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </Select>
              </td>
              <td className="px-3 py-2"><PriorityBadge priority={t.priority} /></td>
              <td className="px-3 py-2">
                {t.assignee ? <span className="flex items-center gap-1.5"><Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={20} />{t.assignee.name}</span> : <span className="text-zinc-400">Unassigned</span>}
              </td>
              <td className={cn("px-3 py-2 tabular-nums", t.isOverdue ? "font-medium text-red-600" : "text-zinc-600")}>{fmtDate(t.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Kanban ----------------------------------------------------------------------------------
function KanbanCard({ task, draggable }: { task: Task; draggable: boolean }) {
  const openTask = useOpenTask();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !draggable, data: { task } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={() => openTask(task.id)}
      className={cn(
        "flex cursor-pointer flex-col gap-1.5 rounded-md border border-zinc-200 bg-white p-2.5 text-[13px] hover:border-zinc-300",
        isDragging && "z-10 opacity-80 shadow-lg",
        task.isOverdue && "border-l-2 border-l-red-500",
      )}
      data-testid="kanban-card"
      data-task-id={task.id}
    >
      <span className="font-medium leading-snug text-zinc-900">{task.title}</span>
      <span className="text-[11px] text-zinc-500">{task.product.name} · {task.feature.name}</span>
      <div className="flex flex-wrap items-center gap-1">
        <PriorityBadge priority={task.priority} />
        <TaskFlags task={task} />
        <span className={cn("ml-auto text-[11px] tabular-nums", task.isOverdue ? "text-red-600" : "text-zinc-500")}>{fmtShortDate(task.deadline)}</span>
        {task.assignee && <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={18} />}
      </div>
    </div>
  );
}

function KanbanColumn({ id, title, color, tasks, me, onCreate }: { id: string; title: string; color: string; tasks: Task[]; me?: User; onCreate?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-zinc-100/70 p-2", isOver && "bg-blue-50 ring-1 ring-blue-200")} data-testid={`kanban-column-${id}`}>
      <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-600">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {title}
        <span className="font-normal text-zinc-400">{tasks.length}</span>
        {onCreate && <button className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-white hover:text-zinc-700" onClick={onCreate} aria-label={`Add task to ${title}`}><Plus className="size-3.5" /></button>}
      </div>
      <div className="flex min-h-16 flex-col gap-2">
        {tasks.map((t) => <KanbanCard key={t.id} task={t} draggable={canWork(t, me)} />)}
      </div>
    </div>
  );
}

function KanbanView({ tasks, me, onCreate }: { tasks: Task[]; me?: User; onCreate: (s: TaskStatus) => void }) {
  const [groupOverdue, setGroupOverdue] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const move = useApiMutation(({ id, status, sortOrder }: { id: string; status: TaskStatus; sortOrder: number }) => api.patch(`/tasks/${id}`, { status, sortOrder }));
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s && !(groupOverdue && t.isOverdue));
  const overdue = tasks.filter((t) => t.isOverdue);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const task = active.data.current?.task as Task | undefined;
    const status = over?.id as TaskStatus | "OVERDUE" | undefined;
    if (!task || !status || status === "OVERDUE" || status === task.status) return;
    // ponytail: cards go to the end of the target column; within-column reordering is not supported.
    const maxOrder = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.sortOrder));
    move.mutate({ id: task.id, status, sortOrder: maxOrder + 1 });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 self-end text-xs text-zinc-600">
        <Checkbox checked={groupOverdue} onCheckedChange={(c) => setGroupOverdue(c === true)} /> Show overdue lane
      </label>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {groupOverdue && <KanbanColumn id="OVERDUE" title="Overdue" color={STATUS_META.OVERDUE.color} tasks={overdue} me={me} />}
          {TASK_STATUSES.map((s) => (
            <KanbanColumn key={s} id={s} title={STATUS_META[s].label} color={STATUS_META[s].color} tasks={byStatus(s)} me={me} onCreate={() => onCreate(s)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

// ---- Timeline --------------------------------------------------------------------------------
function TimelineView({ tasks }: { tasks: Task[] }) {
  const openTask = useOpenTask();
  const [zoom, setZoom] = useState<TimelineZoom>("week");
  const today = todayLocal();
  const layout = useMemo(() => computeTimelineLayout(tasks, today), [tasks, today]);
  const bars = new Map(layout.bars.map((b) => [b.taskId, b]));
  const dw = dayWidthForZoom(zoom);
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) m.set(`${t.product.name} · ${t.feature.name}`, [...(m.get(`${t.product.name} · ${t.feature.name}`) ?? []), t]);
    return [...m];
  }, [tasks]);
  const start = new Date(`${layout.rangeStart}T00:00:00Z`);
  const days = Array.from({ length: layout.totalDays }, (_, i) => new Date(start.getTime() + i * 86_400_000));
  const width = layout.totalDays * dw;

  return (
    <div className="flex flex-col gap-2" data-testid="timeline-view">
      <div className="flex items-center gap-2 self-end text-xs text-zinc-500">
        Zoom <Segmented<TimelineZoom> value={zoom} onChange={setZoom} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="flex" style={{ minWidth: 260 + width }}>
          <div className="w-[260px] shrink-0 border-r border-zinc-200">
            <div className="h-8 border-b border-zinc-200 px-3 text-xs leading-8 text-zinc-500">Task</div>
            {groups.map(([g, ts]) => (
              <div key={g}>
                <div className="h-7 truncate bg-zinc-50 px-3 text-[11px] font-semibold leading-7 text-zinc-600">{g}</div>
                {ts.map((t) => <button key={t.id} onClick={() => openTask(t.id)} className="block h-8 w-full truncate px-3 text-left text-[13px] hover:bg-zinc-50">{t.title}</button>)}
              </div>
            ))}
          </div>
          <div className="relative" style={{ width }}>
            <div className="flex h-8 border-b border-zinc-200">
              {days.map((d, i) => {
                const iso = d.toISOString().slice(0, 10);
                const show = zoom === "day" || d.getUTCDay() === 1 || i === 0;
                return (
                  <div key={iso} className={cn("shrink-0 border-r border-zinc-100 text-[10px] text-zinc-400", d.getUTCDate() === 1 && "border-zinc-300")} style={{ width: dw }}>
                    {show && <span className="block truncate px-0.5 leading-8">{zoom === "day" ? d.getUTCDate() : fmtShortDate(iso)}</span>}
                  </div>
                );
              })}
            </div>
            {layout.todayOffset !== null && <div className="absolute bottom-0 top-0 z-10 w-px bg-red-500" style={{ left: layout.todayOffset * dw + dw / 2 }} title="Today" />}
            {groups.map(([g, ts]) => (
              <div key={g}>
                <div className="h-7 bg-zinc-50" />
                {ts.map((t) => {
                  const b = bars.get(t.id)!;
                  const color = t.isOverdue ? STATUS_META.OVERDUE.color : STATUS_META[t.status].color;
                  return (
                    <div key={t.id} className="relative h-8 border-b border-zinc-50">
                      <button
                        onClick={() => openTask(t.id)}
                        className="absolute top-1.5 h-5 rounded text-left text-[10px] font-medium text-white hover:opacity-90"
                        style={{ left: b.startOffset * dw, width: Math.max(b.span * dw, 6), backgroundColor: color, outline: t.completedLate ? "2px solid #ea580c" : undefined }}
                        title={`${t.title}: ${fmtDate(t.startDate ?? t.createdAt)} → ${fmtDate(t.deadline)}`}
                        data-testid="timeline-bar"
                      >
                        {b.span * dw > 60 && <span className="block truncate px-1.5 leading-5">{t.title}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-zinc-400">Bars run from start date (or creation) to deadline. Red line = today; red bars = overdue; orange outline = completed late.</p>
    </div>
  );
}

// ---- Calendar --------------------------------------------------------------------------------
function CalendarView({ tasks }: { tasks: Task[] }) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const openTask = useOpenTask();
  const today = todayLocal();
  const month = params.get("month") ?? today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const cal = buildCalendarMonth(y, m, today);
  const buckets = bucketTasksByDeadline(tasks);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setParams({ month: d.toISOString().slice(0, 7) }, { replace: true });
  };
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-2" data-testid="calendar-view">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft /></Button>
        <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight /></Button>
        <Button variant="outline" size="sm" onClick={() => setParams({ month: null }, { replace: true })}>Today</Button>
        <span className="ml-2 text-[13px] font-semibold" data-testid="calendar-month">{label}</span>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-zinc-200 bg-white text-[12px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-500">{d}</div>)}
        {cal.weeks.flat().map((day) => {
          const items = buckets.get(day.date) ?? [];
          return (
            <div key={day.date} className={cn("min-h-24 border-b border-r border-zinc-100 p-1", !day.isCurrentMonth && "bg-zinc-50/60 text-zinc-400")} data-testid={`calendar-day-${day.date}`}>
              <div className={cn("mb-1 flex size-5 items-center justify-center rounded-full text-[11px]", day.isToday && "bg-blue-600 font-semibold text-white")}>{Number(day.date.slice(8))}</div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTask(t.id)}
                    className="truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                    style={{ backgroundColor: `${t.isOverdue ? STATUS_META.OVERDUE.color : STATUS_META[t.status].color}18`, color: t.isOverdue ? STATUS_META.OVERDUE.color : STATUS_META[t.status].color }}
                    title={t.title}
                    data-testid="calendar-task"
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 4 && <span className="px-1 text-[10px] text-zinc-500">+{items.length - 4} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
