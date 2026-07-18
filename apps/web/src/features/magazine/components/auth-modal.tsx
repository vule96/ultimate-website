"use client";
import { m } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useMagazineStore } from "../store/magazine-store";
import { PUBLIC_API_URL } from "@/lib/config";

// Auth thật qua Go core BFF: redirect full-page sang Google OAuth, quay lại `returnTo` sau login.
export function AuthModal() {
  const t = useTranslations("auth");
  const close = useMagazineStore((s) => s.closeAuth);
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname || "/");
  const href = `${PUBLIC_API_URL}/auth/reader/google/login?returnTo=${returnTo}`;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={close}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(8,12,22,0.55)] p-5"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-[384px] max-w-full rounded-[14px] bg-surface p-[30px] text-fg shadow-modal"
      >
        <div className="mb-[6px] flex items-start justify-between">
          <h3 className="m-0 font-display text-[24px] font-extrabold tracking-[-0.02em]">
            {t("login")}
          </h3>
          <button
            onClick={close}
            aria-label={t("closeAria")}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-soft text-muted"
          >
            <X size={17} />
          </button>
        </div>
        <p className="mb-5 text-[13px] leading-[1.5] text-muted">{t("intro")}</p>
        <a
          href={href}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-accent py-[13px] text-[14px] font-bold text-white"
        >
          {t("googleCta")}
        </a>
      </m.div>
    </m.div>
  );
}
