import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService, EMPTY_COUNTS } from '../common/stats.service';
import { dateInput } from '../common/clock/today';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { toFeatureSummary, toFeatureSummaryWithProduct, FeatureSummaryDto } from './dto/feature-response.dto';
import { ProductRefDto } from '../products/dto/product-response.dto';

type FeatureWithOwner = Prisma.FeatureGetPayload<{ include: { owner: true } }>;

@Injectable()
export class FeaturesService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
  ) {}

  async findAllForProduct(productId: string): Promise<FeatureSummaryDto[]> {
    await this.assertProduct(productId);
    const features = await this.prisma.feature.findMany({
      where: { productId },
      include: { owner: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return this.summarize(features);
  }

  async findOne(id: string): Promise<FeatureSummaryDto & { product: ProductRefDto }> {
    const feature = await this.prisma.feature.findUnique({ where: { id }, include: { owner: true, product: true } });
    if (!feature) throw new NotFoundException('Feature not found');
    const counts = this.stats.countsOf(await this.stats.liteTasks({ featureId: id }));
    return toFeatureSummaryWithProduct(feature, counts);
  }

  async create(productId: string, dto: CreateFeatureDto): Promise<FeatureSummaryDto> {
    await this.assertProduct(productId);
    const feature = await this.prisma.feature.create({
      data: {
        productId,
        name: dto.name.trim(),
        description: dto.description,
        category: dto.category?.trim() || undefined,
        ownerId: dto.ownerId ?? undefined,
        startDate: dateInput(dto.startDate),
        deadline: dateInput(dto.deadline),
      },
      include: { owner: true },
    });
    await this.touchProduct(productId);
    return (await this.summarize([feature]))[0];
  }

  async update(id: string, dto: UpdateFeatureDto): Promise<FeatureSummaryDto> {
    if (Object.keys(dto).length === 0) throw new BadRequestException('No fields to update');
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feature not found');
    const feature = await this.prisma.feature.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        category: dto.category?.trim() || undefined,
        ownerId: dto.ownerId,
        startDate: dateInput(dto.startDate),
        deadline: dateInput(dto.deadline),
        sortOrder: dto.sortOrder,
      },
      include: { owner: true },
    });
    await this.touchProduct(existing.productId);
    return (await this.summarize([feature]))[0];
  }

  async remove(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feature not found');
    await this.prisma.feature.delete({ where: { id } });
    await this.touchProduct(existing.productId);
    return { ok: true };
  }

  private async summarize(features: FeatureWithOwner[]): Promise<FeatureSummaryDto[]> {
    const tasks = await this.stats.liteTasks({ featureId: { in: features.map((f) => f.id) } });
    const counts = this.stats.countsBy(tasks, 'featureId');
    return features.map((f) => toFeatureSummary(f, counts.get(f.id) ?? EMPTY_COUNTS));
  }

  private async assertProduct(productId: string) {
    const exists = await this.prisma.product.count({ where: { id: productId } });
    if (!exists) throw new NotFoundException('Product not found');
  }

  private async touchProduct(productId: string) {
    await this.prisma.product.update({ where: { id: productId }, data: { lastActivityAt: new Date() } });
  }
}
