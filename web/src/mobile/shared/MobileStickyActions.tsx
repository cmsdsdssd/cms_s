import { cn } from "@/lib/utils";

type MobileStickyActionsProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileStickyActions({ children, className }: MobileStickyActionsProps) {
  return (
    <div className={cn("fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 px-3", className)}>
      <div className="mx-auto max-w-xl rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)]/95 p-2 shadow-[var(--shadow)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
