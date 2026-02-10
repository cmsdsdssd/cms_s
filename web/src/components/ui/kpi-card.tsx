import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  trend?: string;
  trendTone?: "success" | "danger" | "muted";
  className?: string;
};

export function KpiCard({ label, value, trend, trendTone = "success", className }: KpiCardProps) {
  const trendColor =
    trendTone === "danger"
      ? "text-[var(--danger)]"
      : trendTone === "muted"
        ? "text-[var(--muted)]"
        : "text-[var(--success)]";

  return (
    <Card className={cn("min-h-[120px]", className)}>
      <CardBody className="flex h-full flex-col justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </p>
        <div>
          <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          {trend ? (
            <p className={cn("text-xs font-medium", trendColor)}>{trend}</p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
