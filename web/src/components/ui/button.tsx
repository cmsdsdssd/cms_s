import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
        secondary:
          "border border-[var(--panel-border)] bg-white text-[var(--foreground)] hover:bg-[var(--chip)]",
        ghost: "text-[var(--foreground)] hover:bg-[var(--chip)]",
        danger: "bg-[var(--danger)] text-white hover:bg-[#991b1b]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10",
        lg: "h-12 px-6 text-base",
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
