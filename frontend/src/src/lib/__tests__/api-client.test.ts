import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, setUnauthorizedHandler, ApiError } from "../api-client";

function mockFetchResponse(init: {
  status: number;
  json?: unknown;
  contentType?: string;
}) {
  return vi.fn().mockResolvedValue({
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    statusText: "",
    headers: new Headers({
      "content-type": init.contentType ?? "application/json",
    }),
    json: async () => init.json ?? {},
  });
}

describe("apiRequest", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds a GET request to /api prefixed path with credentials included", async () => {
    const fetchMock = mockFetchResponse({ status: 200, json: { ok: true } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiRequest<{ ok: boolean }>("/health");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(result).toEqual({ ok: true });
  });

  it("serializes a JSON body and sets Content-Type for POST", async () => {
    const fetchMock = mockFetchResponse({ status: 201, json: { id: "1" } });
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest("/products", { method: "POST", body: { name: "X" } });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "X" }));
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("passes FormData through without JSON-encoding it", async () => {
    const fetchMock = mockFetchResponse({ status: 201, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    const form = new FormData();
    form.append("file", "content");
    await apiRequest("/tasks/1/attachments", { method: "POST", body: form });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(form);
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("parses field errors into an ApiError on 400", async () => {
    const fetchMock = mockFetchResponse({
      status: 400,
      json: {
        statusCode: 400,
        message: "Validation failed",
        errors: [{ field: "title", message: "title should not be empty" }],
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiRequest("/tasks", { method: "POST", body: {} })).rejects.toMatchObject({
      statusCode: 400,
      message: "Validation failed",
      fieldErrors: [{ field: "title", message: "title should not be empty" }],
    });
  });

  it("throws ApiError and triggers the unauthorized handler on 401", async () => {
    const fetchMock = mockFetchResponse({
      status: 401,
      json: { statusCode: 401, message: "Unauthorized" },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiRequest("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns undefined for 204 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "",
      headers: new Headers(),
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiRequest("/tasks/1");
    expect(result).toBeUndefined();
  });
});
