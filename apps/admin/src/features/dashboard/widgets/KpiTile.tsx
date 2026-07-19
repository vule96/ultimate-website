import type { LucideIcon } from "lucide-react";

type KpiColor = "post" | "pub" | "view" | "sub" | "read";

export function KpiTile({
  label,
  value,
  icon: Icon,
  color,
  delta,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: KpiColor;
  delta?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <span
        className="flex size-8 items-center justify-center rounded-[9px]"
        style={{ color: `var(--k-${color})`, background: `var(--k-${color}-t)` }}
      >
        <Icon className="size-[17px]" />
      </span>
      <p className="mt-3 text-[11.5px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[25px] font-bold tracking-tight tabular-nums">{value}</p>
      {delta && <p className="mt-1 text-[11.5px] text-muted-foreground">{delta}</p>}
    </div>
  );
}
