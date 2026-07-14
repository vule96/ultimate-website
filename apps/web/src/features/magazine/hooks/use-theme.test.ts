import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./use-theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("toggle bật/tắt class dark + persist", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.dark).toBe(false);
    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("mach-theme")).toBe("dark");
    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("mach-theme")).toBe("light");
  });
});
