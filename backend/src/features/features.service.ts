import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { toFeatureSummary, toFeatureSummaryWithProduct, FeatureSummaryDto } from './dto/feature-response.dto';
import { toCounts } from '../common/progress/progress';
import { parseDateOnly } from '../common/clock/today';
import { ProductRefDto } from '../products/dto/product-response.dto';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  async findAllForProduct(productId: string): Promise<FeatureSummaryDto[]> {
    const features = await this.prisma.feature.findMany({
      where: { productId },
      include: { owner: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return Promise.all(features.map((f) => this.buildSummary(f)));
  }

  async findOne(id: string): Promise<FeatureSummaryDto & { product: ProductRefDto }> {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
      include: { owner: true, product: true },
    });
    if (!feature) throw new NotFoundException('Feature not found');
    const counts = await this.computeCounts(id);
    return toFeatureSummaryWithProduct(feature, counts);
  }

  async create(productId: string, dto: CreateFeatureDto): Promise<FeatureSummaryDto> {
    await this.touchProduct(productId);
    const feature = await this.prisma.feature.create({
      data: {
        productId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        ownerId: dto.ownerId,
        startDate: dto.startDate ? parseDateOnly(dto.startDate) : undefined,
        deadline: dto.deadline ? parseDateOnly(dto.deadline) : undefined,
      },
      include: { owner: true },
    });
    return this.buildSummary(feature);
  }

  async update(id: string, dto: UpdateFeatureDto): Promise<FeatureSummaryDto> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feature not found');
    await this.touchProduct(existing.productId);
    const feature = await this.prisma.feature.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        ownerId: dto.ownerId,
        startDate: dto.startDate !== undefined ? parseDateOnly(dto.startDate) : undefined,
        deadline: dto.deadline !== undefined ? parseDateOnly(dto.deadline) : undefined,
        sortOrder: dto.sortOrder,
      },
      include: { owner: true },
    });
    return this.buildSummary(feature);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feature not found');
    await this.touchProduct(existing.productId);
    await this.prisma.feature.delete({ where: { id } });
    return { ok: true };
  }

  private async touchProduct(productId: string) {
    await this.prisma.product.update({ where: { id: productId }, data: { lastActivityAt: new Date() } });
  }

  private async computeCounts(featureId: string) {
    const [total, completed, overdue] = await Promise.all([
      this.prisma.task.count({ where: { featureId } }),
      this.prisma.task.count({ where: { featureId, status: 'COMPLETED' } }),
      this.prisma.task.count({
        where: { featureId, status: { not: 'COMPLETED' }, deadline: { lt: new Date() } },
      }),
    ]);
    return toCounts(total, completed, overdue);
  }

  private async buildSummary(
    feature: Prisma.FeatureGetPayload<{ include: { owner: true } }>,
  ): Promise<FeatureSummaryDto> {
    const counts = await this.computeCounts(feature.id);
    return toFeatureSummary(feature, counts);
  }
}
