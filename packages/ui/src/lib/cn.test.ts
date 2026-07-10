import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("gộp nhiều class", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("giải xung đột tailwind (class sau thắng)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("bỏ giá trị falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
