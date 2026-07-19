import { describe, it, expect } from "vitest";
import { groupBySection, sectionOfCategory, sectionColorForCategory } from "./sections";
import type { ArticleVM } from "./types";

const mk = (id: string, category: ArticleVM["category"]): ArticleVM => ({
  id,
  slug: id,
  title: id,
  excerpt: "",
  category,
  categoryLabel: category,
  color: "#000",
  date: "2026-07-12T00:00:00Z",
  dateLabel: "12/07/2026",
  readTime: "5 phút",
  coverImage: null,
  blurhash: null,
  author: null,
  views: null,
  comments: null,
});

describe("sections", () => {
  it("sectionOfCategory nhóm đúng; news → undefined", () => {
    expect(sectionOfCategory("it")).toBe("tech");
    expect(sectionOfCategory("ai")).toBe("tech");
    expect(sectionOfCategory("finance")).toBe("finance");
    expect(sectionOfCategory("arch")).toBe("life");
    expect(sectionOfCategory("book")).toBe("dev");
    expect(sectionOfCategory("news")).toBeUndefined();
  });

  it("sectionColorForCategory trả CSS var; news → muted", () => {
    expect(sectionColorForCategory("it")).toBe("var(--sec-tech)");
    expect(sectionColorForCategory("news")).toBe("var(--muted)");
  });

  it("groupBySection gom theo section, giữ thứ tự, bỏ news", () => {
    const arts = [mk("a", "it"), mk("b", "news"), mk("c", "ai"), mk("d", "finance"), mk("e", "it")];
    const g = groupBySection(arts);
    expect(g.tech.map((x) => x.id)).toEqual(["a", "c", "e"]);
    expect(g.finance.map((x) => x.id)).toEqual(["d"]);
    expect(g.life).toEqual([]);
    // news không lọt vào section nào
    expect([...g.tech, ...g.finance, ...g.life, ...g.dev].some((x) => x.id === "b")).toBe(false);
  });
});
