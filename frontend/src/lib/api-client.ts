import { ApiError, parseApiError } from "./api-error";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  const headers: Record<string, string> = {};
  let requestBody: BodyInit | undefined;

  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: requestBody,
    credentials: "include",
    signal,
  });

  if (response.status === 401) {
    onUnauthorized?.();
    throw await parseApiError(response);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (response.status === 401) {
    onUnauthorized?.();
    throw await parseApiError(response);
  }
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response.blob();
}

export { ApiError };
