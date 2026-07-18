const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface NewsletterService {
  subscribe(email: string): Promise<void>;
}

export const apiNewsletterService: NewsletterService = {
  async subscribe(email) {
    const res = await fetch(`${API}/api/v1/subscribers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
  },
};

/**
 * @deprecated Impl mock (localStorage) — chỉ còn dùng nếu store/hook cũ chưa chuyển.
 * Task 13 sẽ chuyển sang `apiNewsletterService`.
 */
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
