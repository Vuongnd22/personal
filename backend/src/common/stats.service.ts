import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from './config/app-config';
import { formatDateOnly } from './clock/today';
import { partition, progressPercent, TaskLite } from './domain';

export interface Counts {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  progress: number;
}

export interface LiteTask extends TaskLite {
  id: string;
  featureId: string;
  productId: string;
  assigneeId: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export const EMPTY_COUNTS: Counts = { taskCount: 0, completedCount: 0, overdueCount: 0, progress: 0 };

/** All progress/count numbers come from here so every screen agrees (spec §3.3). */
@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private appConfig: AppConfigService,
  ) {}

  // ponytail: loads matching task rows and aggregates in memory; switch to SQL GROUP BY if task counts reach ~100k.
  async liteTasks(where: Prisma.TaskWhereInput = {}): Promise<LiteTask[]> {
    const rows = await this.prisma.task.findMany({
      where,
      select: {
        id: true, featureId: true, status: true, deadline: true, completedLate: true,
        assigneeId: true, completedAt: true, createdAt: true, feature: { select: { productId: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      featureId: r.featureId,
      productId: r.feature.productId,
      status: r.status as TaskStatus,
      deadline: formatDateOnly(r.deadline),
      completedLate: r.completedLate,
      assigneeId: r.assigneeId,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }));
  }

  countsOf(tasks: TaskLite[]): Counts {
    const p = partition(tasks, this.appConfig.today());
    return { taskCount: p.total, completedCount: p.completed, overdueCount: p.overdue, progress: progressPercent(p.completed, p.total) };
  }

  /** Counts grouped by a key (productId / featureId); keys with no tasks are absent — use EMPTY_COUNTS. */
  countsBy(tasks: LiteTask[], key: 'productId' | 'featureId'): Map<string, Counts> {
    const groups = new Map<string, LiteTask[]>();
    for (const t of tasks) {
      const k = t[key];
      const list = groups.get(k);
      if (list) list.push(t);
      else groups.set(k, [t]);
    }
    return new Map([...groups].map(([k, list]) => [k, this.countsOf(list)]));
  }
}
