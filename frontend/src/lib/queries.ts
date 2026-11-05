"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest, ApiError } from "./api-client";
import { buildQueryString, type QueryParams } from "./query-string";
import type {
  ArchitectureDiagram, Attachment, Comment, DashboardData, FeatureSummary, HistoryEntry, Notification,
  ProductSummary, ReportsData, TaskDetail, TasksQuery, TasksResponse, User,
} from "./types";

const get = <T,>(path: string) => () => apiRequest<T>(path);

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: get<User>("/auth/me"), retry: false, staleTime: 60_000 });
export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: get<User[]>("/users"), staleTime: 60_000 });

export const useProducts = (params: QueryParams = {}) =>
  useQuery({ queryKey: ["products", params], queryFn: get<ProductSummary[]>(`/products${buildQueryString(params)}`) });
export const useProduct = (id: string) => useQuery({ queryKey: ["product", id], queryFn: get<ProductSummary>(`/products/${id}`), enabled: !!id });
export const useFeatures = (productId: string) =>
  useQuery({ queryKey: ["features", productId], queryFn: get<FeatureSummary[]>(`/products/${productId}/features`), enabled: !!productId });

export const useTasks = (query: TasksQuery, enabled = true) =>
  useQuery({
    queryKey: ["tasks", query],
    queryFn: get<TasksResponse>(`/tasks${buildQueryString(query as QueryParams)}`),
    enabled,
    placeholderData: (prev) => prev,
  });
export const useTask = (id: string | null) => useQuery({ queryKey: ["task", id], queryFn: get<TaskDetail>(`/tasks/${id}`), enabled: !!id });
export const useComments = (id: string) => useQuery({ queryKey: ["task", id, "comments"], queryFn: get<Comment[]>(`/tasks/${id}/comments`) });
export const useAttachments = (id: string) => useQuery({ queryKey: ["task", id, "attachments"], queryFn: get<Attachment[]>(`/tasks/${id}/attachments`) });
export const useHistory = (id: string) => useQuery({ queryKey: ["task", id, "history"], queryFn: get<HistoryEntry[]>(`/tasks/${id}/history`) });

export const useArchitecture = (productId: string) =>
  useQuery({ queryKey: ["architecture", productId], queryFn: get<ArchitectureDiagram>(`/products/${productId}/architecture`), enabled: !!productId });
export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: get<DashboardData>("/dashboard") });
export const useReports = (params: QueryParams) =>
  useQuery({ queryKey: ["reports", params], queryFn: get<ReportsData>(`/reports${buildQueryString(params)}`), placeholderData: (p) => p });
export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: get<{ items: Notification[]; unreadCount: number }>("/notifications"),
    refetchInterval: 60_000,
  });
export const useOverdueCount = () =>
  useQuery({ queryKey: ["tasks", "overdue-count"], queryFn: get<TasksResponse>("/tasks?status=OVERDUE&pageSize=1"), select: (d) => d.total });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/**
 * Mutation that, on success, refetches every cached query except the session/user list,
 * so counters, progress and the dashboard stay in sync across screens (spec §7.2).
 */
// ponytail: invalidates all data queries after any write; scope per key if the app grows enough for refetch cost to matter.
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string; onSuccess?: (result: TResult, vars: TVars) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      await qc.invalidateQueries({ predicate: (q) => !["me", "users"].includes(q.queryKey[0] as string) });
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(result, vars);
    },
    onError: (e) => {
      if (!opts.silentError && !(e instanceof ApiError && e.fieldErrors.length)) toast.error(errorMessage(e));
    },
  });
}

export const api = {
  post: <T = unknown,>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  patch: <T = unknown,>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  put: <T = unknown,>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  del: <T = unknown,>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

/** Field-level messages from a 400 response, keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message]));
}
