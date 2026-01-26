import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  trend?: string;
  className?: string;
};

export function KpiCard({ label, value, trend, className }: KpiCardProps) {
  return (
    <Card className={cn("min-h-[120px]", className)}>
      <CardBody className="flex h-full flex-col justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </p>
        <div>
          <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          {trend ? (
            <p className="text-xs font-medium text-[var(--success)]">{trend}</p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
