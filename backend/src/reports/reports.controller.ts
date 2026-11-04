import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ExportQueryDto, ReportQueryDto, ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get()
  get(@Query() q: ReportQueryDto) {
    return this.reports.build(q);
  }

  @Get('export')
  async export(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    const { buffer, filename, contentType } = await this.reports.export(q);
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${filename}"` });
    return new StreamableFile(buffer);
  }
}
