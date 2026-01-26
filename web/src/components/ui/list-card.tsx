import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ListCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; tone?: "neutral" | "active" | "warning" | "danger" };
  right?: React.ReactNode;
  selected?: boolean;
  className?: string;
};

export function ListCard({
  title,
  subtitle,
  meta,
  badge,
  right,
  selected,
  className,
}: ListCardProps) {
  return (
    <Card
      className={cn(
        "flex w-full items-center justify-between px-5 py-4 transition hover:shadow-[0_12px_24px_rgba(16,24,40,0.08)]",
        selected && "ring-2 ring-[var(--primary)]",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        </div>
        {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
        {meta ? <p className="text-xs text-[var(--muted-weak)]">{meta}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </Card>
  );
}
