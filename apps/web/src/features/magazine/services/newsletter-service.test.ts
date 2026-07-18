import { describe, it, expect, vi } from "vitest";
import { apiNewsletterService } from "./newsletter-service";

describe("apiNewsletterService", () => {
  it("subscribe gọi POST /subscribers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    await apiNewsletterService.subscribe("a@b.com");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/subscribers");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body).email).toBe("a@b.com");
  });

  it("subscribe ném lỗi khi 400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(apiNewsletterService.subscribe("bad")).rejects.toThrow();
  });
});
