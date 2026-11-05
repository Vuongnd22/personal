"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  AlertTriangle, BarChart3, Bell, CheckSquare, ChevronsLeft, ChevronsRight, FolderKanban, LayoutDashboard, ListTodo,
  LogOut, Network, Search, Settings, UserCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { api, useNotifications, useOverdueCount, useProduct, useProducts, useTasks } from "@/lib/queries";
import { fmtAgo, ROLE_LABEL } from "@/lib/format";
import { useOpenTask } from "@/lib/url";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui/display";
import {
  Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip,
} from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/product-icon";
import { TaskSheet } from "@/components/tasks/task-sheet";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: FolderKanban },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/tasks/my", label: "My Tasks", icon: UserCheck },
  { href: "/tasks", label: "All Tasks", icon: ListTodo, exact: true },
  { href: "/tasks/overdue", label: "Overdue Tasks", icon: AlertTriangle, badge: "overdue" as const },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // Reads a browser-only API (localStorage/window) after mount: must run post-render to avoid an
    // SSR hydration mismatch, so the one-time setState here is the correct pattern, not an anti-pattern.
    try {
      const stored = localStorage.getItem("ab.sidebar");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(stored ? stored === "collapsed" : window.innerWidth < 1024);
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("ab.sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  return [collapsed, toggle] as const;
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const overdue = useOverdueCount();
  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-150", collapsed ? "w-14" : "w-56")} data-testid="sidebar">
      <div className="flex h-12 items-center gap-2 border-b border-zinc-100 px-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white">
          <Network className="size-4" />
        </span>
        {!collapsed && <span className="text-[14px] font-semibold tracking-tight">ArchBoard</span>}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          const count = badge === "overdue" ? overdue.data : undefined;
          const link = (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                active && "bg-zinc-100 text-zinc-900",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && !!count && <span className="rounded bg-red-50 px-1.5 text-[11px] font-semibold text-red-600" data-testid="overdue-badge">{count}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={href} content={label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
      <button
        onClick={onToggle}
        className="flex h-10 items-center gap-2 border-t border-zinc-100 px-4 text-xs text-zinc-500 hover:text-zinc-900"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        data-testid="sidebar-toggle"
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
      </button>
    </aside>
  );
}

const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard", products: "Products", architecture: "Architecture", tasks: "Tasks", reports: "Reports", settings: "Settings",
};

function Breadcrumb() {
  const pathname = usePathname();
  const [section, id] = pathname.split("/").filter(Boolean);
  const isProductRoute = (section === "products" || section === "architecture") && !!id;
  const product = useProduct(isProductRoute ? id : "");
  const sub = section === "tasks" ? (id === "my" ? "My Tasks" : id === "overdue" ? "Overdue" : "All") : null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link href={`/${section ?? "dashboard"}`} className="text-zinc-500 hover:text-zinc-900">{SECTION_LABEL[section] ?? "Dashboard"}</Link>
      {(isProductRoute || sub) && <span className="text-zinc-300">/</span>}
      {isProductRoute && <span className="truncate font-medium text-zinc-900">{product.data?.name ?? "…"}</span>}
      {sub && <span className="font-medium text-zinc-900">{sub}</span>}
    </div>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const products = useProducts(debounced ? { search: debounced } : {});
  const tasks = useTasks({ search: debounced, pageSize: 8, sort: "updatedAt", order: "desc" }, open && !!debounced);
  const go = (url: string) => {
    setOpen(false);
    setQ("");
    router.push(url);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-64 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-400 hover:border-zinc-300 max-md:w-8 max-md:justify-center max-md:px-0"
        data-testid="global-search"
        aria-label="Search"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left max-md:hidden">Search products, tasks…</span>
        <kbd className="rounded border border-zinc-200 bg-white px-1 text-[10px] max-md:hidden">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15vh] max-w-xl gap-0 p-0" aria-describedby={undefined}>
          <Command shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3">
              <Search className="size-4 text-zinc-400" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search products and tasks…" className="h-11 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-zinc-500">No results</Command.Empty>
              {!!products.data?.length && (
                <Command.Group heading="Products" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500">
                  {products.data.slice(0, 6).map((p) => (
                    <Command.Item key={p.id} value={`p-${p.id}`} onSelect={() => go(`/products/${p.id}`)} className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-[13px] data-[selected=true]:bg-zinc-100">
                      <ProductIcon icon={p.icon} color={p.color} size={20} /> {p.name}
                      <span className="ml-auto text-xs text-zinc-400">{p.progress}%</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!!debounced && !!tasks.data?.items.length && (
                <Command.Group heading="Tasks" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-zinc-500">
                  {tasks.data.items.map((t) => (
                    <Command.Item key={t.id} value={`t-${t.id}`} onSelect={() => go(`/products/${t.product.id}?tab=tasks&task=${t.id}`)} className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-[13px] data-[selected=true]:bg-zinc-100">
                      <CheckSquare className="size-4 text-zinc-400" /> <span className="truncate">{t.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-zinc-400">{t.product.name} · {t.feature.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationsBell() {
  const { data } = useNotifications();
  const qc = useQueryClient();
  const openTask = useOpenTask();
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" data-testid="notifications-bell" className="relative">
          <Bell />
          {!!data?.unreadCount && (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-semibold text-white" data-testid="unread-count">
              {data.unreadCount > 99 ? "99+" : data.unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
          <span className="text-[13px] font-semibold">Notifications</span>
          <Button variant="link" size="sm" disabled={!data?.unreadCount} onClick={() => api.post("/notifications/read-all").then(refresh)}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length && <p className="px-3 py-8 text-center text-[13px] text-zinc-500">You&apos;re all caught up</p>}
          {data?.items.map((n) => (
            <button
              key={n.id}
              className={cn("flex w-full flex-col gap-0.5 border-b border-zinc-50 px-3 py-2 text-left hover:bg-zinc-50", !n.readAt && "bg-blue-50/40")}
              onClick={async () => {
                if (!n.readAt) await api.patch(`/notifications/${n.id}/read`).then(refresh);
                if (n.taskId) openTask(n.taskId);
              }}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-800">
                {!n.readAt && <span className="size-1.5 rounded-full bg-blue-600" />}
                {n.title}
              </span>
              {n.body && <span className="text-xs text-zinc-500">{n.body}</span>}
              <span className="text-[11px] text-zinc-400">{fmtAgo(n.createdAt)}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = async () => {
    await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
    qc.clear();
    router.replace("/login");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-100" data-testid="user-menu" aria-label="User menu">
          <Avatar name={user.name} color={user.avatarColor} size={24} />
          <span className="text-[13px] font-medium max-lg:hidden">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="font-medium text-zinc-900">{user.name}</div>
          <div>{user.email} · <Badge>{ROLE_LABEL[user.role]}</Badge></div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}><Settings /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={logout} data-testid="logout"><LogOut /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  return (
    <div className="flex h-full">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
          <Breadcrumb />
          <div className="ml-auto flex items-center gap-1.5">
            <GlobalSearch />
            <NotificationsBell />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
      <TaskSheet />
    </div>
  );
}
