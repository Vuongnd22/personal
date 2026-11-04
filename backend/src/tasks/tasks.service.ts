import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { canDeleteTask, canUpdateTaskFields, completionPatch } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/app-config';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { toTaskDto, toTaskDetailDto, TaskFull, TaskDetailFull, TaskDto } from './dto/task-response.dto';
import { parseDateOnly } from '../common/clock/today';
import { AuthUser } from '../auth/auth.types';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

const TASK_INCLUDE = {
  assignee: true,
  creator: true,
  feature: { include: { product: true } },
  checklistItems: true,
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private appConfig: AppConfigService,
    private notifications: NotificationsService,
  ) {}

  async findAll(query: QueryTasksDto, actor: AuthUser): Promise<PaginatedResult<TaskDto>> {
    const where = await this.buildWhere(query, actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const sortField = query.sort ?? 'sortOrder';
    const order = query.order ?? 'asc';
    const orderBy: Prisma.TaskOrderByWithRelationInput =
      sortField === 'deadline'
        ? { deadline: order }
        : sortField === 'priority'
          ? { priority: order }
          : sortField === 'createdAt'
            ? { createdAt: order }
            : sortField === 'updatedAt'
              ? { updatedAt: order }
              : sortField === 'title'
                ? { title: order }
                : { sortOrder: order };

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    const today = this.appConfig.today();
    return { items: items.map((t) => toTaskDto(t as TaskFull, today)), total };
  }

  async findOne(id: string): Promise<TaskDetailFull extends never ? never : ReturnType<typeof toTaskDetailDto>> {
    const task = await this.prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!task) throw new NotFoundException('Task not found');
    const today = this.appConfig.today();
    return toTaskDetailDto(task as TaskDetailFull, today);
  }

  async create(dto: CreateTaskDto, actor: AuthUser) {
    const feature = await this.prisma.feature.findUnique({ where: { id: dto.featureId } });
    if (!feature) throw new BadRequestException('featureId does not reference an existing feature');

    const status = dto.status ?? 'TODO';
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          featureId: dto.featureId,
          title: dto.title.trim(),
          description: dto.description ?? '',
          assigneeId: dto.assigneeId ?? undefined,
          creatorId: actor.id,
          startDate: dto.startDate ? parseDateOnly(dto.startDate) : undefined,
          deadline: dto.deadline ? parseDateOnly(dto.deadline) : undefined,
          priority: dto.priority,
          status,
          ...completionPatch('TODO', status, dto.deadline ?? null, this.appConfig.today(), new Date()),
        },
        include: TASK_INCLUDE,
      });
      await tx.taskHistory.create({
        data: { taskId: created.id, actorId: actor.id, action: 'CREATED' },
      });
      await tx.product.update({ where: { id: feature.productId }, data: { lastActivityAt: new Date() } });
      return created;
    });

    if (task.assigneeId && task.assigneeId !== actor.id) {
      await this.notifications.notify({
        userId: task.assigneeId,
        type: 'TASK_ASSIGNED',
        title: `You were assigned: ${task.title}`,
        taskId: task.id,
        productId: feature.productId,
      });
    }

    const today = this.appConfig.today();
    return toTaskDto(task as TaskFull, today);
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthUser) {
    const existing = await this.prisma.task.findUnique({ where: { id }, include: { feature: true } });
    if (!existing) throw new NotFoundException('Task not found');
    const fields = Object.entries(dto).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (!canUpdateTaskFields(actor, existing, fields)) {
      throw new ForbiddenException('You can only change the status of tasks assigned to you, or edit tasks you created');
    }

    if (dto.featureId && dto.featureId !== existing.featureId) {
      const newFeature = await this.prisma.feature.findUnique({ where: { id: dto.featureId } });
      if (!newFeature || newFeature.productId !== existing.feature.productId) {
        throw new BadRequestException('featureId must reference a feature of the same product');
      }
    }

    const today = this.appConfig.today();
    const data: Prisma.TaskUpdateInput = {};
    const historyEntries: Prisma.TaskHistoryCreateManyInput[] = [];

    if (dto.title !== undefined && dto.title !== existing.title) {
      data.title = dto.title;
      historyEntries.push(this.historyRow(id, actor, 'title', existing.title, dto.title));
    }
    if (dto.description !== undefined && dto.description !== existing.description) {
      data.description = dto.description;
      historyEntries.push(this.historyRow(id, actor, 'description', existing.description, dto.description));
    }
    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      data.priority = dto.priority;
      historyEntries.push(this.historyRow(id, actor, 'priority', existing.priority, dto.priority));
    }
    if (dto.startDate !== undefined) {
      const next = dto.startDate ? parseDateOnly(dto.startDate) : null;
      data.startDate = next;
      historyEntries.push(this.historyRow(id, actor, 'startDate', fmtD(existing.startDate), fmtD(next)));
    }
    let deadlineChanged = false;
    if (dto.deadline !== undefined) {
      const next = dto.deadline ? parseDateOnly(dto.deadline) : null;
      data.deadline = next;
      data.overdueNotifiedAt = null;
      deadlineChanged = true;
      historyEntries.push(this.historyRow(id, actor, 'deadline', fmtD(existing.deadline), fmtD(next)));
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.featureId !== undefined && dto.featureId !== existing.featureId) {
      data.feature = { connect: { id: dto.featureId } };
      historyEntries.push(this.historyRow(id, actor, 'featureId', existing.featureId, dto.featureId));
    }

    let assigneeChanged = false;
    let newAssigneeId: string | null | undefined;
    if (dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId) {
      const oldName = existing.assigneeId
        ? (await this.prisma.user.findUnique({ where: { id: existing.assigneeId } }))?.name ?? null
        : null;
      const newName = dto.assigneeId
        ? (await this.prisma.user.findUniqueOrThrow({ where: { id: dto.assigneeId } })).name
        : null;
      data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
      historyEntries.push(this.historyRow(id, actor, 'assignee', oldName, newName));
      assigneeChanged = true;
      newAssigneeId = dto.assigneeId ?? null;
    }

    let statusChanged = false;
    if (dto.status !== undefined && dto.status !== existing.status) {
      statusChanged = true;
      data.status = dto.status;
      historyEntries.push(this.historyRow(id, actor, 'status', existing.status, dto.status));
      const deadline = dto.deadline !== undefined ? dto.deadline : fmtD(existing.deadline);
      Object.assign(data, completionPatch(existing.status, dto.status, deadline, today, new Date()));
    }

    if (Object.keys(data).length === 0) return this.findOne(id); // nothing actually changed

    const updated = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({ where: { id }, data, include: TASK_INCLUDE });
      if (historyEntries.length > 0) {
        await tx.taskHistory.createMany({ data: historyEntries });
      }
      await tx.product.update({ where: { id: existing.feature.productId }, data: { lastActivityAt: new Date() } });
      return task;
    });

    if (assigneeChanged && newAssigneeId && newAssigneeId !== actor.id) {
      await this.notifications.notify({
        userId: newAssigneeId,
        type: 'TASK_ASSIGNED',
        title: `You were assigned: ${updated.title}`,
        taskId: updated.id,
        productId: existing.feature.productId,
      });
    }
    if (statusChanged) {
      const notifyIds = new Set<string>();
      if (updated.creatorId !== actor.id) notifyIds.add(updated.creatorId);
      if (updated.assigneeId && updated.assigneeId !== actor.id) notifyIds.add(updated.assigneeId);
      for (const userId of notifyIds) {
        await this.notifications.notify({
          userId,
          type: 'TASK_STATUS_CHANGED',
          title: `Status changed: ${updated.title}`,
          body: `New status: ${updated.status}`,
          taskId: updated.id,
          productId: existing.feature.productId,
        });
      }
    }
    void deadlineChanged;

    return toTaskDto(updated as TaskFull, today);
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const existing = await this.prisma.task.findUnique({ where: { id }, include: { feature: true } });
    if (!existing) throw new NotFoundException('Task not found');
    if (!canDeleteTask(actor, existing)) throw new ForbiddenException('Only the creator or a manager can delete this task');
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      await tx.product.update({ where: { id: existing.feature.productId }, data: { lastActivityAt: new Date() } });
    });
    return { ok: true };
  }

  private historyRow(
    taskId: string,
    actor: AuthUser,
    field: string,
    oldValue: string | null,
    newValue: string | null,
  ): Prisma.TaskHistoryCreateManyInput {
    return { taskId, actorId: actor.id, action: 'UPDATED', field, oldValue, newValue };
  }

  private async buildWhere(query: QueryTasksDto, actor: AuthUser): Promise<Prisma.TaskWhereInput> {
    const where: Prisma.TaskWhereInput = {};
    const today = this.appConfig.today();
    const todayDate = parseDateOnly(today);

    if (query.productId) where.feature = { productId: query.productId };
    if (query.featureId) where.featureId = query.featureId;
    if (query.assigneeId) where.assigneeId = query.assigneeId === 'me' ? actor.id : query.assigneeId;
    if (query.creatorId) where.creatorId = query.creatorId;
    if (query.priority && query.priority.length > 0) {
      where.priority = { in: query.priority as TaskPriority[] };
    }
    if (query.from || query.to) {
      where.deadline = {
        ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
        ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
      };
    }
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }
    if (query.overdue) {
      where.status = { not: 'COMPLETED' };
      where.deadline = { ...(where.deadline as object), lt: todayDate };
    }

    if (query.status && query.status.length > 0) {
      const statuses = query.status as (TaskStatus | 'OVERDUE')[];
      const wantsOverdue = statuses.includes('OVERDUE');
      const storedStatuses = statuses.filter((s): s is TaskStatus => s !== 'OVERDUE');

      const orClauses: Prisma.TaskWhereInput[] = [];
      if (storedStatuses.length > 0) {
        orClauses.push({
          status: { in: storedStatuses },
          OR: [{ deadline: null }, { deadline: { gte: todayDate } }, { status: 'COMPLETED' }],
        });
      }
      if (wantsOverdue) {
        orClauses.push({ status: { not: 'COMPLETED' }, deadline: { lt: todayDate } });
      }
      if (orClauses.length > 0) {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: orClauses }];
      }
    }

    return where;
  }
}

function fmtD(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return date.toISOString().slice(0, 10);
}
