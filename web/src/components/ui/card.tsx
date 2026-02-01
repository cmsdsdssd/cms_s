// web/src/components/ui/card.tsx
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        [
          "overflow-hidden rounded-[var(--radius-lg)] border",
          "bg-[var(--panel)] text-[var(--foreground)]",
          "border-[var(--panel-border)]",
          "shadow-[var(--shadow-subtle)]",
          "transition-[box-shadow,transform,background-color] duration-200",
          "hover:shadow-[var(--shadow-sm)]",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-[var(--hairline)] px-6 py-4 text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5 text-[var(--foreground)]", className)} {...props} />;
}
