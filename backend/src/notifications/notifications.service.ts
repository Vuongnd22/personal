import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/app-config';
import { parseDateOnly } from '../common/clock/today';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  productId?: string;
}

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private appConfig: AppConfigService,
  ) {}

  async notify(input: NotifyInput) {
    await this.prisma.notification.create({ data: { ...input, body: input.body ?? '' } });
  }

  async list(userId: string, unreadOnly: boolean) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items: items.map((n) => ({
        id: n.id, type: n.type, title: n.title, body: n.body, taskId: n.taskId, productId: n.productId,
        readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  async markRead(id: string, userId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (count === 0) throw new NotFoundException('Notification not found');
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV !== 'test') void this.notifyOverdue();
  }

  /** Once per task: notify the assignee (or creator) when it becomes overdue (spec §6.5). */
  @Cron(CronExpression.EVERY_HOUR)
  async notifyOverdue(): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { status: { not: 'COMPLETED' }, deadline: { lt: parseDateOnly(this.appConfig.today()) }, overdueNotifiedAt: null },
      include: { feature: true },
    });
    for (const t of tasks) {
      await this.prisma.$transaction([
        this.prisma.notification.create({
          data: {
            userId: t.assigneeId ?? t.creatorId,
            type: 'TASK_OVERDUE',
            title: `Overdue: ${t.title}`,
            body: `Deadline was ${t.deadline?.toISOString().slice(0, 10)}`,
            taskId: t.id,
            productId: t.feature.productId,
          },
        }),
        this.prisma.task.update({ where: { id: t.id }, data: { overdueNotifiedAt: new Date() } }),
      ]);
    }
    if (tasks.length) this.logger.log(`Sent ${tasks.length} overdue notification(s)`);
    return tasks.length;
  }
}
