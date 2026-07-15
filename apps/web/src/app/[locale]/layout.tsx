import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Roboto, Be_Vietnam_Pro, Space_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import { routing, isLocale } from "@/i18n/routing";
import { MagazineFooter } from "@/features/magazine/components/magazine-footer";
import { THEME_SCRIPT } from "@/features/magazine/hooks/use-theme";

const display = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "900"],
  variable: "--font-display-next",
  display: "swap",
});
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-next",
  display: "swap",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-next",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: t("description"),
    alternates: { languages: { vi: "/", en: "/en", "x-default": "/" } },
    openGraph: { locale: params.locale === "en" ? "en_US" : "vi_VN" },
  };
}

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
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
        <NextIntlClientProvider messages={messages}>
          <div className="flex-1">{children}</div>
          <MagazineFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
