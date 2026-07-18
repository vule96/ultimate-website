import { describe, it, expect } from "vitest";
import { PostSchema } from "@ultimate/types";
import { buildPostMetadata } from "./metadata";

const post = PostSchema.parse({
  id: "a0000000-0000-4000-8000-000000000000",
  title: "Tiêu đề gốc",
  slug: "tieu-de",
  content_json: {},
  content_html: "<p/>",
  excerpt: "tóm tắt bài",
  cover_image: "https://cdn.example/x.png",
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
});

describe("buildPostMetadata", () => {
  it("dùng title khi meta_title null; description = excerpt", () => {
    const m = buildPostMetadata(post);
    expect(m.title).toBe("Tiêu đề gốc");
    expect(m.description).toBe("tóm tắt bài");
  });
  it("ưu tiên meta_title/meta_desc khi có", () => {
    const m = buildPostMetadata({ ...post, meta_title: "SEO title", meta_desc: "SEO desc" });
    expect(m.title).toBe("SEO title");
    expect(m.description).toBe("SEO desc");
  });
  it("OG có type article, cover_image, publishedTime", () => {
    const m = buildPostMetadata(post);
    // Next 16 kiểu OpenGraph là union — `type` chỉ có ở nhánh article; cast để đọc runtime.
    expect((m.openGraph as { type?: string } | undefined)?.type).toBe("article");
    expect(JSON.stringify(m.openGraph?.images)).toContain("https://cdn.example/x.png");
  });
  it("canonical trỏ /blog/<slug>", () => {
    const m = buildPostMetadata(post);
    expect(m.alternates?.canonical).toContain("/blog/tieu-de");
  });
  it("có cover → twitter summary_large_image", () => {
    const m = buildPostMetadata(post);
    expect((m.twitter as { card?: string } | undefined)?.card).toBe("summary_large_image");
  });
  it("không cover → og-default + twitter summary", () => {
    const m = buildPostMetadata({ ...post, cover_image: null });
    expect(JSON.stringify(m.openGraph?.images)).toContain("/og-default.png");
    expect((m.twitter as { card?: string } | undefined)?.card).toBe("summary");
  });
});
