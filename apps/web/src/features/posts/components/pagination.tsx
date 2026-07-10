import Link from "next/link";
import { pageHref } from "../pagination-utils";

const LINK =
  "card-lift inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-card)] hover:text-primary";

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
    <nav className="mt-14 flex items-center justify-between border-t pt-8">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} className={LINK}>
          <span aria-hidden>←</span> Trước
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm tabular-nums text-muted-foreground">
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
