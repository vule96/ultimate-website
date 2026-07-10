import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold">{SITE_NAME}</Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/">Bài viết</Link>
          <Link href="/tags">Tags</Link>
        </nav>
      </div>
    </header>
  );
}
