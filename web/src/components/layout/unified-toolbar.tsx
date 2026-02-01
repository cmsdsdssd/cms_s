import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type UnifiedToolbarProps = {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function UnifiedToolbar({
  title,
  children,
  actions,
  className,
}: UnifiedToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--hairline)] bg-[var(--background)]",
        className
      )}
    >
      {/* Title - Compact with separator */}
      <div className="flex items-center gap-3 pr-3 border-r border-[var(--hairline)]">
        <h1 className="text-base font-semibold text-[var(--foreground)] whitespace-nowrap">
          {title}
        </h1>
      </div>

      {/* Filters Area - Flexible */}
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}

      {/* Actions Area - Right aligned */}
      {actions && (
        <div className="flex items-center gap-2 ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

// Compact Select for toolbar
export function ToolbarSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 px-2 text-sm rounded-md border border-[var(--panel-border)]",
        "bg-[var(--panel)] text-[var(--foreground)]",
        "focus:outline-none focus:ring-1 focus:ring-[var(--primary)]",
        "cursor-pointer hover:bg-[var(--panel-hover)] transition-colors",
        className
      )}
    >
      {children}
    </select>
  );
}

// Compact Input for toolbar
export function ToolbarInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-8 pl-8 pr-3 text-sm rounded-md border border-[var(--panel-border)]",
          "bg-[var(--panel)] text-[var(--foreground)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--primary)]",
          "placeholder:text-[var(--muted)]",
          "w-32 md:w-40"
        )}
      />
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
    </div>
  );
}

// Compact Button for toolbar
export function ToolbarButton({
  onClick,
  children,
  variant = "primary",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 text-sm font-medium rounded-md transition-colors",
        variant === "primary"
          ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
          : "bg-[var(--panel)] text-[var(--foreground)] border border-[var(--panel-border)] hover:bg-[var(--panel-hover)]"
      )}
    >
      {children}
    </button>
  );
}
