import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { toCommentDto, CommentDto } from './dto/comment-response.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAllForTask(taskId: string): Promise<CommentDto[]> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map(toCommentDto);
  }

  async create(taskId: string, dto: CreateCommentDto, actor: AuthUser): Promise<CommentDto> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { feature: true } });
    if (!task) throw new NotFoundException('Task not found');

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskComment.create({
        data: { taskId, authorId: actor.id, body: dto.body },
        include: { author: true },
      });
      await tx.taskHistory.create({
        data: { taskId, actorId: actor.id, action: 'COMMENTED', newValue: dto.body.slice(0, 200) },
      });
      await tx.product.update({ where: { id: task.feature.productId }, data: { lastActivityAt: new Date() } });
      return created;
    });

    const notifyIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== actor.id) notifyIds.add(task.assigneeId);
    if (task.creatorId !== actor.id) notifyIds.add(task.creatorId);
    for (const userId of notifyIds) {
      await this.notifications.notify({
        userId,
        type: 'TASK_COMMENTED',
        title: `New comment on: ${task.title}`,
        taskId: task.id,
        productId: task.feature.productId,
      });
    }

    return toCommentDto(comment);
  }

  async update(id: string, dto: UpdateCommentDto, actor: AuthUser): Promise<CommentDto> {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== actor.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const updated = await this.prisma.taskComment.update({
      where: { id },
      data: { body: dto.body },
      include: { author: true },
    });
    return toCommentDto(updated);
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.taskComment.delete({ where: { id } });
    return { ok: true };
  }
}
