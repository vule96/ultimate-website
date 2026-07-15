import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { MagazineBoard } from "./magazine-board";
import { useMagazineStore } from "../store/magazine-store";
import type { ArticleVM } from "../types";

vi.mock("next/image", () => ({
  default: (p: { alt: string }) => <img alt={p.alt} />,
}));
const push = vi.fn();
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/",
}));

const mk = (id: string, title: string, cat: ArticleVM["category"]): ArticleVM => ({
  id,
  slug: id,
  title,
  excerpt: "",
  category: cat,
  categoryLabel: cat.toUpperCase(),
  color: "#000",
  date: "",
  dateLabel: "01/01/2026",
  readTime: "1 phút",
  coverImage: null,
  author: null,
  views: null,
  comments: null,
});
const articles = [mk("1", "Học Go", "it"), mk("2", "Mạng nơ-ron", "ai")];

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  useMagazineStore.setState({
    query: "",
    cat: "all",
    saved: {},
    user: null,
    authOpen: false,
    authMode: "login",
    toast: null,
  });
});

describe("MagazineBoard", () => {
  it("render toàn bộ bài mặc định", () => {
    renderWithIntl(<MagazineBoard articles={articles} topViewed={[]} />);
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.getByText("Mạng nơ-ron")).toBeInTheDocument();
  });

  it("search lọc danh sách", () => {
    renderWithIntl(<MagazineBoard articles={articles} topViewed={[]} />);
    fireEvent.change(screen.getByPlaceholderText(/Tìm bài viết/), { target: { value: "go" } });
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.queryByText("Mạng nơ-ron")).not.toBeInTheDocument();
  });

  it("lưu khi chưa login → mở auth modal", () => {
    renderWithIntl(<MagazineBoard articles={articles} topViewed={[]} />);
    fireEvent.click(screen.getAllByLabelText("Lưu bài viết")[0]);
    expect(useMagazineStore.getState().authOpen).toBe(true);
  });
});
