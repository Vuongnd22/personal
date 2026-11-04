import { Task, TaskPriority, TaskStatus } from '@prisma/client';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';
import { ProductRefDto, toProductRef } from '../../products/dto/product-response.dto';
import { formatDateOnly } from '../../common/clock/today';
import { isOverdue } from '../../common/progress/progress';

export interface ChecklistItemDto {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  effectiveStatus: TaskStatus | 'OVERDUE';
  isOverdue: boolean;
  priority: TaskPriority;
  startDate: string | null;
  deadline: string | null;
  completedAt: string | null;
  completedLate: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  feature: { id: string; name: string; category: string };
  product: ProductRefDto;
  assignee: UserRefDto | null;
  creator: UserRefDto;
  checklist: { done: number; total: number };
  commentCount: number;
  attachmentCount: number;
}

export type TaskFull = Task & {
  assignee: Parameters<typeof toUserRef>[0] | null;
  creator: Parameters<typeof toUserRef>[0];
  feature: { id: string; name: string; category: string; product: Parameters<typeof toProductRef>[0] };
  checklistItems: { done: boolean }[];
  _count: { comments: number; attachments: number };
};

export function toTaskDto(task: TaskFull, today: string): TaskDto {
  const overdue = isOverdue(task.status, task.deadline, today);
  const total = task.checklistItems.length;
  const done = task.checklistItems.filter((c) => c.done).length;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    effectiveStatus: overdue ? 'OVERDUE' : task.status,
    isOverdue: overdue,
    priority: task.priority,
    startDate: formatDateOnly(task.startDate),
    deadline: formatDateOnly(task.deadline),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    completedLate: task.completedLate,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    feature: { id: task.feature.id, name: task.feature.name, category: task.feature.category },
    product: toProductRef(task.feature.product),
    assignee: task.assignee ? toUserRef(task.assignee) : null,
    creator: toUserRef(task.creator),
    checklist: { done, total },
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
  };
}

export type TaskDetailFull = TaskFull & {
  checklistItems: { id: string; title: string; done: boolean; sortOrder: number }[];
};

export function toTaskDetailDto(task: TaskDetailFull, today: string): TaskDto & { checklistItems: ChecklistItemDto[] } {
  return {
    ...toTaskDto(task, today),
    checklistItems: task.checklistItems
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, title: c.title, done: c.done, sortOrder: c.sortOrder })),
  };
}
