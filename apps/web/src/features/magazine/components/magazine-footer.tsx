import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CATEGORIES } from "../categories";
import { NewsletterBox } from "./newsletter-box";

const SOCIAL = ["f", "in", "X", "YT"];

export function MagazineFooter() {
  const t = useTranslations("footer");
  const tc = useTranslations("categories");
  return (
    <footer className="bg-ink px-5 pb-6 pt-10 text-ink-fg sm:px-[30px] sm:pt-[46px]">
      <div className="mx-auto grid max-w-shell grid-cols-1 gap-8 border-b border-ink-fg/15 pb-8 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1.3fr] lg:gap-[38px]">
        <div>
          <div className="mb-[11px] font-display text-[27px] font-extrabold tracking-[-0.015em] text-accent">
            Mạch
          </div>
          <p className="mb-[18px] max-w-[290px] text-[13px] leading-[1.65] text-ink-muted">
            {t("desc")}
          </p>
          <div className="flex gap-[9px]">
            {SOCIAL.map((s) => (
              <a
                key={s}
                href="/"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-ink-fg/10 text-[13px] font-bold text-ink-fg no-underline"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            {t("colCategories")}
          </div>
          <div className="flex flex-col gap-[10px]">
            {CATEGORIES.filter((c) => c.key !== "all")
              .slice(0, 6)
              .map((c) => (
                <Link
                  key={c.key}
                  href="/tags"
                  className="text-[13px] text-ink-muted no-underline"
                >
                  {tc(c.key)}
                </Link>
              ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            {t("colAbout")}
          </div>
          <div className="flex flex-col gap-[10px] text-[13px]">
            {(["about", "write", "contact", "jobs"] as const).map((key) => (
              <Link key={key} href="/" className="text-ink-muted no-underline">
                {t(key)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            {t("colNewsletter")}
          </div>
          <p className="mb-3 text-[12.5px] leading-[1.55] text-ink-muted">{t("newsletterDesc")}</p>
          <NewsletterBox variant="footer" />
        </div>
      </div>
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-[10px] pt-5 font-mono text-[11px] text-ink-muted">
        <span>{t("copyright")}</span>
        <span>{t("legal")}</span>
      </div>
    </footer>
  );
}
