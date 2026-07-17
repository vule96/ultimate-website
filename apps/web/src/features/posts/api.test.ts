import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPublishedQuery, getPublishedBySlug, listPublished } from "./api";

const basePost = {
  id: "a0000000-0000-4000-8000-000000000000",
  title: "Xin chào",
  slug: "xin-chao",
  content_json: {},
  content_html: "<p>hi</p>",
  excerpt: "tóm tắt",
  cover_image: null,
  status: "PUBLISHED",
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-01T00:00:00Z",
  version: 1,
  cover_blurhash: null,
  content_image_meta: null,
  views: 0,
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("buildPublishedQuery", () => {
  it("luôn gắn status=PUBLISHED và page_size", () => {
    const q = buildPublishedQuery({});
    expect(q).toContain("status=PUBLISHED");
    expect(q).toContain("page_size=10");
  });
  it("thêm tag khi có", () => {
    expect(buildPublishedQuery({ tag: "go" })).toContain("tag=go");
  });
});

describe("listPublished", () => {
  it("gọi fetch với status=PUBLISHED", async () => {
    const fn = stubFetch(200, { data: [basePost], page: 1, page_size: 10, total: 1 });
    const res = await listPublished({ page: 2 });
    expect(res.total).toBe(1);
    expect(String(fn.mock.calls[0][0])).toContain("status=PUBLISHED");
    expect(String(fn.mock.calls[0][0])).toContain("page=2");
  });
});

describe("getPublishedBySlug", () => {
  it("trả post khi PUBLISHED", async () => {
    stubFetch(200, basePost);
    const p = await getPublishedBySlug("xin-chao");
    expect(p?.slug).toBe("xin-chao");
  });
  it("trả null khi DRAFT (chống lộ bài nháp)", async () => {
    stubFetch(200, { ...basePost, status: "DRAFT" });
    expect(await getPublishedBySlug("xin-chao")).toBeNull();
  });
  it("trả null khi core 404", async () => {
    stubFetch(404, { error: { code: "NOT_FOUND", message: "x" } });
    expect(await getPublishedBySlug("khong-co")).toBeNull();
  });
});
