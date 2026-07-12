import { describe, it, expect } from "vitest";
import {
  postFormSchema,
  parseTagsCsv,
  toUpsertInput,
  postToFormValues,
  emptyPostForm,
} from "./formSchema";
import type { Post } from "@ultimate/types";

describe("postFormSchema", () => {
  it("rejects empty title", () => {
    const r = postFormSchema.safeParse({ ...emptyPostForm, title: "  " });
    expect(r.success).toBe(false);
  });

  it("accepts a valid form", () => {
    const r = postFormSchema.safeParse({ ...emptyPostForm, title: "Hello" });
    expect(r.success).toBe(true);
  });
});

describe("parseTagsCsv", () => {
  it("splits, trims, drops empties", () => {
    expect(parseTagsCsv(" Go , Backend ,, ")).toEqual(["Go", "Backend"]);
  });
  it("returns empty array for blank", () => {
    expect(parseTagsCsv("   ")).toEqual([]);
  });
});

describe("toUpsertInput", () => {
  it("maps fields and nulls empty optionals", () => {
    const input = toUpsertInput({
      ...emptyPostForm,
      title: " Hi ",
      content: "<p>x</p>",
      tagsCsv: "Go, Rust",
      status: "PUBLISHED",
    });
    expect(input.title).toBe("Hi");
    expect(input.content_html).toBe("<p>x</p>");
    expect(input.content_json).toEqual({});
    expect(input.status).toBe("PUBLISHED");
    expect(input.tags).toEqual(["Go", "Rust"]);
    expect(input.excerpt).toBeNull();
    expect(input.meta_title).toBeNull();
    expect("slug" in input).toBe(false); // slug bỏ trống → không gửi
  });

  it("includes slug when provided", () => {
    const input = toUpsertInput({ ...emptyPostForm, title: "Hi", slug: " my-slug " });
    expect(input.slug).toBe("my-slug");
  });
});

describe("postToFormValues", () => {
  it("maps a Post to form values", () => {
    const post = {
      id: "id",
      title: "T",
      slug: "t",
      content_json: {},
      content_html: "<p>c</p>",
      excerpt: null,
      cover_image: null,
      status: "DRAFT",
      meta_title: "MT",
      meta_desc: null,
      published_at: null,
      version: 1,
      tags: [{ id: "1", name: "Go", slug: "go" }],
      created_at: "2026-07-07T00:00:00Z",
      updated_at: "2026-07-07T00:00:00Z",
    } as unknown as Post;
    const v = postToFormValues(post);
    expect(v.title).toBe("T");
    expect(v.tagsCsv).toBe("Go");
    expect(v.content).toBe("<p>c</p>");
    expect(v.excerpt).toBe("");
    expect(v.metaTitle).toBe("MT");
  });
});
