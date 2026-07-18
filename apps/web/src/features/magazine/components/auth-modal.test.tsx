import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { AuthModal } from "./auth-modal";

vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePathname: () => "/blog/x",
}));

describe("AuthModal", () => {
  it("hiện nút Google với returnTo trỏ về BFF core", () => {
    renderWithIntl(<AuthModal />);
    const link = screen.getByRole("link", { name: /Google/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/auth/reader/google/login?returnTo=" + encodeURIComponent("/blog/x")),
    );
  });
});
