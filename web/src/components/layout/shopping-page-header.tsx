import Link from "next/link";
import { Button } from "@/components/ui/button";

type ShoppingStatusTone = "neutral" | "good" | "warn";

type ShoppingStatusItem = {
  label: string;
  value: string;
  tone?: ShoppingStatusTone;
};

type ShoppingActionItem = {
  label: string;
  href: string;
};

const toneClass: Record<ShoppingStatusTone, string> = {
  neutral: "border-[var(--hairline)] bg-[var(--panel)] text-[var(--foreground)]",
  good: "border-emerald-300/40 bg-emerald-500/10 text-emerald-700",
  warn: "border-amber-300/50 bg-amber-500/10 text-amber-700",
};

interface ShoppingPageHeaderProps {
  purpose: string;
  status: ShoppingStatusItem[];
  nextActions: ShoppingActionItem[];
}

export function ShoppingPageHeader({ purpose, status, nextActions }: ShoppingPageHeaderProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">이 화면에서 하는 일</p>
        <p className="text-sm text-[var(--foreground)]">{purpose}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {status.map((item) => {
          const tone = item.tone ?? "neutral";
          return (
            <div
              key={`${item.label}-${item.value}`}
              className={`rounded-[var(--radius)] border px-3 py-2 text-xs ${toneClass[tone]}`}
            >
              <div className="text-[11px] opacity-80">{item.label}</div>
              <div className="mt-1 text-sm font-semibold">{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {nextActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant="secondary" size="sm">{action.label}</Button>
          </Link>
        ))}
      </div>
    </section>
  );
}
