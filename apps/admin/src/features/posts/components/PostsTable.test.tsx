import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Post } from "@ultimate/types";
import { PostsTable } from "./PostsTable";

function makePost(over: Partial<Record<keyof Post, unknown>> = {}): Post {
  return {
    id: "1",
    title: "Bài viết A",
    slug: "bai-viet-a",
    content_json: {},
    content_html: "",
    excerpt: null,
    cover_image: null,
    status: "PUBLISHED",
    meta_title: null,
    meta_desc: null,
    published_at: null,
    tags: [{ id: "t1", name: "Go", slug: "go" }],
    created_at: "2026-07-07T00:00:00Z",
    updated_at: "2026-07-07T00:00:00Z",
    ...over,
  } as unknown as Post;
}

function renderTable(posts: Post[], onDelete = vi.fn()) {
  return render(
    <MemoryRouter>
      <PostsTable posts={posts} onDelete={onDelete} />
    </MemoryRouter>,
  );
}

describe("PostsTable", () => {
  it("renders a row per post with title and tag", () => {
    renderTable([makePost(), makePost({ id: "2", title: "Bài viết B", slug: "b" })]);
    expect(screen.getByText("Bài viết A")).toBeInTheDocument();
    expect(screen.getByText("Bài viết B")).toBeInTheDocument();
    expect(screen.getAllByText("Go")).toHaveLength(2);
  });

  it("shows empty state when there are no posts", () => {
    renderTable([]);
    expect(screen.getByText(/Chưa có bài viết/i)).toBeInTheDocument();
  });
});
