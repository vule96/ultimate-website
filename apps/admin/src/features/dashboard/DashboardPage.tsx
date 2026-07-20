import { FileText, CheckCircle2, Eye, Mail, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { PostStatus } from "@ultimate/types";
import { useStatsSuspense, usePostsListSuspense } from "@/features/posts/queries";
import { useSubscribersSuspense, useReadersSuspense } from "@/features/users/queries";
import { fmtDate } from "@/features/users/shared";
import { lazy, Suspense } from "react";
import { KpiTile } from "./widgets/KpiTile";

// Chart kéo theo recharts (nặng) → tách chunk riêng, chỉ tải khi dashboard render.
const PostsChart = lazy(() =>
  import("./widgets/PostsChart").then((m) => ({ default: m.PostsChart })),
);

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return (n / 1_000_000).toFixed(1) + "m";
}

function StatusChip({ status }: { status: PostStatus }) {
  const pub = status === "PUBLISHED";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        color: pub ? "var(--st-pub)" : "var(--st-draft)",
        background: pub ? "var(--st-pub-t)" : "var(--st-draft-t)",
      }}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {pub ? "Đã đăng" : "Nháp"}
    </span>
  );
}

export function DashboardPage() {
  const { data: stats } = useStatsSuspense();
  const { data: subs } = useSubscribersSuspense({ page: 1, pageSize: 5 });
  const { data: readers } = useReadersSuspense({ page: 1, pageSize: 1 });
  const { data: recent } = usePostsListSuspense({ page: 1, pageSize: 6 });
  const { data: top } = usePostsListSuspense({ page: 1, pageSize: 5, sort: "views", order: "desc" });

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile label="Bài viết" value={String(stats.total)} icon={FileText} color="post" delta={`${stats.published} đã đăng`} />
        <KpiTile label="Đã đăng" value={String(stats.published)} icon={CheckCircle2} color="pub" delta={`${stats.draft} nháp`} />
        <KpiTile label="Lượt xem" value={compact(stats.total_views)} icon={Eye} color="view" />
        <KpiTile label="Người đăng ký" value={String(subs.total)} icon={Mail} color="sub" />
        <KpiTile label="Người đọc" value={String(readers.total)} icon={Users} color="read" />
      </div>

      {/* Recent + rail */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center border-b border-border/60 px-4 py-3">
            <h2 className="text-[13.5px] font-semibold">Bài viết gần đây</h2>
            <Link to="/posts" className="ml-auto text-[12px] font-semibold text-primary">
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
                  <th className="px-4 py-2 font-bold">Tiêu đề</th>
                  <th className="px-4 py-2 font-bold">Trạng thái</th>
                  <th className="px-4 py-2 text-right font-bold">Lượt xem</th>
                  <th className="px-4 py-2 text-right font-bold">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/60">
                    <td className="max-w-0 px-4 py-2.5">
                      <Link
                        to="/posts/$slug/edit"
                        params={{ slug: p.slug }}
                        className="block truncate text-[13.5px] font-medium hover:text-primary"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                      {p.views > 0 ? p.views.toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {fmtDate(p.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border/60 px-4 py-3 text-[13.5px] font-semibold">
              Top xem nhiều
            </div>
            {top.data.map((p, i) => (
              <Link
                key={p.id}
                to="/posts/$slug/edit"
                params={{ slug: p.slug }}
                className="grid grid-cols-[20px_1fr_auto] items-baseline gap-3 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-secondary/60"
              >
                <span className="font-mono text-[12px] font-bold text-primary">{i + 1}</span>
                <span className="truncate text-[13px] font-medium">{p.title}</span>
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  {compact(p.views)}
                </span>
              </Link>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center border-b border-border/60 px-4 py-3">
              <h2 className="text-[13.5px] font-semibold">Đăng ký mới</h2>
              <Link to="/subscribers" className="ml-auto text-[12px] font-semibold text-primary">
                Quản lý →
              </Link>
            </div>
            {subs.data.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 border-b border-border/50 px-4 py-2.5 last:border-0">
                <span
                  className="flex size-6 items-center justify-center rounded-md text-[11px] font-bold"
                  style={{ color: "var(--k-sub)", background: "var(--k-sub-t)" }}
                >
                  {s.email.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate font-mono text-[12.5px]">{s.email}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{fmtDate(s.created_at)}</span>
              </div>
            ))}
            {subs.data.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Chưa có đăng ký.</p>
            )}
          </div>
        </div>
      </div>

      <Suspense
        fallback={<div className="h-[280px] animate-pulse rounded-xl border border-border bg-card" />}
      >
        <PostsChart />
      </Suspense>
    </div>
  );
}
