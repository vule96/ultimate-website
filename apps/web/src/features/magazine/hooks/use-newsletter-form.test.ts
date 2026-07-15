import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNewsletterForm } from "./use-newsletter-form";
import type { NewsletterService } from "../services/newsletter-service";

const okService: NewsletterService = { subscribe: vi.fn().mockResolvedValue(undefined) };

describe("useNewsletterForm", () => {
  it("bắt đầu ở idle với email rỗng", () => {
    const { result } = renderHook(() => useNewsletterForm(okService));
    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.email).toBe("");
  });

  it("email sai → error, không gọi service", async () => {
    const service: NewsletterService = { subscribe: vi.fn() };
    const { result } = renderHook(() => useNewsletterForm(service));
    act(() => result.current.setEmail("khong-phai-email"));
    await act(() => result.current.submit());
    expect(result.current.status).toEqual({ kind: "error", message: "Email không hợp lệ." });
    expect(service.subscribe).not.toHaveBeenCalled();
  });

  it("email đúng → submitting rồi success, gọi service với email, reset email", async () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNewsletterForm({ subscribe }));
    act(() => result.current.setEmail("a@b.vn"));
    await act(() => result.current.submit());
    expect(subscribe).toHaveBeenCalledWith("a@b.vn");
    expect(result.current.status).toEqual({ kind: "success" });
    expect(result.current.email).toBe("");
  });

  it("service ném lỗi → error hệ thống", async () => {
    const subscribe = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useNewsletterForm({ subscribe }));
    act(() => result.current.setEmail("a@b.vn"));
    await act(() => result.current.submit());
    expect(result.current.status).toEqual({
      kind: "error",
      message: "Có lỗi xảy ra, thử lại sau nhé.",
    });
  });

  it("sửa email sau lỗi → quay về idle", async () => {
    const { result } = renderHook(() => useNewsletterForm(okService));
    act(() => result.current.setEmail("sai"));
    await act(() => result.current.submit());
    act(() => result.current.setEmail("sai@roi.vn"));
    expect(result.current.status).toEqual({ kind: "idle" });
  });
});
