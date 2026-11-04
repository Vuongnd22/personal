import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService, EMPTY_COUNTS } from '../common/stats.service';
import { dateInput } from '../common/clock/today';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { toProductSummary, ProductSummaryDto } from './dto/product-response.dto';

type ProductWithOwner = Prisma.ProductGetPayload<{ include: { owner: true; _count: { select: { features: true } } } }>;
const INCLUDE = { owner: true, _count: { select: { features: true } } } as const;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
  ) {}

  async findAll(query: QueryProductsDto = {}): Promise<ProductSummaryDto[]> {
    const where: Prisma.ProductWhereInput = {};
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.status) where.status = query.status;

    const products = await this.prisma.product.findMany({ where, include: INCLUDE });
    const summaries = await this.summarize(products);

    const dir = query.order === 'asc' ? 1 : -1;
    const key: Record<string, (p: ProductSummaryDto) => number | string> = {
      progress: (p) => p.progress,
      name: (p) => p.name.toLocaleLowerCase(),
      created: (p) => p.createdAt,
      updated: (p) => p.lastActivityAt,
    };
    const pick = key[query.sort ?? 'updated'];
    return summaries.sort((a, b) => (pick(a) < pick(b) ? -dir : pick(a) > pick(b) ? dir : 0));
  }

  async findOne(id: string): Promise<ProductSummaryDto> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!product) throw new NotFoundException('Product not found');
    return (await this.summarize([product]))[0];
  }

  async create(dto: CreateProductDto): Promise<ProductSummaryDto> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        status: dto.status,
        ownerId: dto.ownerId ?? undefined,
        startDate: dateInput(dto.startDate),
        deadline: dateInput(dto.deadline),
      },
      include: INCLUDE,
    });
    return (await this.summarize([product]))[0];
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductSummaryDto> {
    if (Object.keys(dto).length === 0) throw new BadRequestException('No fields to update');
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        status: dto.status,
        ownerId: dto.ownerId,
        startDate: dateInput(dto.startDate),
        deadline: dateInput(dto.deadline),
        lastActivityAt: new Date(),
      },
      include: INCLUDE,
    });
    return (await this.summarize([product]))[0];
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  async summarize(products: ProductWithOwner[]): Promise<ProductSummaryDto[]> {
    const tasks = await this.stats.liteTasks({ feature: { productId: { in: products.map((p) => p.id) } } });
    const counts = this.stats.countsBy(tasks, 'productId');
    return products.map((p) => toProductSummary(p, counts.get(p.id) ?? EMPTY_COUNTS, p._count.features));
  }
}
