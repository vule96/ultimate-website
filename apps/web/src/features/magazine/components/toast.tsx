"use client";
import { useEffect } from "react";
import { m } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMagazineStore } from "../store/magazine-store";

export function Toast() {
  const t = useTranslations("toast");
  const toast = useMagazineStore((s) => s.toast);
  const clearToast = useMagazineStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2800);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      role="alert"
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-fg px-5 py-3 text-[13px] font-semibold text-bg shadow-modal"
    >
      {t(toast.key, toast.params)}
    </m.div>
  );
}
