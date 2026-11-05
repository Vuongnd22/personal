import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import type { EffectiveTaskStatus, ProductStatus, Role, TaskPriority, TaskStatus, User } from "./types";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"];
export const STATUS_META: Record<EffectiveTaskStatus, { label: string; color: string }> = {
  TODO: { label: "Todo", color: "#71717a" },
  IN_PROGRESS: { label: "In Progress", color: "#2563eb" },
  REVIEW: { label: "Review", color: "#d97706" },
  COMPLETED: { label: "Completed", color: "#16a34a" },
  OVERDUE: { label: "Overdue", color: "#dc2626" },
};

export const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; rank: number }> = {
  LOW: { label: "Low", color: "#71717a", rank: 0 },
  MEDIUM: { label: "Medium", color: "#2563eb", rank: 1 },
  HIGH: { label: "High", color: "#ea580c", rank: 2 },
  URGENT: { label: "Urgent", color: "#dc2626", rank: 3 },
};

export const PRODUCT_STATUSES: ProductStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];
export const PRODUCT_STATUS_META: Record<ProductStatus, { label: string; color: string }> = {
  PLANNING: { label: "Planning", color: "#7c3aed" },
  ACTIVE: { label: "Active", color: "#2563eb" },
  ON_HOLD: { label: "On hold", color: "#d97706" },
  COMPLETED: { label: "Completed", color: "#16a34a" },
  ARCHIVED: { label: "Archived", color: "#71717a" },
};

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MANAGER: "Manager", MEMBER: "Member" };

export const canManage = (u?: Pick<User, "role"> | null) => u?.role === "ADMIN" || u?.role === "MANAGER";

/** "YYYY-MM-DD" → "04 Nov 2026"; null → "—". */
export const fmtDate = (d: string | null | undefined) => (d ? format(parseISO(d.slice(0, 10)), "dd MMM yyyy") : "—");
export const fmtShortDate = (d: string | null | undefined) => (d ? format(parseISO(d.slice(0, 10)), "dd MMM") : "—");
export const fmtDateTime = (iso: string) => format(parseISO(iso), "dd MMM yyyy, HH:mm");
export const fmtAgo = (iso: string) => `${formatDistanceToNowStrict(parseISO(iso))} ago`;
export const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** Local calendar date "YYYY-MM-DD". */
export const todayLocal = () => format(new Date(), "yyyy-MM-dd");
