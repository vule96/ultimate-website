import { describe, it, expect } from "vitest";
import { buildPostsQuery } from "./api";

describe("buildPostsQuery", () => {
  it("returns empty string when no params", () => {
    expect(buildPostsQuery({})).toBe("");
  });

  it("includes page and page_size", () => {
    expect(buildPostsQuery({ page: 2, pageSize: 10 })).toBe("?page=2&page_size=10");
  });

  it("omits empty status/tag and blank search", () => {
    expect(buildPostsQuery({ status: "", tag: "", q: "   " })).toBe("");
  });

  it("trims and includes q", () => {
    expect(buildPostsQuery({ q: "  golang " })).toBe("?q=golang");
  });

  it("combines all params", () => {
    const qs = buildPostsQuery({ page: 1, pageSize: 5, status: "PUBLISHED", tag: "go", q: "x" });
    const sp = new URLSearchParams(qs);
    expect(sp.get("page")).toBe("1");
    expect(sp.get("page_size")).toBe("5");
    expect(sp.get("status")).toBe("PUBLISHED");
    expect(sp.get("tag")).toBe("go");
    expect(sp.get("q")).toBe("x");
  });

  it("ignores non-positive page/page_size", () => {
    expect(buildPostsQuery({ page: 0, pageSize: -1 })).toBe("");
  });
});
