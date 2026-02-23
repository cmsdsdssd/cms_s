import { cn } from "@/lib/utils";

type MobileDataListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyText?: string;
  className?: string;
};

export function MobileDataList<T>({
  items,
  getKey,
  renderItem,
  emptyText = "데이터가 없습니다.",
  className,
}: MobileDataListProps<T>) {
  if (items.length === 0) {
    return (
      <div className={cn("rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--muted)]", className)}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item, index) => (
        <div key={getKey(item, index)}>{renderItem(item, index)}</div>
      ))}
    </div>
  );
}
