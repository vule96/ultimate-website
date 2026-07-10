import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {SITE_NAME}</span>
        <nav className="flex gap-5">
          <Link href="/" className="transition-colors hover:text-foreground">Bài viết</Link>
          <Link href="/tags" className="transition-colors hover:text-foreground">Tags</Link>
          <a href="/rss.xml" className="transition-colors hover:text-foreground">RSS</a>
        </nav>
      </div>
    </footer>
  );
}
