import { describe, it, expect } from "vitest";
import { postToArticleVM } from "./article-vm";
import type { Post } from "@ultimate/types";

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
  tags: [{ id: "t" as never, name: "AI", slug: "ai" }],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-12T00:00:00Z",
};

describe("postToArticleVM", () => {
  it("map category từ tag", () => {
    expect(postToArticleVM(base).category).toBe("ai");
    expect(postToArticleVM(base).categoryLabel).toBe("AI");
  });
  it("dùng published_at cho date, fallback created_at khi null", () => {
    expect(postToArticleVM(base).dateLabel).toBe("12/07/2026");
    expect(postToArticleVM({ ...base, published_at: null }).dateLabel).toBe("01/07/2026");
  });
  it("tính readTime từ html", () => {
    expect(postToArticleVM(base).readTime).toBe("1 phút");
  });
  it("field backend chưa có = null", () => {
    const vm = postToArticleVM(base);
    expect(vm.author).toBeNull();
    expect(vm.views).toBeNull();
    expect(vm.comments).toBeNull();
  });
  it("excerpt null → chuỗi rỗng", () => {
    expect(postToArticleVM({ ...base, excerpt: null }).excerpt).toBe("");
  });
  it("không tag → category news", () => {
    expect(postToArticleVM({ ...base, tags: [] }).category).toBe("news");
  });
});
