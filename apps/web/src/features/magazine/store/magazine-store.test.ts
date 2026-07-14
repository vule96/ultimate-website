import { describe, it, expect, beforeEach } from "vitest";
import { useMagazineStore } from "./magazine-store";

const reset = () => {
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
};

describe("magazine-store", () => {
  beforeEach(reset);

  it("setCat + setQuery", () => {
    useMagazineStore.getState().setCat("ai");
    useMagazineStore.getState().setQuery("go");
    expect(useMagazineStore.getState().cat).toBe("ai");
    expect(useMagazineStore.getState().query).toBe("go");
  });

  it("toggleSave khi chưa login → mở auth với message, không lưu", () => {
    useMagazineStore.getState().toggleSave("a1");
    const s = useMagazineStore.getState();
    expect(s.saved["a1"]).toBeUndefined();
    expect(s.authOpen).toBe(true);
    expect(s.toast).toMatch(/Đăng nhập/);
  });

  it("login rồi toggleSave → lưu/bỏ lưu", () => {
    useMagazineStore.getState().login({ name: "A", email: "a@b.co" });
    useMagazineStore.getState().toggleSave("a1");
    expect(useMagazineStore.getState().saved["a1"]).toBe(true);
    useMagazineStore.getState().toggleSave("a1");
    expect(useMagazineStore.getState().saved["a1"]).toBeUndefined();
  });

  it("logout xoá user + saved", () => {
    useMagazineStore.getState().login({ name: "A", email: "a@b.co" });
    useMagazineStore.getState().toggleSave("a1");
    useMagazineStore.getState().logout();
    expect(useMagazineStore.getState().user).toBeNull();
    expect(useMagazineStore.getState().saved).toEqual({});
  });
});
