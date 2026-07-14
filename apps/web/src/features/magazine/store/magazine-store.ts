import { create } from "zustand";
import type { CategoryKey, MockUser } from "../types";
import { localBookmarkService } from "../services/bookmark-service";

type AuthMode = "login" | "register";

interface MagazineState {
  query: string;
  cat: CategoryKey;
  saved: Record<string, true>;
  user: MockUser | null;
  authOpen: boolean;
  authMode: AuthMode;
  toast: string | null;
  setQuery(q: string): void;
  setCat(c: CategoryKey): void;
  toggleSave(id: string): void;
  login(user: MockUser): void;
  logout(): void;
  openAuth(mode: AuthMode, msg?: string): void;
  closeAuth(): void;
  setToast(msg: string): void;
  clearToast(): void;
}

const savedRecord = (set: Set<string>): Record<string, true> =>
  Object.fromEntries([...set].map((id) => [id, true as const]));

export const useMagazineStore = create<MagazineState>((set, get) => ({
  query: "",
  cat: "all",
  saved: {},
  user: null,
  authOpen: false,
  authMode: "login",
  toast: null,

  setQuery: (query) => set({ query }),
  setCat: (cat) => set({ cat }),

  toggleSave: (id) => {
    const { user } = get();
    if (!user) {
      set({
        authOpen: true,
        authMode: "login",
        toast: "Đăng nhập để lưu bài viết yêu thích.",
      });
      return;
    }
    const next = localBookmarkService.toggle(user.email, id);
    set({
      saved: savedRecord(next),
      toast: next.has(id) ? "Đã lưu bài viết." : "Đã bỏ lưu.",
    });
  },

  login: (user) =>
    set({
      user,
      authOpen: false,
      saved: savedRecord(localBookmarkService.load(user.email)),
      toast: `Xin chào, ${user.name}!`,
    }),

  logout: () => set({ user: null, saved: {}, toast: "Đã đăng xuất." }),

  openAuth: (authMode, msg) => set({ authOpen: true, authMode, toast: msg ?? null }),
  closeAuth: () => set({ authOpen: false }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));

// Selector tiện dụng (chống re-render — chỉ subscribe slice cần).
export const useSavedCount = () =>
  useMagazineStore((s) => Object.keys(s.saved).length);
