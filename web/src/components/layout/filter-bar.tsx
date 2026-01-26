import { cn } from "@/lib/utils";

export function FilterBar({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow)]",
        className
      )}
    >
      {children}
    </div>
  );
}
