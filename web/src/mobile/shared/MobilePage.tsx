import { cn } from "@/lib/utils";

type MobilePageProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function MobilePage({ title, subtitle, actions, children, className }: MobilePageProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-xl flex-col gap-4 px-3 pb-24 pt-3", className)}>
      <header className="sticky top-0 z-20 -mx-3 border-b border-[var(--panel-border)] bg-[var(--background)]/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-[var(--foreground)]">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
