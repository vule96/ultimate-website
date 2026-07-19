"use client";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMagazineStore } from "../store/magazine-store";

/** Nút lưu bài (bookmark thật — Slice 13). Dùng trong card/hero/rail. */
export function SaveButton({ id, className = "" }: { id: string; className?: string }) {
  const t = useTranslations("list");
  const saved = useMagazineStore((s) => Boolean(s.saved[id]));
  const toggle = useMagazineStore((s) => s.toggleSave);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t("unsaveAria") : t("saveAria")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/90 text-muted backdrop-blur transition-colors hover:text-fg ${className}`}
      style={saved ? { color: "var(--brand)", borderColor: "var(--brand)" } : undefined}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
