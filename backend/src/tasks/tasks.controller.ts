import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync } from 'fs';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { TasksService } from './tasks.service';
import { ChecklistService } from './checklist.service';
import { CommentsService } from './comments.service';
import { AttachmentsService, MAX_ATTACHMENT_BYTES } from './attachments.service';
import { HistoryService } from './history.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const uuid = new ParseUUIDPipe();

@Controller()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private tasks: TasksService,
    private checklist: ChecklistService,
    private comments: CommentsService,
    private attachments: AttachmentsService,
    private history: HistoryService,
  ) {}

  @Get('tasks')
  findAll(@Query() query: QueryTasksDto, @CurrentUser() user: AuthUser) {
    return this.tasks.findAll(query, user);
  }

  @Post('tasks')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.create(dto, user);
  }

  @Get('tasks/:id')
  findOne(@Param('id', uuid) id: string) {
    return this.tasks.findOne(id);
  }

  @Patch('tasks/:id')
  update(@Param('id', uuid) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.update(id, dto, user);
  }

  @Delete('tasks/:id')
  remove(@Param('id', uuid) id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.remove(id, user);
  }

  @Post('tasks/:id/checklist')
  addChecklist(@Param('id', uuid) id: string, @Body() dto: CreateChecklistItemDto, @CurrentUser() user: AuthUser) {
    return this.checklist.add(id, dto, user);
  }

  @Patch('checklist/:itemId')
  updateChecklist(@Param('itemId', uuid) itemId: string, @Body() dto: UpdateChecklistItemDto, @CurrentUser() user: AuthUser) {
    return this.checklist.update(itemId, dto, user);
  }

  @Delete('checklist/:itemId')
  removeChecklist(@Param('itemId', uuid) itemId: string, @CurrentUser() user: AuthUser) {
    return this.checklist.remove(itemId, user);
  }

  @Get('tasks/:id/comments')
  listComments(@Param('id', uuid) id: string) {
    return this.comments.findAllForTask(id);
  }

  @Post('tasks/:id/comments')
  addComment(@Param('id', uuid) id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.create(id, dto, user);
  }

  @Patch('comments/:id')
  updateComment(@Param('id', uuid) id: string, @Body() dto: UpdateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.update(id, dto, user);
  }

  @Delete('comments/:id')
  removeComment(@Param('id', uuid) id: string, @CurrentUser() user: AuthUser) {
    return this.comments.remove(id, user);
  }

  @Get('tasks/:id/attachments')
  listAttachments(@Param('id', uuid) id: string) {
    return this.attachments.findAllForTask(id);
  }

  @Post('tasks/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  upload(@Param('id', uuid) id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    // multer decodes multipart filenames as latin1; restore UTF-8 (Vietnamese names).
    if (file) file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.attachments.upload(id, file, user);
  }

  @Get('attachments/:id/download')
  async download(@Param('id', uuid) id: string, @Res({ passthrough: true }) res: Response) {
    const { attachment, filePath } = await this.attachments.getForDownload(id);
    if (!existsSync(filePath)) throw new NotFoundException('File is missing on the server');
    const ascii = attachment.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.set({
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    });
    return new StreamableFile(createReadStream(filePath));
  }

  @Delete('attachments/:id')
  @HttpCode(200)
  removeAttachment(@Param('id', uuid) id: string, @CurrentUser() user: AuthUser) {
    return this.attachments.remove(id, user);
  }

  @Get('tasks/:id/history')
  listHistory(@Param('id', uuid) id: string) {
    return this.history.findAllForTask(id);
  }
}
