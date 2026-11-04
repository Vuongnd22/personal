import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/app-config';
import { AuthUser } from '../auth/auth.types';
import { toAttachmentDto, AttachmentDto } from './dto/attachment-response.dto';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private appConfig: AppConfigService,
  ) {}

  async findAllForTask(taskId: string): Promise<AttachmentDto[]> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId },
      include: { uploader: true },
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map(toAttachmentDto);
  }

  async upload(
    taskId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    actor: AuthUser,
  ): Promise<AttachmentDto> {
    if (!file) throw new BadRequestException('file is required');
    if (file.size > MAX_SIZE_BYTES) throw new BadRequestException('File exceeds the 10 MB limit');

    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { feature: true } });
    if (!task) throw new NotFoundException('Task not found');
    this.assertCanUpload(task, actor);

    const storageKey = randomBytes(24).toString('hex');
    const dir = this.appConfig.uploadDir;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, storageKey), file.buffer);

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskAttachment.create({
        data: {
          taskId,
          uploaderId: actor.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storageKey,
        },
        include: { uploader: true },
      });
      await tx.taskHistory.create({
        data: { taskId, actorId: actor.id, action: 'ATTACHMENT', field: 'attachment', newValue: file.originalname },
      });
      await tx.product.update({ where: { id: task.feature.productId }, data: { lastActivityAt: new Date() } });
      return created;
    });

    return toAttachmentDto(attachment);
  }

  async getForDownload(id: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const filePath = join(this.appConfig.uploadDir, attachment.storageKey);
    return { attachment, filePath };
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id },
      include: { task: { include: { feature: true } } },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderId !== actor.id && actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw new ForbiddenException('Only the uploader or a manager can delete this attachment');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taskAttachment.delete({ where: { id } });
      await tx.taskHistory.create({
        data: {
          taskId: attachment.taskId,
          actorId: actor.id,
          action: 'ATTACHMENT',
          field: 'attachment',
          oldValue: attachment.fileName,
        },
      });
      await tx.product.update({
        where: { id: attachment.task.feature.productId },
        data: { lastActivityAt: new Date() },
      });
    });

    await fs.rm(join(this.appConfig.uploadDir, attachment.storageKey), { force: true });
    return { ok: true };
  }

  private assertCanUpload(task: { creatorId: string; assigneeId: string | null }, actor: AuthUser) {
    if (actor.role === 'ADMIN' || actor.role === 'MANAGER') return;
    if (task.creatorId === actor.id || task.assigneeId === actor.id) return;
    throw new ForbiddenException('You can only upload to tasks you created or are assigned to');
  }
}
