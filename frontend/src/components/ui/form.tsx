"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-50 disabled:text-zinc-500 aria-invalid:border-red-500";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(field, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-20 py-1.5 leading-relaxed", className)} {...props} />;
}

/** Native select: accessible, keyboard-friendly, no extra dependency. */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(field, "h-8 pr-7", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-xs font-medium text-zinc-600", className)} {...props} />;
}

export function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  const child = React.isValidElement<{ id?: string; "aria-invalid"?: boolean }>(children)
    ? React.cloneElement(children, { id: children.props.id ?? id, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      {child}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-4 shrink-0 rounded border border-zinc-300 bg-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
