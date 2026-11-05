import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { fmtAgo, PRODUCT_STATUS_META } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";
import { Badge, Card, Progress } from "@/components/ui/display";
import { ProductIcon } from "@/components/product-icon";

export function ProductCard({ p, actions }: { p: ProductSummary; actions?: React.ReactNode }) {
  return (
    <Card className="group relative flex flex-col gap-3 p-4 transition-colors hover:border-zinc-300" data-testid="product-card" data-product-id={p.id}>
      <Link href={`/products/${p.id}`} className="absolute inset-0 z-0 rounded-lg" aria-label={`Open ${p.name}`} />
      <div className="pointer-events-none flex items-start gap-3">
        <ProductIcon icon={p.icon} color={p.color} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-zinc-900">{p.name}</span>
            <Badge color={PRODUCT_STATUS_META[p.status].color}>{PRODUCT_STATUS_META[p.status].label}</Badge>
          </div>
          <p className="line-clamp-2 text-xs text-zinc-500">{p.description || "No description"}</p>
        </div>
        {actions && <div className="pointer-events-auto relative z-10">{actions}</div>}
      </div>
      <div className="pointer-events-none flex items-center gap-2">
        <Progress value={p.progress} color={p.color} />
        <span className="w-9 text-right text-xs font-medium tabular-nums" data-testid="product-progress">{p.progress}%</span>
      </div>
      <div className="pointer-events-none flex items-center gap-3 text-xs text-zinc-500">
        <span>{p.featureCount} features</span>
        <span>{p.taskCount} tasks</span>
        {p.overdueCount > 0 && <span className="flex items-center gap-1 font-medium text-red-600"><AlertTriangle className="size-3" />{p.overdueCount} overdue</span>}
        <span className="ml-auto">Updated {fmtAgo(p.lastActivityAt)}</span>
      </div>
    </Card>
  );
}
