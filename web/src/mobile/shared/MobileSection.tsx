import { cn } from "@/lib/utils";

type MobileSectionProps = {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function MobileSection({ title, right, children, className }: MobileSectionProps) {
  return (
    <section className={cn("rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)]", className)}>
      <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
