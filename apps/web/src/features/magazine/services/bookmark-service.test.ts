import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiBookmarkService } from "./bookmark-service";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

describe("apiBookmarkService", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("load gọi GET /readers/me/bookmarks với credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ["p1", "p2"],
    });
    vi.stubGlobal("fetch", fetchMock);
    const set = await apiBookmarkService.load();
    expect(set.has("p1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/v1/readers/me/bookmarks`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("load trả Set rỗng khi response không ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const set = await apiBookmarkService.load();
    expect(set.size).toBe(0);
  });

  it("add gọi PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await apiBookmarkService.add("p1");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/v1/readers/me/bookmarks/p1`,
      expect.objectContaining({ method: "PUT", credentials: "include" }),
    );
  });

  it("add ném lỗi khi response không ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(apiBookmarkService.add("p1")).rejects.toThrow();
  });

  it("remove gọi DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await apiBookmarkService.remove("p1");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/v1/readers/me/bookmarks/p1`,
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("remove ném lỗi khi response không ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(apiBookmarkService.remove("p1")).rejects.toThrow();
  });
});
