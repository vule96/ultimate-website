import Link from "next/link";
import { pageHref } from "../pagination-utils";

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
    <nav className="mt-10 flex items-center justify-between">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} className="underline">← Trước</Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">Trang {page}/{totalPages}</span>
      {page < totalPages ? (
        <Link href={pageHref(basePath, page + 1)} className="underline">Sau →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
