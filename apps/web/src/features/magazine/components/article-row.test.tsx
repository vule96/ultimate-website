import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArticleRow } from "./article-row";
import type { ArticleVM } from "../types";

vi.mock("next/image", () => ({
  default: (p: { alt: string }) => <img alt={p.alt} />,
}));

const vm: ArticleVM = {
  id: "a1",
  slug: "hoc-go",
  title: "Học Go",
  excerpt: "mô tả",
  category: "it",
  categoryLabel: "IT",
  color: "#2f6df6",
  date: "2026-07-12T00:00:00Z",
  dateLabel: "12/07/2026",
  readTime: "5 phút",
  coverImage: null,
  author: null,
  views: null,
  comments: null,
};

describe("ArticleRow", () => {
  it("hiện tiêu đề + read time; ẩn author/views/comments khi null", () => {
    render(<ArticleRow article={vm} index={0} saved={false} onToggleSave={() => {}} onOpen={() => {}} />);
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.getByText("5 phút")).toBeInTheDocument();
    expect(screen.queryByText(/bình luận/)).not.toBeInTheDocument();
  });

  it("click sao gọi onToggleSave, không bubble sang onOpen", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<ArticleRow article={vm} index={0} saved={false} onToggleSave={onToggle} onOpen={onOpen} />);
    fireEvent.click(screen.getByLabelText("Lưu bài viết"));
    expect(onToggle).toHaveBeenCalledWith("a1");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
