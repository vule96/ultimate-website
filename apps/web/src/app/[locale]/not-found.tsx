import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">404</p>
      <h1 className="mt-3 font-display text-[2.4rem] font-black leading-[1.12] tracking-[-0.01em] text-fg">{t("notFoundTitle")}</h1>
      <p className="mt-4 text-muted">{t("notFoundDesc")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-75"
      >
        <span aria-hidden>←</span> {t("backHome")}
      </Link>
    </main>
  );
}
