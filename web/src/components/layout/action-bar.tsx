import { cn } from "@/lib/utils";

type ActionBarProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function ActionBar({ title, subtitle, actions, className, ...props }: ActionBarProps) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
