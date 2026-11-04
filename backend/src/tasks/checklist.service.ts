import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist.dto';
import { ChecklistItemDto } from './dto/task-response.dto';

@Injectable()
export class ChecklistService {
  constructor(private prisma: PrismaService) {}

  async add(taskId: string, dto: CreateChecklistItemDto, actor: AuthUser): Promise<ChecklistItemDto> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { feature: true } });
    if (!task) throw new NotFoundException('Task not found');
    this.assertCanEditChecklist(task, actor);

    const count = await this.prisma.taskChecklistItem.count({ where: { taskId } });
    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskChecklistItem.create({
        data: { taskId, title: dto.title, sortOrder: count },
      });
      await tx.taskHistory.create({
        data: { taskId, actorId: actor.id, action: 'CHECKLIST', field: 'checklist', newValue: dto.title },
      });
      await tx.product.update({ where: { id: task.feature.productId }, data: { lastActivityAt: new Date() } });
      return created;
    });
    return { id: item.id, title: item.title, done: item.done, sortOrder: item.sortOrder };
  }

  async update(itemId: string, dto: UpdateChecklistItemDto, actor: AuthUser): Promise<ChecklistItemDto> {
    const item = await this.prisma.taskChecklistItem.findUnique({
      where: { id: itemId },
      include: { task: { include: { feature: true } } },
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    this.assertCanEditChecklist(item.task, actor);

    const historyRows: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    if (dto.title !== undefined && dto.title !== item.title) {
      historyRows.push({ field: 'checklist.title', oldValue: item.title, newValue: dto.title });
    }
    if (dto.done !== undefined && dto.done !== item.done) {
      historyRows.push({ field: 'checklist.done', oldValue: String(item.done), newValue: String(dto.done) });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taskChecklistItem.update({
        where: { id: itemId },
        data: { title: dto.title, done: dto.done, sortOrder: dto.sortOrder },
      });
      for (const row of historyRows) {
        await tx.taskHistory.create({ data: { taskId: item.taskId, actorId: actor.id, action: 'CHECKLIST', ...row } });
      }
      await tx.product.update({
        where: { id: item.task.feature.productId },
        data: { lastActivityAt: new Date() },
      });
      return next;
    });
    return { id: updated.id, title: updated.title, done: updated.done, sortOrder: updated.sortOrder };
  }

  async remove(itemId: string, actor: AuthUser): Promise<{ ok: true }> {
    const item = await this.prisma.taskChecklistItem.findUnique({
      where: { id: itemId },
      include: { task: { include: { feature: true } } },
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    this.assertCanEditChecklist(item.task, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.taskChecklistItem.delete({ where: { id: itemId } });
      await tx.taskHistory.create({
        data: { taskId: item.taskId, actorId: actor.id, action: 'CHECKLIST', field: 'checklist', oldValue: item.title },
      });
      await tx.product.update({
        where: { id: item.task.feature.productId },
        data: { lastActivityAt: new Date() },
      });
    });
    return { ok: true };
  }

  private assertCanEditChecklist(task: { creatorId: string; assigneeId: string | null }, actor: AuthUser) {
    if (actor.role === 'ADMIN' || actor.role === 'MANAGER') return;
    if (task.creatorId === actor.id || task.assigneeId === actor.id) return;
    throw new ForbiddenException('You can only edit the checklist of tasks you created or are assigned to');
  }
}
