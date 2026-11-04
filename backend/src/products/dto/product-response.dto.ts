import { Product, ProductStatus } from '@prisma/client';
import { Counts } from '../../common/stats.service';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';
import { formatDateOnly } from '../../common/clock/today';

export interface ProductRefDto {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ProductSummaryDto extends ProductRefDto, Counts {
  description: string;
  status: ProductStatus;
  owner: UserRefDto | null;
  startDate: string | null;
  deadline: string | null;
  featureCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export function toProductRef(product: Product): ProductRefDto {
  return { id: product.id, name: product.name, icon: product.icon, color: product.color };
}

export function toProductSummary(
  product: Product & { owner: Parameters<typeof toUserRef>[0] | null },
  counts: Counts,
  featureCount: number,
): ProductSummaryDto {
  return {
    ...toProductRef(product),
    ...counts,
    description: product.description,
    status: product.status,
    owner: product.owner ? toUserRef(product.owner) : null,
    startDate: formatDateOnly(product.startDate),
    deadline: formatDateOnly(product.deadline),
    featureCount,
    lastActivityAt: product.lastActivityAt.toISOString(),
    createdAt: product.createdAt.toISOString(),
  };
}
