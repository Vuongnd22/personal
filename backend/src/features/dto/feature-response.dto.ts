import { Feature } from '@prisma/client';
import { Counts } from '../../common/progress/progress';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';
import { ProductRefDto, toProductRef } from '../../products/dto/product-response.dto';
import { formatDateOnly } from '../../common/clock/today';

export interface FeatureSummaryDto extends Counts {
  id: string;
  productId: string;
  name: string;
  description: string;
  category: string;
  owner: UserRefDto | null;
  startDate: string | null;
  deadline: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toFeatureSummary(
  feature: Feature & { owner: Parameters<typeof toUserRef>[0] | null },
  counts: Counts,
): FeatureSummaryDto {
  return {
    id: feature.id,
    productId: feature.productId,
    name: feature.name,
    description: feature.description,
    category: feature.category,
    owner: feature.owner ? toUserRef(feature.owner) : null,
    startDate: formatDateOnly(feature.startDate),
    deadline: formatDateOnly(feature.deadline),
    sortOrder: feature.sortOrder,
    createdAt: feature.createdAt.toISOString(),
    updatedAt: feature.updatedAt.toISOString(),
    ...counts,
  };
}

export function toFeatureSummaryWithProduct(
  feature: Feature & { owner: Parameters<typeof toUserRef>[0] | null; product: Parameters<typeof toProductRef>[0] },
  counts: Counts,
): FeatureSummaryDto & { product: ProductRefDto } {
  return {
    ...toFeatureSummary(feature, counts),
    product: toProductRef(feature.product),
  };
}
