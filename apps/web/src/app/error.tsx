"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">500</p>
      <h1 className="article-title mt-3 text-[2.4rem]">Đã xảy ra lỗi</h1>
      <p className="mt-4 text-muted-foreground">Không tải được nội dung. Vui lòng thử lại.</p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-primary hover:opacity-75"
        >
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
