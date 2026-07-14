"use client";
import { useState } from "react";
import { useMagazineStore } from "../store/magazine-store";
import { localNewsletterService } from "../services/newsletter-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterBox({ variant }: { variant: "rail" | "footer" }) {
  const [email, setEmail] = useState("");
  const setToast = useMagazineStore((s) => s.setToast);

  const submit = async () => {
    if (!EMAIL_RE.test(email)) return setToast("Email không hợp lệ.");
    await localNewsletterService.subscribe(email);
    setEmail("");
    setToast("Đăng ký bản tin thành công!");
  };

  if (variant === "rail") {
    return (
      <div className="mt-7 rounded-xl bg-fg p-[18px] text-bg">
        <div className="mb-[5px] font-display text-[16px] font-bold leading-[1.15]">Bản tin Mạch</div>
        <p className="mb-3 text-[11.5px] leading-[1.5] opacity-70">
          Tuyển tập hay nhất, mỗi sáng thứ Hai.
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email…"
          className="mb-2 w-full rounded-lg border-none px-3 py-[10px] text-[12.5px] text-fg outline-none"
        />
        <button
          onClick={submit}
          className="w-full rounded-lg bg-accent py-[10px] text-[12.5px] font-bold text-white"
        >
          Đăng ký
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email…"
        className="min-w-0 flex-1 rounded-lg border-none px-3 py-[11px] text-[12.5px] text-fg outline-none"
      />
      <button
        onClick={submit}
        className="whitespace-nowrap rounded-lg bg-accent px-[15px] py-[11px] text-[12.5px] font-bold text-white"
      >
        OK
      </button>
    </div>
  );
}
