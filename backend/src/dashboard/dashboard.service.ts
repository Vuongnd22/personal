import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../common/stats.service';
import { AppConfigService } from '../common/config/app-config';
import { formatDateInTimezone } from '../common/clock/today';
import { partition } from '../common/domain';
import { periodKey, periodsBetween, resolveRange } from '../reports/report-builder';
import { ProductsService } from '../products/products.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
    private appConfig: AppConfigService,
    private products: ProductsService,
  ) {}

  async get() {
    const today = this.appConfig.today();
    const tz = this.appConfig.timezone;
    const [products, features, tasks] = await Promise.all([
      this.products.findAll({ sort: 'updated', order: 'desc' }),
      this.prisma.feature.count(),
      this.stats.liteTasks(),
    ]);
    const p = partition(tasks, today);

    const { from } = resolveRange(undefined, undefined, 'week', today);
    const trend = new Map(periodsBetween(from, today, 'week').map((w) => [w, { created: 0, completed: 0, completedLate: 0 }]));
    const weekOf = (d: Date) => trend.get(periodKey(formatDateInTimezone(d, tz), 'week'));
    for (const t of tasks) {
      const created = weekOf(t.createdAt);
      if (created) created.created++;
      if (t.status === 'COMPLETED' && t.completedAt) {
        const done = weekOf(t.completedAt);
        if (done) {
          done.completed++;
          if (t.completedLate) done.completedLate++;
        }
      }
    }

    return {
      totals: {
        products: products.length, features, tasks: p.total,
        todo: p.todo, inProgress: p.inProgress, review: p.review, completed: p.completed, overdue: p.overdue,
      },
      statusDistribution: [
        { status: 'TODO', count: p.todo },
        { status: 'IN_PROGRESS', count: p.inProgress },
        { status: 'REVIEW', count: p.review },
        { status: 'COMPLETED', count: p.completed },
        { status: 'OVERDUE', count: p.overdue },
      ],
      completionTrend: [...trend].map(([weekStart, b]) => ({ weekStart, ...b })),
      productProgress: products.map((pr) => ({
        productId: pr.id, name: pr.name, color: pr.color, progress: pr.progress, taskCount: pr.taskCount, overdueCount: pr.overdueCount,
      })),
      products,
    };
  }
}
