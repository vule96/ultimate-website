const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const BASE = `${API}/api/v1/readers/me/bookmarks`;

/** Interface async — backend thật (Task 13 sẽ chuyển store sang dùng apiBookmarkService). */
export interface BookmarkService {
  load(): Promise<Set<string>>;
  add(postId: string): Promise<void>;
  remove(postId: string): Promise<void>;
}

export const apiBookmarkService: BookmarkService = {
  async load() {
    const res = await fetch(BASE, { credentials: "include" });
    if (!res.ok) return new Set();
    const ids: string[] = await res.json();
    return new Set(ids);
  },
  async add(postId) {
    const res = await fetch(`${BASE}/${postId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`bookmark add failed: ${res.status}`);
  },
  async remove(postId) {
    const res = await fetch(`${BASE}/${postId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`bookmark remove failed: ${res.status}`);
  },
};

const KEY = (user: string) => `mach:bookmarks:${user}`;

/**
 * @deprecated Impl cục bộ (localStorage), sync — chỉ còn dùng bởi store mock hiện tại.
 * Task 13 sẽ chuyển store sang `apiBookmarkService` (async) và xoá impl này.
 */
export const localBookmarkService = {
  load(user: string): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY(user)) ?? "[]"));
    } catch {
      return new Set();
    }
  },
  toggle(user: string, id: string): Set<string> {
    const set = this.load(user);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY(user), JSON.stringify([...set]));
    }
    return set;
  },
};
