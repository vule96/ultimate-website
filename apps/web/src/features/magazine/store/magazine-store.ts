import { create } from "zustand";
import type { CategoryKey, MockUser } from "../types";
import { localBookmarkService } from "../services/bookmark-service";

type AuthMode = "login" | "register";

// Toast lưu key (+ params) thay vì chuỗi — component Toast dịch qua next-intl.
export type ToastKey = "authRequired" | "saved" | "unsaved" | "hello" | "loggedOut";
export interface ToastMsg {
  key: ToastKey;
  params?: Record<string, string>;
}

interface MagazineState {
  query: string;
  cat: CategoryKey;
  saved: Record<string, true>;
  user: MockUser | null;
  authOpen: boolean;
  authMode: AuthMode;
  toast: ToastMsg | null;
  setQuery(q: string): void;
  setCat(c: CategoryKey): void;
  toggleSave(id: string): void;
  login(user: MockUser): void;
  logout(): void;
  openAuth(mode: AuthMode): void;
  closeAuth(): void;
  setToast(msg: ToastMsg): void;
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
      set({ authOpen: true, authMode: "login", toast: { key: "authRequired" } });
      return;
    }
    const next = localBookmarkService.toggle(user.email, id);
    set({
      saved: savedRecord(next),
      toast: { key: next.has(id) ? "saved" : "unsaved" },
    });
  },

  login: (user) =>
    set({
      user,
      authOpen: false,
      saved: savedRecord(localBookmarkService.load(user.email)),
      toast: { key: "hello", params: { name: user.name } },
    }),

  logout: () => set({ user: null, saved: {}, toast: { key: "loggedOut" } }),

  openAuth: (authMode) => set({ authOpen: true, authMode }),
  closeAuth: () => set({ authOpen: false }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));

// Selector tiện dụng (chống re-render — chỉ subscribe slice cần).
export const useSavedCount = () =>
  useMagazineStore((s) => Object.keys(s.saved).length);
