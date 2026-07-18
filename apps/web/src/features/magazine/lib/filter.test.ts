import { describe, it, expect } from "vitest";
import { filterArticles } from "./filter";
import type { ArticleVM } from "../types";

const mk = (p: Partial<ArticleVM>): ArticleVM => ({
  id: "1",
  slug: "s",
  title: "",
  excerpt: "",
  category: "it",
  categoryLabel: "IT",
  color: "#000",
  date: "",
  dateLabel: "",
  readTime: "",
  blurhash: null,
  coverImage: null,
  author: null,
  views: null,
  comments: null,
  ...p,
});
const items = [
  mk({ id: "1", title: "Học Go", category: "it", categoryLabel: "IT" }),
  mk({ id: "2", title: "Mạng nơ-ron", category: "ai", categoryLabel: "AI", excerpt: "deep learning" }),
  mk({ id: "3", title: "Cổ phiếu", category: "stock", categoryLabel: "Chứng khoán" }),
];

describe("filterArticles", () => {
  it("cat=all trả hết", () => expect(filterArticles(items, "", "all")).toHaveLength(3));
  it("lọc theo category", () => {
    expect(filterArticles(items, "", "ai").map((i) => i.id)).toEqual(["2"]);
  });
  it("search không phân biệt hoa thường trên title", () => {
    expect(filterArticles(items, "go", "all").map((i) => i.id)).toEqual(["1"]);
  });
  it("search khớp excerpt", () => {
    expect(filterArticles(items, "DEEP", "all").map((i) => i.id)).toEqual(["2"]);
  });
  it("search ∩ category", () => {
    expect(filterArticles(items, "cổ", "ai")).toHaveLength(0);
  });
});
