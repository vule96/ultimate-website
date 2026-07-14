const KEY = (user: string) => `mach:bookmarks:${user}`;

export interface BookmarkService {
  load(user: string): Set<string>;
  toggle(user: string, id: string): Set<string>;
}

// Impl cục bộ (localStorage). TODO Phase sau: users/{uid}/bookmarks (Firestore/Go core).
export const localBookmarkService: BookmarkService = {
  load(user) {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY(user)) ?? "[]"));
    } catch {
      return new Set();
    }
  },
  toggle(user, id) {
    const set = this.load(user);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY(user), JSON.stringify([...set]));
    }
    return set;
  },
};
