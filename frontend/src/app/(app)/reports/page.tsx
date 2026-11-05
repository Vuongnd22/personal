"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { apiDownload } from "@/lib/api-client";
import { buildQueryString } from "@/lib/query-string";
import { useProducts, useReports } from "@/lib/queries";
import { fmtShortDate } from "@/lib/format";
import { useSetParams } from "@/lib/url";
import { Card, ErrorState, Progress, SectionTitle, Segmented, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";

const AXIS = { fontSize: 11, fill: "#71717a" };

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[20px] font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </Card>
  );
}

function Table({ head, rows, testId }: { head: string[]; rows: React.ReactNode[][]; testId?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[640px] text-[13px]" data-testid={testId}>
        <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500"><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-zinc-100 last:border-0">{r.map((c, j) => <td key={j} className="px-3 py-2 tabular-nums">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const pctBar = (v: number) => <div className="flex w-36 items-center gap-2"><Progress value={v} /><span className="w-8 text-xs">{v}%</span></div>;

export default function ReportsPage() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const products = useProducts({ sort: "name", order: "asc" });
  const filters = {
    productId: params.get("productId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    granularity: (params.get("granularity") as "week" | "month") ?? "week",
  };
  const report = useReports(filters);
  const [exporting, setExporting] = useState<string | null>(null);
  const set = (patch: Record<string, string | null>) => setParams(patch, { replace: true });

  const exportFile = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const blob = await apiDownload(`/reports/export${buildQueryString({ ...filters, format })}`);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `archboard-report-${new Date().toISOString().slice(0, 10)}.${format}` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const r = report.data;
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Reports"
        description="Completion, punctuality and workload — filtered by product and deadline range."
        actions={
          <>
            <Button variant="outline" onClick={() => exportFile("xlsx")} disabled={!!exporting} data-testid="export-xlsx"><FileSpreadsheet /> {exporting === "xlsx" ? "Exporting…" : "Export Excel"}</Button>
            <Button variant="outline" onClick={() => exportFile("pdf")} disabled={!!exporting} data-testid="export-pdf"><FileText /> {exporting === "pdf" ? "Exporting…" : "Export PDF"}</Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2" data-testid="report-filters">
        <Select value={filters.productId ?? ""} onChange={(e) => set({ productId: e.target.value || null })} className="w-48" aria-label="Product">
          <option value="">All products</option>
          {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <span className="text-xs text-zinc-500">Deadline from</span>
        <Input type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || null })} className="w-36" aria-label="From" />
        <span className="text-xs text-zinc-500">to</span>
        <Input type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} className="w-36" aria-label="To" />
        <Segmented value={filters.granularity} onChange={(v) => set({ granularity: v === "week" ? null : v })} options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
        {(filters.productId || filters.from || filters.to) && <Button variant="ghost" size="sm" onClick={() => set({ productId: null, from: null, to: null })}>Clear</Button>}
      </div>

      {report.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : report.error || !r ? (
        <ErrorState error={report.error} onRetry={report.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="report-summary">
            <Tile label="Total tasks" value={r.summary.total} />
            <Tile label="Completed" value={r.summary.completed} tone="#16a34a" />
            <Tile label="Not completed" value={r.summary.open} />
            <Tile label="Overdue" value={r.summary.overdue} tone="#dc2626" />
            <Tile label="Completed late" value={r.summary.completedLate} tone="#ea580c" />
            <Tile label="On-time rate" value={r.summary.onTimeRate === null ? "—" : `${Math.round(r.summary.onTimeRate * 100)}%`} tone="#2563eb" />
          </div>
          <Card className="flex flex-col gap-3 p-4">
            <SectionTitle>Throughput per {filters.granularity === "week" ? "week" : "month"} <span className="font-normal text-zinc-400">({r.range.from} → {r.range.to})</span></SectionTitle>
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={r.throughput.map((t) => ({ ...t, label: filters.granularity === "week" ? fmtShortDate(t.period) : t.period, onTime: t.completed - t.completedLate }))} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="onTime" stackId="a" name="Completed on time" fill="#16a34a" />
                  <Bar dataKey="completedLate" stackId="a" name="Completed late" fill="#ea580c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <SectionTitle>Progress by product</SectionTitle>
              <Table testId="report-products" head={["Product", "Tasks", "Done", "Overdue", "Progress"]} rows={r.products.map((p) => [p.name, p.total, p.completed, p.overdue ? <span className="text-red-600">{p.overdue}</span> : 0, pctBar(p.progress)])} />
            </div>
            <div className="flex flex-col gap-2">
              <SectionTitle>Workload by assignee</SectionTitle>
              <Table testId="report-workload" head={["Assignee", "Tasks", "Open", "Done", "Overdue", "Late"]} rows={r.workload.map((w) => [w.name, w.total, w.open, w.completed, w.overdue ? <span className="text-red-600">{w.overdue}</span> : 0, w.completedLate])} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <SectionTitle action={<span className="flex items-center gap-1 text-xs text-zinc-400"><Download className="size-3" /> included in exports</span>}>Progress by feature</SectionTitle>
            <Table testId="report-features" head={["Product", "Category", "Feature", "Tasks", "Done", "Overdue", "Progress"]} rows={r.features.map((f) => [f.productName, f.category, f.name, f.total, f.completed, f.overdue ? <span className="text-red-600">{f.overdue}</span> : 0, pctBar(f.progress)])} />
          </div>
        </>
      )}
    </div>
  );
}
