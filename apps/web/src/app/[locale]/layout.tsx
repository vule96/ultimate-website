import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import { routing, isLocale } from "@/i18n/routing";
import { Masthead } from "@/features/magazine/components/masthead";
import { SectionNav } from "@/features/magazine/components/section-nav";
import { Ticker } from "@/features/magazine/components/ticker";
import { MagazineFooter } from "@/features/magazine/components/magazine-footer";
import { ReaderHydrator } from "@/features/magazine/components/reader-hydrator";
import { THEME_SCRIPT } from "@/features/magazine/hooks/use-theme";
import { listLatest } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { categoryFromTags, CATEGORY_BY_KEY } from "@/features/magazine/categories";

// Newsroom (bản C): một họ chữ Be Vietnam Pro cho toàn site — personality bằng
// weight (heading 800/900) + scale, không dùng serif/mono chrome.
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-sans-next",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: t("description"),
    alternates: { languages: { vi: "/", en: "/en", "x-default": "/" } },
    openGraph: { locale: params.locale === "en" ? "en_US" : "vi_VN" },
  };
}

export default async function RootLayout(
  props: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // Ticker chrome: bài mới nhất (buildSafe → [] khi build không API).
  const latest = await buildSafe(() => listLatest(8), []);
  const tCat = await getTranslations({ locale });
  const tickerItems = latest.map((p) => {
    const cat = categoryFromTags(p.tags);
    return {
      slug: p.slug,
      title: p.title,
      label: tCat(`categories.${cat}`),
      color: CATEGORY_BY_KEY[cat].color,
    };
  });
  return (
    <html
      lang={locale}
      className={sans.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* JS bị chặn/hỏng → bỏ trạng thái initial của framer-motion, nội dung vẫn đọc được */}
        <noscript>
          <style>{`article{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Chrome newsroom toàn site: ticker + masthead + section-nav mọi trang. */}
          <ReaderHydrator />
          <Ticker items={tickerItems} />
          <Masthead />
          <SectionNav />
          <div className="flex-1">{children}</div>
          <MagazineFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
