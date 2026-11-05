"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, Pencil } from "lucide-react";
import { useMe, useProduct, useTasks } from "@/lib/queries";
import { canManage, fmtDate, PRODUCT_STATUS_META } from "@/lib/format";
import { useOpenTask, useSetParams } from "@/lib/url";
import { Avatar, Badge, Card, ErrorState, Progress, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/product-icon";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { FeaturesPanel } from "@/components/products/features-panel";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { ArchitectureCanvas } from "@/components/architecture/canvas";

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "red" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <span className={tone === "red" ? "text-[13px] font-semibold text-red-600" : "text-[13px] font-medium text-zinc-800"}>{value}</span>
    </div>
  );
}

function OverdueStrip({ productId }: { productId: string }) {
  const overdue = useTasks({ productId, status: "OVERDUE", sort: "deadline", order: "asc", pageSize: 20 });
  const openTask = useOpenTask();
  if (!overdue.data?.total) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2" data-testid="overdue-strip">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-red-700"><AlertTriangle className="size-4" /> {overdue.data.total} overdue</span>
      {overdue.data.items.slice(0, 6).map((t) => (
        <button key={t.id} onClick={() => openTask(t.id)} className="rounded border border-red-100 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:border-red-300">
          {t.title} <span className="text-red-600">· {fmtDate(t.deadline)}</span>
        </button>
      ))}
    </div>
  );
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const setParams = useSetParams();
  const me = useMe().data;
  const manager = canManage(me);
  const product = useProduct(id);
  const [editing, setEditing] = useState(false);
  const tab = search.get("tab") ?? "features";

  if (product.isLoading) return <div className="flex flex-col gap-3 p-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (product.error || !product.data) return <div className="p-6"><ErrorState error={product.error} onRetry={product.refetch} /></div>;
  const p = product.data;

  return (
    <div className="flex flex-col gap-4 p-6" data-testid="product-detail" data-product-id={p.id}>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <ProductIcon icon={p.icon} color={p.color} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight" data-testid="product-name">{p.name}</h1>
              <Badge color={PRODUCT_STATUS_META[p.status].color}>{PRODUCT_STATUS_META[p.status].label}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[13px] text-zinc-600">{p.description || "No description"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href={`/architecture/${p.id}`}><ExternalLink /> Architecture</Link></Button>
            {manager && <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="edit-product"><Pencil /> Edit</Button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Stat label="Owner" value={p.owner ? <span className="flex items-center gap-1.5"><Avatar name={p.owner.name} color={p.owner.avatarColor} size={18} />{p.owner.name}</span> : "—"} />
          <Stat label="Start" value={fmtDate(p.startDate)} />
          <Stat label="Deadline" value={fmtDate(p.deadline)} />
          <Stat label="Features" value={p.featureCount} />
          <Stat label="Tasks" value={`${p.completedCount}/${p.taskCount} done`} />
          <Stat label="Overdue" value={p.overdueCount} tone={p.overdueCount ? "red" : undefined} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400">Progress</span>
            <div className="flex items-center gap-2"><Progress value={p.progress} color={p.color} /><span className="text-[13px] font-semibold tabular-nums" data-testid="product-progress">{p.progress}%</span></div>
          </div>
        </div>
      </Card>

      <OverdueStrip productId={p.id} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v === "features" ? null : v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="architecture" data-testid="tab-architecture">Architecture</TabsTrigger>
        </TabsList>
        <TabsContent value="features" className="pt-4"><FeaturesPanel productId={p.id} canEdit={manager} /></TabsContent>
        <TabsContent value="tasks" className="pt-4"><TasksWorkspace productId={p.id} /></TabsContent>
        <TabsContent value="architecture" className="pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Read-only preview. Click a product node to open it.</span>
              <Button variant="primary" size="sm" asChild><Link href={`/architecture/${p.id}`}>Open editor</Link></Button>
            </div>
            <div className="h-[520px] overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <ArchitectureCanvas productId={p.id} readOnly />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ProductFormDialog open={editing} onOpenChange={setEditing} product={p} />
    </div>
  );
}
