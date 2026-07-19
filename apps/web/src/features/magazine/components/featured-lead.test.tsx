import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { FeaturedLead } from "./featured-lead";
import { useMagazineStore } from "../store/magazine-store";
import type { ArticleVM } from "../types";

vi.mock("next/image", () => ({
  default: (p: { alt: string }) => <img alt={p.alt} />,
}));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const mk = (id: string, title: string, cat: ArticleVM["category"]): ArticleVM => ({
  id,
  slug: id,
  title,
  excerpt: "mô tả " + id,
  category: cat,
  categoryLabel: cat.toUpperCase(),
  color: "#0f6e63",
  date: "2026-07-12T00:00:00Z",
  dateLabel: "12/07/2026",
  readTime: "5 phút",
  blurhash: null,
  coverImage: "https://x/a.jpg",
  author: null,
  views: 1200,
  comments: null,
});

const articles = [
  mk("1", "Bài một", "it"),
  mk("2", "Bài hai", "ai"),
  mk("3", "Bài ba", "finance"),
  mk("4", "Bài bốn", "it"),
];

beforeEach(() => {
  useMagazineStore.setState({ query: "", cat: "all", saved: {}, user: null, authOpen: false, toast: null });
});

describe("FeaturedLead", () => {
  it("hiện đúng 3 bài đầu (1 lead + 2 secondary)", () => {
    renderWithIntl(<FeaturedLead articles={articles} />);
    expect(screen.getByText("Bài một")).toBeInTheDocument();
    expect(screen.getByText("Bài hai")).toBeInTheDocument();
    expect(screen.getByText("Bài ba")).toBeInTheDocument();
    expect(screen.queryByText("Bài bốn")).not.toBeInTheDocument();
  });

  it("lọc theo category — chỉ bài khớp lên lead", () => {
    useMagazineStore.setState({ cat: "it" });
    renderWithIntl(<FeaturedLead articles={articles} />);
    expect(screen.getByText("Bài một")).toBeInTheDocument();
    expect(screen.getByText("Bài bốn")).toBeInTheDocument();
    expect(screen.queryByText("Bài hai")).not.toBeInTheDocument();
  });

  it("dưới 3 bài không vỡ", () => {
    renderWithIntl(<FeaturedLead articles={[mk("1", "Chỉ một", "it")]} />);
    expect(screen.getByText("Chỉ một")).toBeInTheDocument();
  });

  it("ẩn hoàn toàn khi không có bài (search rỗng)", () => {
    const { container } = renderWithIntl(<FeaturedLead articles={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
