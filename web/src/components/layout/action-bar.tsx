import { cn } from "@/lib/utils";

type ActionBarProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  sticky?: boolean;
};

export function ActionBar({ title, subtitle, actions, className, sticky = true, ...props }: ActionBarProps) {
  return (
    <div
      className={cn(
        // ✅ 좁은 화면/다른 DPI에서도 깨지지 않도록 반응형으로 정렬
        "flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between",
        sticky && "sticky top-[var(--topbar-sticky-offset)] z-30 border-b border-[var(--hairline)] bg-[var(--background)]/95 py-2 backdrop-blur",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{title}</h1>
        </div>
        {subtitle ? <p className="text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-center justify-start gap-2 md:w-auto md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
