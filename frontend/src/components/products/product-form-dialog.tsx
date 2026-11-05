"use client";

import { useState } from "react";
import { api, fieldErrors, useApiMutation, useUsers } from "@/lib/queries";
import { PRODUCT_STATUSES, PRODUCT_STATUS_META } from "@/lib/format";
import type { ProductStatus, ProductSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { PRODUCT_COLORS, PRODUCT_ICONS, ProductIcon } from "@/components/product-icon";

export function ProductFormDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: ProductSummary | null;
  onSaved?: (p: ProductSummary) => void;
}) {
  // Remount (not an effect) when the dialog opens or targets a different product, so the form always starts fresh.
  return props.open ? <ProductForm key={props.product?.id ?? "new"} {...props} /> : null;
}

function ProductForm({ open, onOpenChange, product, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: ProductSummary | null;
  onSaved?: (p: ProductSummary) => void;
}) {
  const users = useUsers();
  const [form, setForm] = useState(() =>
    product
      ? { name: product.name, description: product.description, icon: product.icon, color: product.color, status: product.status, ownerId: product.owner?.id ?? "", startDate: product.startDate ?? "", deadline: product.deadline ?? "" }
      : { name: "", description: "", icon: "box", color: PRODUCT_COLORS[0], status: "ACTIVE" as ProductStatus, ownerId: "", startDate: "", deadline: "" },
  );

  const save = useApiMutation(
    () => {
      const body = { ...form, ownerId: form.ownerId || null, startDate: form.startDate || null, deadline: form.deadline || null };
      return product ? api.patch<ProductSummary>(`/products/${product.id}`, body) : api.post<ProductSummary>("/products", { ...body, ownerId: body.ownerId ?? undefined, startDate: body.startDate ?? undefined, deadline: body.deadline ?? undefined });
    },
    { success: product ? "Product updated" : "Product created", onSuccess: (p) => { onOpenChange(false); onSaved?.(p); } },
  );
  const errors = fieldErrors(save.error);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="product-form">
        <DialogHeader title={product ? "Edit product" : "New product"} />
        <form id="product-form" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Name" error={errors.name ?? (save.error && !Object.keys(errors).length ? (save.error as Error).message : undefined)} className="col-span-2">
            <Input value={form.name} onChange={set("name")} required autoFocus name="name" />
          </Field>
          <Field label="Description" className="col-span-2">
            <Textarea value={form.description} onChange={set("description")} name="description" />
          </Field>
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-600">Icon & colour</span>
            <div className="flex flex-wrap gap-1">
              {Object.keys(PRODUCT_ICONS).map((name) => (
                <button key={name} type="button" onClick={() => setForm({ ...form, icon: name })} aria-label={`Icon ${name}`} className={cn("rounded-md p-0.5 ring-offset-1", form.icon === name && "ring-2 ring-blue-500")}>
                  <ProductIcon icon={name} color={form.color} size={28} />
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {PRODUCT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-label={`Colour ${c}`} className={cn("size-5 rounded-full ring-offset-1", form.color === c && "ring-2 ring-zinc-900")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")} name="status">
              {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{PRODUCT_STATUS_META[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={form.ownerId} onChange={set("ownerId")} name="ownerId">
              <option value="">No owner</option>
              {users.data?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Start date" error={errors.startDate}>
            <Input type="date" value={form.startDate} onChange={set("startDate")} name="startDate" />
          </Field>
          <Field label="Deadline" error={errors.deadline}>
            <Input type="date" value={form.deadline} onChange={set("deadline")} min={form.startDate || undefined} name="deadline" />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="product-form" disabled={save.isPending} data-testid="product-form-submit">
            {save.isPending ? "Saving…" : product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
