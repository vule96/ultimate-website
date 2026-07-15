import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterBox } from "./newsletter-box";

describe("NewsletterBox", () => {
  it("email sai → báo lỗi inline + aria-invalid", async () => {
    render(<NewsletterBox variant="rail" />);
    await userEvent.type(screen.getByPlaceholderText("Email của bạn"), "sai");
    await userEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Email không hợp lệ.");
    expect(screen.getByPlaceholderText("Email của bạn")).toHaveAttribute("aria-invalid", "true");
  });

  it("email đúng → hiện success inline thay form", async () => {
    render(<NewsletterBox variant="footer" />);
    await userEvent.type(screen.getByPlaceholderText("Email của bạn"), "a@b.vn");
    await userEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(await screen.findByText(/Đã đăng ký/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email của bạn")).not.toBeInTheDocument();
  });
});
