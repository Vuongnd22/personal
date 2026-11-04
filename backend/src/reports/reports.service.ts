import { Injectable } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../common/stats.service';
import { AppConfigService } from '../common/config/app-config';
import { formatDateInTimezone } from '../common/clock/today';
import { IsDateOnly } from '../common/validation';
import { buildReport, Granularity, Report } from './report-builder';

export class ReportQueryDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsDateOnly() from?: string;
  @IsOptional() @IsDateOnly() to?: string;
  @IsOptional() @IsIn(['week', 'month']) granularity?: Granularity;
}

export class ExportQueryDto extends ReportQueryDto {
  @IsIn(['xlsx', 'pdf']) format!: 'xlsx' | 'pdf';
}

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
    private appConfig: AppConfigService,
  ) {}

  async build(q: ReportQueryDto): Promise<Report> {
    const tz = this.appConfig.timezone;
    const [lite, products, features, users] = await Promise.all([
      this.stats.liteTasks(q.productId ? { feature: { productId: q.productId } } : {}),
      this.prisma.product.findMany({ where: q.productId ? { id: q.productId } : {}, orderBy: { name: 'asc' } }),
      this.prisma.feature.findMany({
        where: q.productId ? { productId: q.productId } : {},
        include: { product: true },
        orderBy: [{ product: { name: 'asc' } }, { category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return buildReport({
      tasks: lite.map((t) => ({
        ...t,
        completedOn: t.completedAt ? formatDateInTimezone(t.completedAt, tz) : null,
        createdOn: formatDateInTimezone(t.createdAt, tz),
      })),
      products: products.map((p) => ({ id: p.id, name: p.name })),
      features: features.map((f) => ({ id: f.id, name: f.name, category: f.category, productId: f.productId, productName: f.product.name })),
      users: users.map((u) => ({ id: u.id, name: u.name })),
      from: q.from,
      to: q.to,
      granularity: q.granularity ?? 'week',
      today: this.appConfig.today(),
    });
  }

  async export(q: ExportQueryDto): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const report = await this.build(q);
    const scope = q.productId ? (await this.prisma.product.findUnique({ where: { id: q.productId } }))?.name ?? 'Product' : 'All products';
    const stamp = this.appConfig.today();
    if (q.format === 'xlsx') {
      return {
        buffer: await this.toXlsx(report, scope),
        filename: `archboard-report-${stamp}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    return { buffer: await this.toPdf(report, scope, stamp), filename: `archboard-report-${stamp}.pdf`, contentType: 'application/pdf' };
  }

  private async toXlsx(r: Report, scope: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = (name: string, columns: [string, string, number?][], rows: object[]) => {
      const ws = wb.addWorksheet(name);
      ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width ?? 14 }));
      ws.getRow(1).font = { bold: true };
      ws.addRows(rows);
    };
    const s = r.summary;
    sheet('Summary', [['Metric', 'metric', 28], ['Value', 'value', 20]], [
      { metric: 'Scope', value: scope },
      { metric: 'Range', value: `${r.range.from} → ${r.range.to}` },
      { metric: 'Total tasks', value: s.total },
      { metric: 'Completed', value: s.completed },
      { metric: 'Open', value: s.open },
      { metric: 'Overdue', value: s.overdue },
      { metric: 'Completed late', value: s.completedLate },
      { metric: 'On-time completion rate', value: pct(s.onTimeRate) },
    ]);
    sheet('Throughput', [['Period', 'period'], ['Completed', 'completed'], ['Completed late', 'completedLate']], r.throughput);
    sheet('Products', [['Product', 'name', 28], ['Total', 'total'], ['Completed', 'completed'], ['Overdue', 'overdue'], ['Progress %', 'progress']], r.products);
    sheet('Features', [['Product', 'productName', 24], ['Category', 'category'], ['Feature', 'name', 32], ['Total', 'total'], ['Completed', 'completed'], ['Overdue', 'overdue'], ['Progress %', 'progress']], r.features);
    sheet('Workload', [['Assignee', 'name', 28], ['Total', 'total'], ['Open', 'open'], ['Completed', 'completed'], ['Overdue', 'overdue'], ['Completed late', 'completedLate']], r.workload);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private toPdf(r: Report, scope: string, stamp: string): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.registerFont('body', join(FONT_DIR, 'BeVietnamPro-Regular.ttf'));
    doc.registerFont('bold', join(FONT_DIR, 'BeVietnamPro-SemiBold.ttf'));
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const table = (title: string, headers: string[], rows: (string | number)[][], widths: number[]) => {
      if (doc.y > 700) doc.addPage();
      doc.moveDown(0.8).font('bold').fontSize(12).text(title, 40);
      doc.moveDown(0.3).fontSize(9);
      const line = (cells: (string | number)[], font: string) => {
        if (doc.y > 780) doc.addPage();
        const y = doc.y;
        let x = 40;
        doc.font(font);
        cells.forEach((c, i) => {
          doc.text(String(c), x, y, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
          x += widths[i];
        });
        doc.moveDown(0.25);
        doc.x = 40;
      };
      line(headers, 'bold');
      rows.forEach((row) => line(row, 'body'));
    };

    const s = r.summary;
    doc.font('bold').fontSize(18).text('ArchBoard — Báo cáo tiến độ');
    doc.font('body').fontSize(10).fillColor('#52525b')
      .text(`${scope} · ${r.range.from} → ${r.range.to} · Xuất ngày ${stamp}`).fillColor('#000');
    table('Tổng quan', ['Tổng task', 'Hoàn thành', 'Chưa xong', 'Quá hạn', 'Hoàn thành trễ', 'Đúng hạn'],
      [[s.total, s.completed, s.open, s.overdue, s.completedLate, pct(s.onTimeRate)]], [85, 85, 85, 85, 90, 85]);
    table('Hiệu suất theo kỳ', ['Kỳ', 'Hoàn thành', 'Trễ'], r.throughput.map((t) => [t.period, t.completed, t.completedLate]), [120, 100, 100]);
    table('Tiến độ sản phẩm', ['Sản phẩm', 'Tổng', 'Xong', 'Quá hạn', '%'],
      r.products.map((p) => [p.name, p.total, p.completed, p.overdue, `${p.progress}%`]), [200, 70, 70, 70, 70]);
    table('Tiến độ tính năng', ['Sản phẩm', 'Nhóm', 'Tính năng', 'Tổng', 'Xong', 'Quá hạn', '%'],
      r.features.map((f) => [f.productName, f.category, f.name, f.total, f.completed, f.overdue, `${f.progress}%`]), [95, 70, 150, 45, 45, 55, 45]);
    table('Khối lượng theo nhân sự', ['Nhân sự', 'Tổng', 'Đang mở', 'Xong', 'Quá hạn', 'Trễ'],
      r.workload.map((w) => [w.name, w.total, w.open, w.completed, w.overdue, w.completedLate]), [170, 65, 65, 65, 65, 65]);
    doc.end();
    return done;
  }
}
