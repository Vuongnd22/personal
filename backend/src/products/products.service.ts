import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/app-config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { toProductSummary, ProductSummaryDto } from './dto/product-response.dto';
import { parseDateOnly } from '../common/clock/today';
import { toCounts } from '../common/progress/progress';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private appConfig: AppConfigService,
  ) {}

  async findAll(query: QueryProductsDto): Promise<ProductSummaryDto[]> {
    const where: Prisma.ProductWhereInput = {};
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }

    const products = await this.prisma.product.findMany({ where, include: { owner: true } });
    const summaries = await Promise.all(products.map((p) => this.buildSummary(p)));

    const sort = query.sort ?? 'updated';
    const order = query.order ?? 'desc';
    const dir = order === 'asc' ? 1 : -1;
    summaries.sort((a, b) => {
      switch (sort) {
        case 'progress':
          return (a.progress - b.progress) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'created':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case 'updated':
        default:
          return (new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()) * dir;
      }
    });
    return summaries;
  }

  async findOne(id: string): Promise<ProductSummaryDto> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { owner: true } });
    if (!product) throw new NotFoundException('Product not found');
    return this.buildSummary(product);
  }

  async create(dto: CreateProductDto): Promise<ProductSummaryDto> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        status: dto.status,
        ownerId: dto.ownerId,
        startDate: dto.startDate ? parseDateOnly(dto.startDate) : undefined,
        deadline: dto.deadline ? parseDateOnly(dto.deadline) : undefined,
      },
      include: { owner: true },
    });
    return this.buildSummary(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductSummaryDto> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        status: dto.status,
        ownerId: dto.ownerId,
        startDate: dto.startDate !== undefined ? parseDateOnly(dto.startDate) : undefined,
        deadline: dto.deadline !== undefined ? parseDateOnly(dto.deadline) : undefined,
        lastActivityAt: new Date(),
      },
      include: { owner: true },
    });
    return this.buildSummary(product);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  private async buildSummary(
    product: Prisma.ProductGetPayload<{ include: { owner: true } }>,
  ): Promise<ProductSummaryDto> {
    const today = this.appConfig.today();
    const [total, completed, overdue, featureCount] = await Promise.all([
      this.prisma.task.count({ where: { feature: { productId: product.id } } }),
      this.prisma.task.count({ where: { feature: { productId: product.id }, status: 'COMPLETED' } }),
      this.prisma.task.count({
        where: {
          feature: { productId: product.id },
          status: { not: 'COMPLETED' },
          deadline: { lt: parseDateOnly(today) },
        },
      }),
      this.prisma.feature.count({ where: { productId: product.id } }),
    ]);
    return toProductSummary(product, toCounts(total, completed, overdue), featureCount);
  }
}
