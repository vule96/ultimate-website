import type { LucideIcon } from "lucide-react";
import { Card } from "@ultimate/ui";
import { cn } from "@ultimate/ui";

type Chip = "green" | "blue" | "orange" | "violet";

const chipBg: Record<Chip, string> = {
  green: "bg-chip-green/15 text-chip-green",
  blue: "bg-chip-blue/15 text-chip-blue",
  orange: "bg-chip-orange/15 text-chip-orange",
  violet: "bg-chip-violet/15 text-chip-violet",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  chip,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  chip: Chip;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", chipBg[chip])}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}
