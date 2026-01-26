import { cn } from "@/lib/utils";

type SplitLayoutProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
};

export function SplitLayout({ left, right, className }: SplitLayoutProps) {
  return (
    <div className={cn("grid grid-cols-12 gap-6", className)}>
      <div className="col-span-12 lg:col-span-5">{left}</div>
      <div className="col-span-12 lg:col-span-7">{right}</div>
    </div>
  );
}
