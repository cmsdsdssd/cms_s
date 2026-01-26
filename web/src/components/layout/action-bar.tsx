import { cn } from "@/lib/utils";

type ActionBarProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function ActionBar({ title, subtitle, actions, className, ...props }: ActionBarProps) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        </div>
        {subtitle ? <p className="text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
