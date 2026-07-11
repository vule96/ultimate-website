export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  const base = basePath === "/" ? "" : basePath;
  return `${base}/page/${page}`;
}
