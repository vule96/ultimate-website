import { describe, it, expect, beforeEach } from "vitest";
import { savePostLoginRedirect, takePostLoginRedirect } from "./post-login-redirect";

beforeEach(() => sessionStorage.clear());

describe("post-login redirect", () => {
  it("lưu rồi lấy (take) trả path đã lưu và xoá sau khi đọc", () => {
    savePostLoginRedirect("/posts");
    expect(takePostLoginRedirect()).toBe("/posts");
    expect(takePostLoginRedirect()).toBeNull(); // đã bị xoá
  });
  it("bỏ path không nội bộ (open-redirect guard)", () => {
    savePostLoginRedirect("//evil.com");
    expect(takePostLoginRedirect()).toBeNull();
    savePostLoginRedirect("http://evil.com");
    expect(takePostLoginRedirect()).toBeNull();
  });
  it("ctx trống → null", () => {
    expect(takePostLoginRedirect()).toBeNull();
  });
});
