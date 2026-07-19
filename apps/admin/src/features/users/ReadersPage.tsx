import { useNavigate } from "@tanstack/react-router";
import { Route } from "@/routes/_authed.readers";
import { useReadersSuspense } from "./queries";
import { PAGE_SIZE, fmtDate, Pager, Panel } from "./shared";

export function ReadersPage() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useReadersSuspense({ page, pageSize: PAGE_SIZE });
  const setPage = (p: number) => void navigate({ search: (s) => ({ ...s, page: p }) });

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[13px] text-muted-foreground">{data.total} người đọc</p>

      <Panel>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
              <th className="px-4 py-2.5 font-bold">Người đọc</th>
              <th className="px-4 py-2.5 font-bold">Email</th>
              <th className="px-4 py-2.5 text-right font-bold">Bookmark</th>
              <th className="px-4 py-2.5 text-right font-bold">Tham gia</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-7 items-center justify-center rounded-lg text-[12px] font-bold"
                      style={{ color: "var(--k-read)", background: "var(--k-read-t)" }}
                    >
                      {(r.name || r.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[13.5px] font-medium">{r.name || "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{r.email}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">
                  {r.bookmark_count}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                  {fmtDate(r.created_at)}
                </td>
              </tr>
            ))}
            {data.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center text-muted-foreground">
                  Chưa có người đọc nào đăng nhập.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}
