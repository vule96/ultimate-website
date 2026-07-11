import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">404</p>
      <h1 className="article-title mt-3 text-[2.4rem]">Không tìm thấy trang</h1>
      <p className="mt-4 text-muted-foreground">
        Trang bạn tìm không tồn tại hoặc đã bị gỡ.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-75"
      >
        <span aria-hidden>←</span> Về trang chủ
      </Link>
    </main>
  );
}
