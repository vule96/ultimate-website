import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { PostCard } from "./post-card";
import type { Post } from "@ultimate/types";

const fixture: Post = {
  id: "11111111-1111-1111-1111-111111111111" as Post["id"],
  title: "Bài mẫu row Mạch",
  slug: "bai-mau-row",
  content_json: {},
  content_html: "<p>" + Array(200).fill("x").join(" ") + "</p>",
  excerpt: "Mô tả ngắn cho row",
  cover_image: "https://picsum.photos/400/300",
  cover_blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
  status: "PUBLISHED",
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-12T10:00:00Z",
  version: 1,
  views: 0,
  tags: [{ id: "t" as never, name: "AI", slug: "ai" }],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-12T00:00:00Z",
};

describe("PostCard (row Mạch)", () => {
  it("render title + kicker tag đầu + excerpt", () => {
    renderWithIntl(<PostCard post={fixture} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Bài mẫu row Mạch");
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Mô tả ngắn cho row")).toBeInTheDocument();
  });

  it("có cover → khung thumbnail cố định (chống CLS) + blurhash canvas", () => {
    const { container } = renderWithIntl(<PostCard post={fixture} />);
    expect(container.querySelector("[data-thumb]")).not.toBeNull();
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("không cover → không có khung thumbnail", () => {
    const { container } = renderWithIntl(<PostCard post={{ ...fixture, cover_image: null }} />);
    expect(container.querySelector("[data-thumb]")).toBeNull();
  });
});
