"use client";

import Link from "next/link";
import { Network } from "lucide-react";
import { useProducts } from "@/lib/queries";
import { fmtAgo } from "@/lib/format";
import { Card, ErrorState, Progress, Skeleton } from "@/components/ui/display";
import { PageHeader } from "@/components/page-header";
import { ProductIcon } from "@/components/product-icon";

export default function ArchitectureIndexPage() {
  const products = useProducts({ sort: "name", order: "asc" });
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Architecture" description="Each product has its own system diagram. Pick one to open the canvas editor." />
      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : products.error ? (
        <ErrorState error={products.error} onRetry={products.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.data?.map((p) => (
            <Link key={p.id} href={`/architecture/${p.id}`} data-testid="architecture-card">
              <Card className="flex items-center gap-3 p-4 hover:border-zinc-300">
                <ProductIcon icon={p.icon} color={p.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2"><Progress value={p.progress} color={p.color} className="w-28" /><span className="text-xs tabular-nums text-zinc-500">{p.progress}%</span></div>
                  <div className="mt-1 text-[11px] text-zinc-400">Last activity {fmtAgo(p.lastActivityAt)}</div>
                </div>
                <Network className="size-4 text-zinc-300" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
