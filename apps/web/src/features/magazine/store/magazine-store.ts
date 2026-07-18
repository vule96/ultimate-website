import { create } from "zustand";
import type { CategoryKey, MockUser, Reader } from "../types";
import { apiBookmarkService } from "../services/bookmark-service";
import { PUBLIC_API_URL } from "@/lib/config";

type AuthMode = "login" | "register";

// Toast lưu key (+ params) thay vì chuỗi — component Toast dịch qua next-intl.
export type ToastKey =
  | "authRequired"
  | "saved"
  | "unsaved"
  | "hello"
  | "loggedOut"
  | "saveError";
export interface ToastMsg {
  key: ToastKey;
  params?: Record<string, string>;
}

interface MagazineState {
  query: string;
  cat: CategoryKey;
  saved: Record<string, true>;
  user: Reader | null;
  authOpen: boolean;
  authMode: AuthMode;
  toast: ToastMsg | null;
  setQuery(q: string): void;
  setCat(c: CategoryKey): void;
  toggleSave(id: string): Promise<void>;
  hydrate(): Promise<void>;
  /**
   * @deprecated Shim tạm cho AuthModal (Task 14 sẽ thay bằng Google OAuth thật qua
   * `/auth/reader/*`). Chỉ set user cục bộ — không gọi backend, không có `id` thật.
   */
  login(user: MockUser): void;
  logout(): Promise<void>;
  openAuth(mode: AuthMode): void;
  closeAuth(): void;
  setToast(msg: ToastMsg): void;
  clearToast(): void;
}

const savedRecord = (ids: Iterable<string>): Record<string, true> =>
  Object.fromEntries([...ids].map((id) => [id, true as const]));

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

  hydrate: async () => {
    try {
      const res = await fetch(`${PUBLIC_API_URL}/auth/reader/me`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const user: Reader = await res.json();
      const saved = savedRecord(await apiBookmarkService.load());
      set({ user, saved });
    } catch {
      // offline hoặc chưa đăng nhập — im lặng, giữ trạng thái logged-out.
    }
  },

  toggleSave: async (id) => {
    const { user, saved } = get();
    if (!user) {
      set({ authOpen: true, authMode: "login", toast: { key: "authRequired" } });
      return;
    }
    const wasSaved = !!saved[id];
    const next = { ...saved };
    if (wasSaved) delete next[id];
    else next[id] = true;
    // Optimistic: cập nhật UI ngay, rollback nếu API lỗi.
    set({ saved: next, toast: { key: wasSaved ? "unsaved" : "saved" } });
    try {
      if (wasSaved) await apiBookmarkService.remove(id);
      else await apiBookmarkService.add(id);
    } catch {
      set({ saved, toast: { key: "saveError" } });
    }
  },

  login: (user) =>
    set({
      user: { id: user.email, email: user.email, name: user.name },
      authOpen: false,
      toast: { key: "hello", params: { name: user.name } },
    }),

  logout: async () => {
    try {
      await fetch(`${PUBLIC_API_URL}/auth/reader/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // vẫn clear state cục bộ dù request lỗi/offline.
    }
    set({ user: null, saved: {}, toast: { key: "loggedOut" } });
  },

  openAuth: (authMode) => set({ authOpen: true, authMode }),
  closeAuth: () => set({ authOpen: false }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));

// Selector tiện dụng (chống re-render — chỉ subscribe slice cần).
export const useSavedCount = () =>
  useMagazineStore((s) => Object.keys(s.saved).length);
