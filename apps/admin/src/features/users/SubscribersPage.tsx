import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@ultimate/ui";
import type { Subscriber } from "@ultimate/types";
import { Route } from "@/routes/_authed.subscribers";
import { DeleteDialog } from "@/features/posts/components/DeleteDialog";
import { TopbarActions } from "@/app/Topbar";
import type { SubscriberStatus } from "./api";
import { useSubscribersSuspense, useDeleteSubscriber } from "./queries";
import { PAGE_SIZE, fmtDate, Pager, Panel } from "./shared";

const STATUS_FILTERS: { value: SubscriberStatus | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Đang nhận" },
  { value: "unsubscribed", label: "Đã huỷ" },
];

function statusLabel(s: string): string {
  if (s === "active") return "Đang nhận";
  if (s === "unsubscribed") return "Đã huỷ";
  return s;
}

function toCsv(rows: Subscriber[]): string {
  const head = "email,status,created_at";
  const body = rows
    .map((r) => [r.email, r.status, r.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export function SubscribersPage() {
  const { page, status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSubscribersSuspense({ page, pageSize: PAGE_SIZE, status });
  const del = useDeleteSubscriber();
  const [toDelete, setToDelete] = useState<Subscriber | null>(null);

  const setStatus = (s: SubscriberStatus | "") =>
    void navigate({ search: (prev) => ({ ...prev, page: 1, status: s || undefined }) });

  const exportCsv = () => {
    const blob = new Blob([toCsv(data.data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setPage = (p: number) => void navigate({ search: (s) => ({ ...s, page: p }) });

  return (
    <div className="flex flex-col gap-5">
      <TopbarActions>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.data.length === 0}>
          <Download className="size-4" /> Xuất CSV
        </Button>
      </TopbarActions>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[13px] text-muted-foreground">
          {data.total} người đăng ký
        </p>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              onClick={() => setStatus(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                (status ?? "") === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
              <th className="px-4 py-2.5 font-bold">Email</th>
              <th className="px-4 py-2.5 font-bold">Trạng thái</th>
              <th className="px-4 py-2.5 text-right font-bold">Ngày đăng ký</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {data.data.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/60">
                <td className="px-4 py-2.5 font-mono text-[13px]">{s.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                    style={
                      s.status === "active"
                        ? { color: "var(--st-pub)", background: "var(--st-pub-t)" }
                        : { color: "var(--st-draft)", background: "var(--st-draft-t)" }
                    }
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                  {fmtDate(s.created_at)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    aria-label={`Xoá ${s.email}`}
                    onClick={() => setToDelete(s)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center text-muted-foreground">
                  Chưa có người đăng ký nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        heading="Xoá người đăng ký?"
        title={toDelete?.email ?? ""}
        description={
          <>
            Gỡ <span className="font-medium text-foreground">{toDelete?.email}</span> khỏi danh sách
            nhận bản tin. Hành động này không thể hoàn tác.
          </>
        }
        pending={del.isPending}
        onConfirm={() =>
          toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  );
}
