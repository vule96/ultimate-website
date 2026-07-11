import { describe, it, expect } from "vitest";
import { totalPages, pageHref } from "./pagination-utils";

describe("totalPages", () => {
  it("tối thiểu 1 trang khi rỗng", () => expect(totalPages(0, 10)).toBe(1));
  it("làm tròn lên", () => expect(totalPages(25, 10)).toBe(3));
  it("khớp bội số", () => expect(totalPages(20, 10)).toBe(2));
});

describe("pageHref (path-based)", () => {
  it("trang 1 → basePath nguyên vẹn", () => {
    expect(pageHref("/", 1)).toBe("/");
    expect(pageHref("/tags/go", 1)).toBe("/tags/go");
  });
  it("trang N≥2 → path segment /page/N", () => {
    expect(pageHref("/tags/go", 3)).toBe("/tags/go/page/3");
  });
  it("basePath='/' → /page/N (không thành //page/N)", () => {
    expect(pageHref("/", 2)).toBe("/page/2");
  });
});
