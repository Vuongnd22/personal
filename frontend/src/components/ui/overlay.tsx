"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./button";

const overlay = "fixed inset-0 z-50 bg-zinc-950/20";

// ---- Dialog ----------------------------------------------------------------------------------
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-50 flex max-h-[80vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-lg outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1 pr-6">
      <DialogPrimitive.Title className="text-[15px] font-semibold text-zinc-900">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-[13px] text-zinc-500">{description}</DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 pt-1", className)} {...props} />;
}

// ---- Sheet (right side panel) ----------------------------------------------------------------
export function Sheet({ open, onOpenChange, title, children, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l border-zinc-200 bg-white shadow-xl outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---- Confirm dialog --------------------------------------------------------------------------
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Delete", onConfirm, pending, destructive = true, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className="fixed left-1/2 top-[20vh] z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-lg">
          <AlertPrimitive.Title className="text-[15px] font-semibold">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description asChild>
            <div className="text-[13px] leading-relaxed text-zinc-600">{description}</div>
          </AlertPrimitive.Description>
          {children}
          <div className="flex justify-end gap-2 pt-1">
            <AlertPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>Cancel</AlertPrimitive.Cancel>
            <Button variant={destructive ? "destructive" : "primary"} disabled={pending} onClick={onConfirm} data-testid="confirm-button">
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}

// ---- Dropdown menu ---------------------------------------------------------------------------
export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={4}
        className={cn("z-50 min-w-44 rounded-md border border-zinc-200 bg-white p-1 text-[13px] shadow-md", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-zinc-100 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-zinc-500",
        destructive && "text-red-600 [&_svg]:text-red-500",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2 py-1.5 text-xs text-zinc-500", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <MenuPrimitive.Separator className="my-1 h-px bg-zinc-100" />;
}

// ---- Tooltip ---------------------------------------------------------------------------------
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "bottom" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 rounded bg-zinc-900 px-2 py-1 text-xs text-white">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---- Popover ---------------------------------------------------------------------------------
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, align = "end", ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 rounded-lg border border-zinc-200 bg-white shadow-lg outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
