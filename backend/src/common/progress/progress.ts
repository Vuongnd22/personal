import { TaskStatus } from '@prisma/client';

export interface Counts {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  progress: number;
}

/** Derived effective status: OVERDUE when open and past deadline. */
export function isOverdue(status: TaskStatus, deadline: Date | null, today: string): boolean {
  return status !== 'COMPLETED' && deadline !== null && formatDateOnly(deadline) < today;
}

export function progressPercent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((100 * completed) / total);
}

export function toCounts(
  total: number,
  completed: number,
  overdue: number,
): Counts {
  return {
    taskCount: total,
    completedCount: completed,
    overdueCount: overdue,
    progress: progressPercent(completed, total),
  };
}

export function formatDateOnly(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}