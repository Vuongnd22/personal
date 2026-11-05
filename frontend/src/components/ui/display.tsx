"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Badge({ className, color, children, ...props }: React.ComponentProps<"span"> & { color?: string }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-medium", !color && "bg-zinc-100 text-zinc-700", className)}
      style={color ? { backgroundColor: `${color}14`, color } : undefined}
      {...props}
    >
      {children}
    </span>
  );
}

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${v}%`, backgroundColor: color ?? (v === 100 ? "#16a34a" : "#2563eb") }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zinc-100", className)} />;
}

export function Avatar({ name, color, size = 22 }: { name: string; color?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: color ?? "#71717a" }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 px-6 py-12 text-center">
      <Icon className="size-6 text-zinc-300" />
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-zinc-500">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50/40 px-6 py-10 text-center">
      <AlertTriangle className="size-5 text-red-500" />
      <p className="text-sm font-medium text-zinc-800">Could not load data</p>
      <p className="text-[13px] text-zinc-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Retry
        </Button>
      )}
    </div>
  );
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-zinc-200 bg-white", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold text-zinc-900">{children}</h2>
      {action}
    </div>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-4 border-b border-zinc-200", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px flex h-9 items-center gap-1.5 border-b-2 border-transparent text-[13px] font-medium text-zinc-500 outline-none hover:text-zinc-800 focus-visible:text-zinc-900 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

/** Segmented control for view switchers. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ElementType }[] }) {
  return (
    <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5" role="tablist">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          data-testid={`view-${v}`}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-800",
            value === v && "bg-white text-zinc-900 shadow-sm",
          )}
        >
          {Icon && <Icon className="size-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
