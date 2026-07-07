export function RoutePending() {
  return (
    <div
      className="flex h-full min-h-[16rem] items-center justify-center"
      role="status"
      aria-label="Đang tải"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function RouteError({ error }: { error: Error }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-700">
      Đã xảy ra lỗi khi tải dữ liệu. {error.message}
    </div>
  );
}
