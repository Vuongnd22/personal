import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toHistoryEntryDto, HistoryEntryDto } from './dto/history-response.dto';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async findAllForTask(taskId: string): Promise<HistoryEntryDto[]> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    const entries = await this.prisma.taskHistory.findMany({
      where: { taskId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map(toHistoryEntryDto);
  }
}
