import { SITE_NAME } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
        © {SITE_NAME}
      </div>
    </footer>
  );
}
