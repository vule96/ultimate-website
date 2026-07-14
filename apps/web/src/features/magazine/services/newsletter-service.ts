export interface NewsletterService {
  subscribe(email: string): Promise<void>;
}

// Impl cục bộ (mock) — TODO Phase sau: POST /subscribers hoặc Firestore.
export const localNewsletterService: NewsletterService = {
  async subscribe(email) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("mach:subscribers") ?? "[]";
      const list = new Set<string>(JSON.parse(raw));
      list.add(email);
      localStorage.setItem("mach:subscribers", JSON.stringify([...list]));
    }
  },
};
