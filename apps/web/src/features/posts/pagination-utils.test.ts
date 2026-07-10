import { describe, it, expect } from "vitest";
import { totalPages, pageHref } from "./pagination-utils";

describe("totalPages", () => {
  it("tối thiểu 1 trang khi rỗng", () => expect(totalPages(0, 10)).toBe(1));
  it("làm tròn lên", () => expect(totalPages(25, 10)).toBe(3));
  it("khớp bội số", () => expect(totalPages(20, 10)).toBe(2));
});

describe("pageHref", () => {
  it("trang 1 = basePath (không query)", () => expect(pageHref("/", 1)).toBe("/"));
  it("trang >1 thêm ?page", () => expect(pageHref("/", 2)).toBe("/?page=2"));
  it("giữ basePath phức tạp", () => expect(pageHref("/tags/go", 3)).toBe("/tags/go?page=3"));
});
