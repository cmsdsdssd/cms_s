import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      tone: {
        neutral: "bg-muted/40 text-[var(--muted)] border-[var(--panel-border)]",
        active: "bg-success/15 text-success border-success/25",
        warning: "bg-warning/18 text-warning border-warning/30",
        danger: "bg-destructive/12 text-destructive border-destructive/25",
        primary: "bg-primary/10 text-primary border-primary/25",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
