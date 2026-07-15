import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Be_Vietnam_Pro, Space_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import { MagazineFooter } from "@/features/magazine/components/magazine-footer";
import { THEME_SCRIPT } from "@/features/magazine/hooks/use-theme";

const display = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800"],
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Mạch — tạp chí tri thức cho người trẻ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg">
        <div className="flex-1">{children}</div>
        <MagazineFooter />
      </body>
    </html>
  );
}
