const META = "SỐ 128 · 12.07.2026 · CẬP NHẬT MỖI NGÀY";

export function SubNav() {
  return (
    <div className="flex items-center justify-between gap-5 border-b-2 border-fg bg-surface px-[30px] py-[11px]">
      <nav className="flex gap-[26px] text-[13.5px] font-semibold">
        <a href="/" className="text-fg no-underline">
          Trang chủ
        </a>
        <a href="/tags" className="text-muted no-underline">
          Danh mục
        </a>
        <a href="/" className="text-muted no-underline">
          Khám phá
        </a>
      </nav>
      <span className="font-mono text-[11px] tracking-[0.06em] text-muted">{META}</span>
    </div>
  );
}
