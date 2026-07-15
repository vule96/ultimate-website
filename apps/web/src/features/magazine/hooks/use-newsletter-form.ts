"use client";
import { useCallback, useState } from "react";
import type { NewsletterService } from "../services/newsletter-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/** Message lỗi bơm từ ngoài (đã dịch qua next-intl) — hook không giữ chuỗi cứng. */
export interface NewsletterErrors {
  invalid: string;
  system: string;
}

export function useNewsletterForm(service: NewsletterService, errors: NewsletterErrors) {
  const [email, setEmailRaw] = useState("");
  const [status, setStatus] = useState<NewsletterStatus>({ kind: "idle" });

  // Gõ lại email sau khi lỗi → xoá lỗi ngay, không chờ submit lần sau.
  const setEmail = useCallback((v: string) => {
    setEmailRaw(v);
    setStatus((s) => (s.kind === "error" ? { kind: "idle" } : s));
  }, []);

  const submit = useCallback(async () => {
    if (!EMAIL_RE.test(email)) {
      setStatus({ kind: "error", message: errors.invalid });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      await service.subscribe(email);
      setEmailRaw("");
      setStatus({ kind: "success" });
    } catch {
      setStatus({ kind: "error", message: errors.system });
    }
  }, [email, service, errors.invalid, errors.system]);

  return { email, setEmail, status, submit };
}
