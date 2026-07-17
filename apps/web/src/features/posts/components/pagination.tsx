import { Link } from "@/i18n/navigation";
import { pageHref } from "../pagination-utils";

const LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg no-underline transition-colors hover:text-accent";

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-14 flex items-center justify-between border-t border-line pt-8">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} className={LINK}>
          <span aria-hidden>←</span> Trước
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-[12px] tabular-nums text-muted">
        Trang {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(basePath, page + 1)} className={LINK}>
          Sau <span aria-hidden>→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
