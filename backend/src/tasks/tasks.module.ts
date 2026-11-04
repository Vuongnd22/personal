import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ChecklistService } from './checklist.service';
import { CommentsService } from './comments.service';
import { AttachmentsService } from './attachments.service';
import { HistoryService } from './history.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, ChecklistService, CommentsService, AttachmentsService, HistoryService],
})
export class TasksModule {}
