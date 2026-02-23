import { cn } from "@/lib/utils";

export function FilterBar({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-14 z-30 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--panel-border)] bg-[var(--panel)]/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur supports-[backdrop-filter]:bg-[var(--panel)]/80",
        className
      )}
    >
      {children}
    </div>
  );
}
