// Pure domain rules (docs/spec.md §3, §4, §6.2). Dates are "YYYY-MM-DD" strings; "today" is passed in.
import { Role, TaskStatus } from '@prisma/client';

export type EffectiveStatus = TaskStatus | 'OVERDUE';

export function isOverdue(status: TaskStatus, deadline: string | null, today: string): boolean {
  return status !== 'COMPLETED' && deadline !== null && deadline < today;
}

export function effectiveStatus(status: TaskStatus, deadline: string | null, today: string): EffectiveStatus {
  return isOverdue(status, deadline, today) ? 'OVERDUE' : status;
}

/** Fields to write when a task's status changes. completedLate is frozen at completion time. */
export function completionPatch(
  prev: TaskStatus,
  next: TaskStatus,
  deadline: string | null,
  today: string,
  now: Date,
): { completedAt?: Date | null; completedLate?: boolean } {
  if (prev === next) return {};
  if (next === 'COMPLETED') return { completedAt: now, completedLate: deadline !== null && today > deadline };
  if (prev === 'COMPLETED') return { completedAt: null, completedLate: false };
  return {};
}

export interface TaskLite {
  status: TaskStatus;
  deadline: string | null;
  completedLate: boolean;
}

export interface Partition {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
  overdue: number;
  completedLate: number;
  completedOnTime: number;
  completedWithDeadline: number;
}

/** Disjoint status buckets (an open overdue task counts only as overdue). */
export function partition(tasks: TaskLite[], today: string): Partition {
  const p: Partition = {
    total: 0, todo: 0, inProgress: 0, review: 0, completed: 0, overdue: 0,
    completedLate: 0, completedOnTime: 0, completedWithDeadline: 0,
  };
  for (const t of tasks) {
    p.total++;
    if (t.status === 'COMPLETED') {
      p.completed++;
      if (t.completedLate) p.completedLate++;
      if (t.deadline !== null) {
        p.completedWithDeadline++;
        if (!t.completedLate) p.completedOnTime++;
      }
    } else if (isOverdue(t.status, t.deadline, today)) p.overdue++;
    else if (t.status === 'TODO') p.todo++;
    else if (t.status === 'IN_PROGRESS') p.inProgress++;
    else p.review++;
  }
  return p;
}

export function onTimeRate(p: Partition): number | null {
  const due = p.completedWithDeadline + p.overdue;
  return due === 0 ? null : p.completedOnTime / due;
}

export function progressPercent(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((100 * completed) / total);
}

/** Monday of the ISO week containing the date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

interface Actor {
  id: string;
  role: Role;
}
interface TaskOwnership {
  creatorId: string;
  assigneeId: string | null;
}

const ASSIGNEE_FIELDS = new Set(['status', 'sortOrder']);
const isManager = (a: Actor) => a.role === 'ADMIN' || a.role === 'MANAGER';

export function canUpdateTaskFields(actor: Actor, task: TaskOwnership, fields: string[]): boolean {
  if (isManager(actor) || task.creatorId === actor.id) return true;
  return task.assigneeId === actor.id && fields.every((f) => ASSIGNEE_FIELDS.has(f));
}

export function canDeleteTask(actor: Actor, task: TaskOwnership): boolean {
  return isManager(actor) || task.creatorId === actor.id;
}

/** Checklist edits and attachment uploads: managers, creator, assignee. */
export function canEditChecklist(actor: Actor, task: TaskOwnership): boolean {
  return isManager(actor) || task.creatorId === actor.id || task.assigneeId === actor.id;
}

export interface DiagramShape {
  nodes: { id: string; kind: 'PRODUCT' | 'MODULE' | 'NOTE'; refProductId: string | null; isCenter: boolean }[];
  connections: { id: string; sourceNodeId: string; targetNodeId: string }[];
}

/** Structural checks for a diagram PUT; existence of referenced products/features is checked against the DB. */
export function validateDiagram(d: DiagramShape): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const refs = new Set<string>();
  let centers = 0;
  for (const n of d.nodes) {
    if (ids.has(n.id)) errors.push(`Duplicate node id ${n.id}`);
    ids.add(n.id);
    if (n.isCenter) centers++;
    if (n.kind === 'PRODUCT') {
      if (!n.refProductId) errors.push(`Node ${n.id}: PRODUCT node requires refProductId`);
      else if (refs.has(n.refProductId)) errors.push(`Product ${n.refProductId} appears more than once`);
      else refs.add(n.refProductId);
    }
  }
  if (centers > 1) errors.push('Diagram has more than one center node');
  const edgeIds = new Set<string>();
  for (const c of d.connections) {
    if (edgeIds.has(c.id)) errors.push(`Duplicate connection id ${c.id}`);
    edgeIds.add(c.id);
    if (!ids.has(c.sourceNodeId) || !ids.has(c.targetNodeId)) errors.push(`Connection ${c.id} references an unknown node`);
    if (c.sourceNodeId === c.targetNodeId) errors.push(`Connection ${c.id} is a self-loop`);
  }
  return errors;
}
