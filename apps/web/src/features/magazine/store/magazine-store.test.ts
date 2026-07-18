import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMagazineStore } from "./magazine-store";
import { apiBookmarkService } from "../services/bookmark-service";

vi.mock("../services/bookmark-service", () => ({
  apiBookmarkService: { load: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));

const reset = () => {
  localStorage.clear();
  useMagazineStore.setState({
    query: "",
    cat: "all",
    saved: {},
    user: null,
    authOpen: false,
    toast: null,
  });
};

describe("magazine-store", () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  it("setCat + setQuery", () => {
    useMagazineStore.getState().setCat("ai");
    useMagazineStore.getState().setQuery("go");
    expect(useMagazineStore.getState().cat).toBe("ai");
    expect(useMagazineStore.getState().query).toBe("go");
  });

  it("toggleSave khi chưa login → mở auth với message, không lưu", async () => {
    await useMagazineStore.getState().toggleSave("a1");
    const s = useMagazineStore.getState();
    expect(s.saved["a1"]).toBeUndefined();
    expect(s.authOpen).toBe(true);
    expect(s.toast).toEqual({ key: "authRequired" });
  });

  it("có user, toggleSave optimistic lưu ngay rồi gọi apiBookmarkService.add", async () => {
    (apiBookmarkService.add as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useMagazineStore.setState({ user: { id: "1", email: "a@b.co", name: "A" } });
    await useMagazineStore.getState().toggleSave("a1");
    expect(useMagazineStore.getState().saved["a1"]).toBe(true);
    expect(useMagazineStore.getState().toast).toEqual({ key: "saved" });
    expect(apiBookmarkService.add).toHaveBeenCalledWith("a1");
  });

  it("toggleSave optimistic + rollback khi API lỗi", async () => {
    (apiBookmarkService.add as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    useMagazineStore.setState({ user: { id: "1", email: "a@b.co", name: "A" } });
    await useMagazineStore.getState().toggleSave("p1");
    // rollback: p1 không còn saved
    expect(useMagazineStore.getState().saved["p1"]).toBeUndefined();
    expect(useMagazineStore.getState().toast?.key).toBe("saveError");
  });

  it("hydrate: /me trả user → set user + load bookmarks", async () => {
    (apiBookmarkService.load as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["p1", "p2"]));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", email: "a@b.co", name: "A" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await useMagazineStore.getState().hydrate();
    const s = useMagazineStore.getState();
    expect(s.user).toEqual({ id: "1", email: "a@b.co", name: "A" });
    expect(s.saved).toEqual({ p1: true, p2: true });
    vi.unstubAllGlobals();
  });

  it("hydrate: /me trả lỗi → im lặng, vẫn logged out", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    await useMagazineStore.getState().hydrate();
    expect(useMagazineStore.getState().user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("hydrate: fetch throw (offline) → im lặng, không crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    await expect(useMagazineStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useMagazineStore.getState().user).toBeNull();
    vi.unstubAllGlobals();
  });

  it("logout gọi API rồi clear user + saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    useMagazineStore.setState({
      user: { id: "1", email: "a@b.co", name: "A" },
      saved: { a1: true },
    });
    await useMagazineStore.getState().logout();
    expect(useMagazineStore.getState().user).toBeNull();
    expect(useMagazineStore.getState().saved).toEqual({});
    expect(useMagazineStore.getState().toast).toEqual({ key: "loggedOut" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/reader/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    vi.unstubAllGlobals();
  });

  it("logout vẫn clear local dù request lỗi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    useMagazineStore.setState({ user: { id: "1", email: "a@b.co", name: "A" } });
    await useMagazineStore.getState().logout();
    expect(useMagazineStore.getState().user).toBeNull();
    vi.unstubAllGlobals();
  });
});
