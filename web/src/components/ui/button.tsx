import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--primary-strong)] hover:shadow",
        secondary:
          "border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-subtle)] hover:bg-[var(--chip)] hover:border-[var(--input-border)]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--chip)]",
        danger:
          "bg-[var(--danger)] text-white shadow hover:bg-[#b91c1c]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
