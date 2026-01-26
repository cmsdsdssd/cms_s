import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-weak)] focus:border-[var(--primary)] focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[96px] w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-weak)] focus:border-[var(--primary)] focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
