import { cn } from "@/lib/utils";

export function Section({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode; }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
