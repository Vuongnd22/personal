"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Eye, FolderKanban, Layers, ListTodo, Loader } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboard } from "@/lib/queries";
import { fmtShortDate, STATUS_META } from "@/lib/format";
import { Card, ErrorState, SectionTitle, Skeleton } from "@/components/ui/display";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/products/product-card";

const AXIS = { fontSize: 11, fill: "#71717a" };

function StatTile({ label, value, icon: Icon, color, href, testId }: { label: string; value: number; icon: React.ElementType; color?: string; href?: string; testId: string }) {
  const body = (
    <Card className="flex items-center gap-3 p-4 hover:border-zinc-300" data-testid={testId}>
      <span className="flex size-9 items-center justify-center rounded-md" style={{ backgroundColor: `${color ?? "#71717a"}14`, color: color ?? "#71717a" }}><Icon className="size-4" /></span>
      <div>
        <div className="text-[20px] font-semibold tabular-nums leading-tight" data-testid={`${testId}-value`}>{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="h-56">{children}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();
  if (isLoading) return <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (error || !data) return <div className="p-6"><ErrorState error={error} onRetry={refetch} /></div>;
  const t = data.totals;
  const trend = data.completionTrend.map((w) => ({ ...w, label: fmtShortDate(w.weekStart) }));
  const overdueByProduct = data.productProgress.filter((p) => p.overdueCount > 0).sort((a, b) => b.overdueCount - a.overdueCount);
  const statuses = data.statusDistribution.filter((s) => s.count > 0);

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader title="Dashboard" description="Live overview of every product, feature and task." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stat-tiles">
        <StatTile testId="stat-products" label="Products" value={t.products} icon={FolderKanban} color="#2563eb" href="/products" />
        <StatTile testId="stat-features" label="Features" value={t.features} icon={Layers} color="#7c3aed" />
        <StatTile testId="stat-tasks" label="Tasks" value={t.tasks} icon={ListTodo} color="#18181b" href="/tasks" />
        <StatTile testId="stat-completed" label="Completed" value={t.completed} icon={CheckCircle2} color={STATUS_META.COMPLETED.color} href="/tasks?status=COMPLETED" />
        <StatTile testId="stat-in-progress" label="In progress" value={t.inProgress} icon={Loader} color={STATUS_META.IN_PROGRESS.color} href="/tasks?status=IN_PROGRESS" />
        <StatTile testId="stat-review" label="In review" value={t.review} icon={Eye} color={STATUS_META.REVIEW.color} href="/tasks?status=REVIEW" />
        <StatTile testId="stat-todo" label="Not started" value={t.todo} icon={CircleDashed} color={STATUS_META.TODO.color} href="/tasks?status=TODO" />
        <StatTile testId="stat-overdue" label="Overdue" value={t.overdue} icon={AlertTriangle} color={STATUS_META.OVERDUE.color} href="/tasks/overdue" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard title="Task completion over time (last 12 weeks)">
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completedLate" name="Completed late" stroke="#ea580c" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="created" name="Created" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Completion by product">
          <ResponsiveContainer>
            <BarChart data={data.productProgress} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid stroke="#f4f4f5" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Bar dataKey="progress" name="Progress" radius={[0, 3, 3, 0]} barSize={12}>
                {data.productProgress.map((p) => <Cell key={p.productId} fill={p.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tasks by status">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={statuses} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={1}>
                {statuses.map((s) => <Cell key={s.status} fill={STATUS_META[s.status].color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v, n) => [v, STATUS_META[n as keyof typeof STATUS_META]?.label ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => STATUS_META[v as keyof typeof STATUS_META]?.label ?? v} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Overdue tasks by product">
          {overdueByProduct.length ? (
            <ResponsiveContainer>
              <BarChart data={overdueByProduct} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="overdueCount" name="Overdue" fill="#dc2626" radius={[3, 3, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">No overdue tasks</div>
          )}
        </ChartCard>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle action={<Link href="/products" className="text-xs text-blue-600 hover:underline">All products →</Link>}>Products</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}
