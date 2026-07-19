"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface TickerItem {
  slug: string;
  title: string;
  label: string;
  color: string;
}

/**
 * Ticker headline chạy (newsroom signature) — băng mực đậm, tag "Trực tiếp" +
 * chấm ping, danh sách bài mới nhất cuộn ngang. prefers-reduced-motion → tĩnh.
 * Items nhân đôi để cuộn liền mạch (dịch -50%).
 */
export function Ticker({ items }: { items: TickerItem[] }) {
  const t = useTranslations("ticker");
  if (items.length === 0) return null;
  const loop = [...items, ...items];
  return (
    <div className="overflow-hidden bg-ink text-ink-fg">
      <div className="mx-auto flex max-w-shell items-center gap-4 px-5 sm:px-[30px]">
        <span className="flex flex-none items-center gap-2 rounded bg-brand px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-wide text-white">
          <span className="ticker-dot h-1.5 w-1.5 rounded-full bg-white" />
          {t("live")}
        </span>
        <div className="ticker-track flex gap-9 whitespace-nowrap py-[9px] text-[13px]">
          {loop.map((it, i) => (
            <Link
              key={`${it.slug}-${i}`}
              href={`/blog/${it.slug}`}
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              <b className="mr-1.5 font-bold" style={{ color: it.color }}>
                {it.label}
              </b>
              {it.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
