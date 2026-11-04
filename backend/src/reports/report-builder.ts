// Pure report assembly (spec §6.4). All dates are local "YYYY-MM-DD" strings.
import { monthKey, onTimeRate, partition, progressPercent, TaskLite, weekStart } from '../common/domain';

export type Granularity = 'week' | 'month';

export interface ReportTask extends TaskLite {
  id: string;
  featureId: string;
  productId: string;
  assigneeId: string | null;
  completedOn: string | null;
  createdOn: string;
}

export interface ReportInput {
  tasks: ReportTask[];
  products: { id: string; name: string }[];
  features: { id: string; name: string; category: string; productId: string; productName: string }[];
  users: { id: string; name: string }[];
  from?: string;
  to?: string;
  granularity: Granularity;
  today: string;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export const periodKey = (date: string, g: Granularity) => (g === 'week' ? weekStart(date) : monthKey(date));

export function periodsBetween(from: string, to: string, g: Granularity): string[] {
  const out: string[] = [];
  if (g === 'week') for (let p = weekStart(from); p <= to; p = addDays(p, 7)) out.push(p);
  else for (let p = monthKey(from); p <= monthKey(to); p = addMonths(p, 1)) out.push(p);
  return out;
}

/** Explicit range from the query, or the last 12 weeks/months ending today. */
export function resolveRange(from: string | undefined, to: string | undefined, g: Granularity, today: string) {
  if (from || to) return { from: from ?? '1970-01-01', to: to ?? today, explicit: true };
  const start = g === 'week' ? addDays(weekStart(today), -7 * 11) : `${addMonths(monthKey(today), -11)}-01`;
  return { from: start, to: today, explicit: false };
}

function group<T>(items: T[], key: (t: T) => string | null): Map<string | null, T[]> {
  const m = new Map<string | null, T[]>();
  for (const it of items) {
    const k = key(it);
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

export function buildReport(input: ReportInput) {
  const { today, granularity } = input;
  const range = resolveRange(input.from, input.to, granularity, today);
  const scoped = range.explicit
    ? input.tasks.filter((t) => t.deadline !== null && t.deadline >= range.from && t.deadline <= range.to)
    : input.tasks;

  const p = partition(scoped, today);
  const summary = {
    total: p.total, completed: p.completed, open: p.total - p.completed, overdue: p.overdue,
    completedLate: p.completedLate, completedOnTime: p.completedOnTime, onTimeRate: onTimeRate(p),
  };

  const buckets = new Map(periodsBetween(range.from, range.to, granularity).map((k) => [k, { completed: 0, completedLate: 0 }]));
  for (const t of input.tasks) {
    if (t.status !== 'COMPLETED' || !t.completedOn || t.completedOn < range.from || t.completedOn > range.to) continue;
    const b = buckets.get(periodKey(t.completedOn, granularity));
    if (!b) continue;
    b.completed++;
    if (t.completedLate) b.completedLate++;
  }
  const throughput = [...buckets].map(([period, b]) => ({ period, ...b }));

  const rollup = (tasks: ReportTask[]) => {
    const q = partition(tasks, today);
    return { total: q.total, completed: q.completed, overdue: q.overdue, progress: progressPercent(q.completed, q.total) };
  };
  const byProduct = group(scoped, (t) => t.productId);
  const byFeature = group(scoped, (t) => t.featureId);
  const byUser = group(scoped, (t) => t.assigneeId);

  const products = input.products.map((pr) => ({ productId: pr.id, name: pr.name, ...rollup(byProduct.get(pr.id) ?? []) }));
  const features = input.features.map((f) => ({
    featureId: f.id, name: f.name, category: f.category, productId: f.productId, productName: f.productName,
    ...rollup(byFeature.get(f.id) ?? []),
  }));

  const workloadRow = (userId: string | null, name: string, tasks: ReportTask[]) => {
    const q = partition(tasks, today);
    return { userId, name, total: q.total, open: q.total - q.completed, completed: q.completed, overdue: q.overdue, completedLate: q.completedLate };
  };
  const workload = input.users
    .filter((u) => byUser.has(u.id))
    .map((u) => workloadRow(u.id, u.name, byUser.get(u.id)!));
  if (byUser.has(null)) workload.push(workloadRow(null, 'Unassigned', byUser.get(null)!));

  return { range: { from: range.from, to: range.to }, summary, throughput, products, features, workload };
}

export type Report = ReturnType<typeof buildReport>;
