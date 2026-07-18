import { describe, it, expect, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { AuthModal } from "./auth-modal";

describe("AuthModal", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("hiện nút Google với returnTo trỏ về BFF core (giữ nguyên path hiện tại, kể cả locale prefix)", () => {
    window.history.pushState({}, "", "/en/blog/x?foo=1");
    renderWithIntl(<AuthModal />);
    const link = screen.getByRole("link", { name: /Google/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/auth/reader/google/login?returnTo=" + encodeURIComponent("/en/blog/x?foo=1"),
      ),
    );
  });
});
