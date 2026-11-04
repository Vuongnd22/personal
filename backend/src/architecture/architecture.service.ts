import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService, EMPTY_COUNTS } from '../common/stats.service';
import { validateDiagram } from '../common/domain';
import { SaveDiagramDto } from './architecture.dto';

@Injectable()
export class ArchitectureService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
  ) {}

  async get(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    let nodes = await this.prisma.architectureNode.findMany({
      where: { productId },
      include: { refProduct: true, feature: true },
      orderBy: { createdAt: 'asc' },
    });
    const connections = await this.prisma.architectureConnection.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });

    if (nodes.length === 0 && !product.architectureUpdatedAt) {
      // Never saved: offer the product itself as the (unsaved) center node.
      nodes = [{
        id: randomUUID(), productId, kind: 'PRODUCT', label: '', refProductId: productId, refProduct: product,
        featureId: null, feature: null, positionX: 0, positionY: 0, width: null, height: null, isCenter: true,
        color: null, createdAt: new Date(), updatedAt: new Date(),
      }];
    }

    const refIds = nodes.map((n) => n.refProductId).filter((id): id is string => !!id);
    const featureIds = nodes.map((n) => n.featureId).filter((id): id is string => !!id);
    const tasks = await this.stats.liteTasks({
      OR: [{ feature: { productId: { in: refIds } } }, { featureId: { in: featureIds } }],
    });
    const byProduct = this.stats.countsBy(tasks, 'productId');
    const byFeature = this.stats.countsBy(tasks, 'featureId');

    return {
      productId,
      updatedAt: product.architectureUpdatedAt?.toISOString() ?? null,
      nodes: nodes.map((n) => {
        const pc = n.refProductId ? byProduct.get(n.refProductId) ?? EMPTY_COUNTS : null;
        return {
          id: n.id,
          kind: n.kind,
          label: n.refProduct ? n.refProduct.name : n.label,
          refProductId: n.refProductId,
          featureId: n.featureId,
          refProduct: n.refProduct && pc
            ? {
                id: n.refProduct.id, name: n.refProduct.name, icon: n.refProduct.icon, color: n.refProduct.color,
                status: n.refProduct.status, progress: pc.progress, taskCount: pc.taskCount, overdueCount: pc.overdueCount,
              }
            : null,
          feature: n.feature
            ? { id: n.feature.id, name: n.feature.name, progress: (byFeature.get(n.feature.id) ?? EMPTY_COUNTS).progress }
            : null,
          position: { x: n.positionX, y: n.positionY },
          width: n.width,
          height: n.height,
          isCenter: n.isCenter,
          color: n.color,
        };
      }),
      connections: connections.map((c) => ({
        id: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId, sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle, label: c.label, direction: c.direction,
      })),
    };
  }

  async save(productId: string, dto: SaveDiagramDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const stored = product.architectureUpdatedAt?.toISOString() ?? null;
    if ((dto.baseUpdatedAt ?? null) !== stored) {
      throw new ConflictException('The diagram was changed by someone else since you opened it');
    }

    const nodes = dto.nodes.map((n) => ({ ...n, refProductId: n.refProductId ?? null, isCenter: n.isCenter ?? false }));
    const errors = validateDiagram({ nodes, connections: dto.connections });
    const refIds = [...new Set(nodes.map((n) => n.refProductId).filter((id): id is string => !!id))];
    const featureIds = [...new Set(nodes.map((n) => n.featureId).filter((id): id is string => !!id))];
    const [refCount, ownFeatures] = await Promise.all([
      this.prisma.product.count({ where: { id: { in: refIds } } }),
      this.prisma.feature.count({ where: { id: { in: featureIds }, productId } }),
    ]);
    if (refCount !== refIds.length) errors.push('Some refProductId values do not reference existing products');
    if (ownFeatures !== featureIds.length) errors.push('Some featureId values do not belong to this product');
    if (errors.length) {
      throw new BadRequestException({ message: errors.map((m) => `diagram ${m}`) });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.architectureConnection.deleteMany({ where: { productId } }),
      this.prisma.architectureNode.deleteMany({ where: { productId } }),
      this.prisma.architectureNode.createMany({
        data: nodes.map((n) => ({
          id: n.id, productId, kind: n.kind, label: n.kind === 'PRODUCT' ? '' : (n.label ?? ''),
          refProductId: n.kind === 'PRODUCT' ? n.refProductId : null, featureId: n.featureId ?? null,
          positionX: n.position.x, positionY: n.position.y, width: n.width ?? null, height: n.height ?? null,
          isCenter: n.isCenter, color: n.color ?? null,
        })),
      }),
      this.prisma.architectureConnection.createMany({
        data: dto.connections.map((c) => ({
          id: c.id, productId, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId,
          sourceHandle: c.sourceHandle ?? null, targetHandle: c.targetHandle ?? null,
          label: c.label ?? '', direction: c.direction ?? 'FORWARD',
        })),
      }),
      this.prisma.product.update({ where: { id: productId }, data: { architectureUpdatedAt: now, lastActivityAt: now } }),
    ]);
    return this.get(productId);
  }
}
