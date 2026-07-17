import { describe, expect, it } from "vitest";
import { pickRelated } from "./related";
import type { Post } from "@ultimate/types";

const mk = (slug: string) => ({ slug }) as Post;

describe("pickRelated", () => {
  it("loại bài hiện tại", () => {
    expect(pickRelated([mk("a"), mk("b")], "a").map((p) => p.slug)).toEqual(["b"]);
  });

  it("cắt tối đa limit", () => {
    expect(pickRelated([mk("a"), mk("b"), mk("c"), mk("d")], "x", 3)).toHaveLength(3);
  });

  it("rỗng khi chỉ có bài hiện tại", () => {
    expect(pickRelated([mk("a")], "a")).toEqual([]);
  });
});
