import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError } from "./apiClient";
import { CORE_URL } from "./config";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(body: unknown, init: { status?: number } = {}) {
    const status = init.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      json: async () => body,
    } as Response;
  }

  it("prefixes CORE_URL and sends credentials", async () => {
    const f = vi.mocked(fetch);
    f.mockResolvedValue(mockResponse({ email: "a@x.com" }));

    await apiFetch("/auth/me");

    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`${CORE_URL}/auth/me`);
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("returns parsed JSON on 2xx", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ email: "a@x.com" }));
    const data = await apiFetch<{ email: string }>("/auth/me");
    expect(data).toEqual({ email: "a@x.com" });
  });

  it("returns undefined on 204", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }));
    const data = await apiFetch("/auth/logout", { method: "POST" });
    expect(data).toBeUndefined();
  });

  it("throws ApiError with status + code on non-2xx", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ error: { code: "UNAUTHORIZED", message: "nope" } }, { status: 401 }),
    );
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(ApiError);
  });
});
