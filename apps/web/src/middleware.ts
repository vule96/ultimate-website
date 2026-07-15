import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Bỏ qua api, _next và file tĩnh/route metadata có đuôi (sitemap.xml, rss.xml, robots.txt…).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
