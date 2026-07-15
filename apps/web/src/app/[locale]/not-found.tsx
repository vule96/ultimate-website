import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">404</p>
      <h1 className="article-title mt-3 text-[2.4rem]">{t("notFoundTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("notFoundDesc")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-75"
      >
        <span aria-hidden>←</span> {t("backHome")}
      </Link>
    </main>
  );
}
