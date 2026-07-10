import { describe, it, expect } from "vitest";
import { PostSchema } from "@ultimate/types";
import { buildRssXml } from "./rss";

const post = PostSchema.parse({
  id: "a0000000-0000-4000-8000-000000000000",
  title: "A & B <script>",
  slug: "a-b",
  content_json: {},
  content_html: "<p/>",
  excerpt: "mô tả",
  cover_image: null,
  status: "PUBLISHED",
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-01T00:00:00Z",
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
});

describe("buildRssXml", () => {
  it("sinh khung RSS 2.0 hợp lệ", () => {
    const xml = buildRssXml([post], "https://site.test", "Ultimate website");
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("https://site.test/blog/a-b");
  });
  it("escape ký tự đặc biệt trong title", () => {
    const xml = buildRssXml([post], "https://site.test", "S");
    expect(xml).toContain("A &amp; B &lt;script&gt;");
    expect(xml).not.toContain("<script>");
  });
  it("rỗng khi không có bài", () => {
    const xml = buildRssXml([], "https://site.test", "S");
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
