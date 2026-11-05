"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, MoreHorizontal, Pencil, Plus, Rows3, Trash2 } from "lucide-react";
import { api, useApiMutation, useMe, useProducts } from "@/lib/queries";
import { canManage, fmtDate, PRODUCT_STATUSES, PRODUCT_STATUS_META } from "@/lib/format";
import { useSetParams } from "@/lib/url";
import type { ProductSummary } from "@/lib/types";
import { Avatar, Badge, EmptyState, ErrorState, Progress, Segmented, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlay";
import { PageHeader } from "@/components/page-header";
import { ProductIcon } from "@/components/product-icon";
import { ProductCard } from "@/components/products/product-card";
import { ProductFormDialog } from "@/components/products/product-form-dialog";

export default function ProductsPage() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const me = useMe().data;
  const manager = canManage(me);
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const sort = params.get("sort") ?? "updated";
  const layout = (params.get("layout") ?? "grid") as "grid" | "table";
  const [draft, setDraft] = useState(search);
  const [editing, setEditing] = useState<ProductSummary | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProductSummary | null>(null);
  const products = useProducts({ search: search || undefined, status: status || undefined, sort, order: sort === "name" ? "asc" : "desc" });
  const remove = useApiMutation((id: string) => api.del(`/products/${id}`), { success: "Product deleted", onSuccess: () => setDeleting(null) });

  const menu = (p: ProductSummary) =>
    manager && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`} data-testid="product-actions"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil /> Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleting(p)} data-testid="product-delete"><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Products"
        description="Every product has its own features, tasks and architecture diagram."
        actions={manager && <Button variant="primary" onClick={() => setEditing(null)} data-testid="new-product"><Plus /> New product</Button>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setParams({ search: draft.trim() || null }, { replace: true }); }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setParams({ search: draft.trim() || null }, { replace: true })} placeholder="Search products…" className="w-56" data-testid="product-search" />
        </form>
        <Select value={status} onChange={(e) => setParams({ status: e.target.value || null }, { replace: true })} className="w-40" aria-label="Status filter" data-testid="product-status-filter">
          <option value="">All statuses</option>
          {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{PRODUCT_STATUS_META[s].label}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setParams({ sort: e.target.value }, { replace: true })} className="w-48" aria-label="Sort" data-testid="product-sort">
          <option value="updated">Recently updated</option>
          <option value="progress">Progress (high → low)</option>
          <option value="name">Name (A → Z)</option>
          <option value="created">Newest</option>
        </Select>
        <div className="ml-auto">
          <Segmented value={layout} onChange={(v) => setParams({ layout: v === "grid" ? null : v }, { replace: true })} options={[{ value: "grid", label: "Cards", icon: LayoutGrid }, { value: "table", label: "Table", icon: Rows3 }]} />
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : products.error ? (
        <ErrorState error={products.error} onRetry={products.refetch} />
      ) : !products.data?.length ? (
        <EmptyState title="No products found" description={search || status ? "Try a different search or filter." : "Create your first product to get started."} />
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.data.map((p) => <ProductCard key={p.id} p={p} actions={menu(p)} />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500">
              <tr>{["Product", "Status", "Owner", "Deadline", "Features", "Tasks", "Overdue", "Progress", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.data.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50" data-testid="product-row">
                  <td className="px-3 py-2"><Link href={`/products/${p.id}`} className="flex items-center gap-2 font-medium hover:underline"><ProductIcon icon={p.icon} color={p.color} size={22} />{p.name}</Link></td>
                  <td className="px-3 py-2"><Badge color={PRODUCT_STATUS_META[p.status].color}>{PRODUCT_STATUS_META[p.status].label}</Badge></td>
                  <td className="px-3 py-2">{p.owner ? <span className="flex items-center gap-1.5"><Avatar name={p.owner.name} color={p.owner.avatarColor} size={18} />{p.owner.name}</span> : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDate(p.deadline)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.featureCount}</td>
                  <td className="px-3 py-2 tabular-nums">{p.taskCount}</td>
                  <td className="px-3 py-2 tabular-nums">{p.overdueCount ? <span className="font-medium text-red-600">{p.overdueCount}</span> : 0}</td>
                  <td className="w-40 px-3 py-2"><div className="flex items-center gap-2"><Progress value={p.progress} color={p.color} /><span className="w-8 text-xs tabular-nums">{p.progress}%</span></div></td>
                  <td className="px-3 py-2">{menu(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} product={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          <span data-testid="product-delete-warning">
            This permanently deletes the product, its <b>{deleting?.featureCount} features</b> and <b>{deleting?.taskCount} tasks</b>, and removes it from every architecture diagram.
          </span>
        }
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        pending={remove.isPending}
      />
    </div>
  );
}
