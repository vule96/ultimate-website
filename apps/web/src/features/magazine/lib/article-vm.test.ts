import { describe, it, expect } from "vitest";
import { postToArticleVM, type ArticleVMLabels } from "./article-vm";
import type { Post } from "@ultimate/types";

// Labels stub — bản vi tĩnh cho test (production bơm từ next-intl).
const labels: ArticleVMLabels = {
  category: (key) => (key === "ai" ? "AI" : key === "news" ? "Tin tức" : key),
  readTime: (minutes) => `${minutes} phút`,
};

const base: Post = {
  id: "11111111-1111-1111-1111-111111111111" as Post["id"],
  title: "Bài mẫu",
  slug: "bai-mau",
  content_json: {},
  content_html: "<p>" + Array(200).fill("x").join(" ") + "</p>",
  excerpt: "Mô tả ngắn",
  cover_image: "https://x/i.jpg",
  status: "PUBLISHED",
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-12T10:00:00Z",
  version: 1,
  cover_blurhash: null,
  views: 0,
  tags: [{ id: "t" as never, name: "AI", slug: "ai" }],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-12T00:00:00Z",
};

describe("postToArticleVM", () => {
  it("map category từ tag", () => {
    expect(postToArticleVM(base, labels).category).toBe("ai");
    expect(postToArticleVM(base, labels).categoryLabel).toBe("AI");
  });
  it("dùng published_at cho date, fallback created_at khi null", () => {
    expect(postToArticleVM(base, labels).dateLabel).toBe("12/07/2026");
    expect(postToArticleVM({ ...base, published_at: null }, labels).dateLabel).toBe("01/07/2026");
  });
  it("tính readTime từ html", () => {
    expect(postToArticleVM(base, labels).readTime).toBe("1 phút");
  });
  it("field backend chưa có = null", () => {
    const vm = postToArticleVM(base, labels);
    expect(vm.author).toBeNull();
    expect(vm.views).toBeNull();
    expect(vm.comments).toBeNull();
  });
  it("excerpt null → chuỗi rỗng", () => {
    expect(postToArticleVM({ ...base, excerpt: null }, labels).excerpt).toBe("");
  });
  it("không tag → category news", () => {
    expect(postToArticleVM({ ...base, tags: [] }, labels).category).toBe("news");
  });
});
