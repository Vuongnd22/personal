import type { ApiErrorShape, FieldError } from "./types";

export class ApiError extends Error {
  statusCode: number;
  fieldErrors: FieldError[];

  constructor(statusCode: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorShape> | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const message = body?.message ?? response.statusText ?? "Request failed";
  const fieldErrors = body?.errors ?? [];
  return new ApiError(response.status, message, fieldErrors);
}
