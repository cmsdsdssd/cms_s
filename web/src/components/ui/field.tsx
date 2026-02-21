import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumberInput, splitFormattedNumberParts } from "@/lib/number";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { autoFormat?: boolean; displayClassName?: string }
>(
  ({ className, displayClassName, type, inputMode, onChange, value, defaultValue, autoFormat = true, ...props }, ref) => {
    const isNumeric = type === "number" || inputMode === "numeric" || inputMode === "decimal";
    const resolvedType = isNumeric ? "text" : type;
    const resolvedInputMode = isNumeric ? inputMode ?? "numeric" : inputMode;
    const rawValue = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
    const formattedValue = isNumeric && rawValue && autoFormat ? formatNumberInput(rawValue) : rawValue;
    const displayParts = isNumeric && formattedValue && autoFormat ? splitFormattedNumberParts(formattedValue) : null;
    const hasComma = Boolean(displayParts && displayParts.rest);
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
      if (!isNumeric) {
        onChange?.(event);
        return;
      }
      if (!autoFormat) {
        onChange?.(event);
        return;
      }
      const target = event.target;
      const raw = target.value;
      const selectionStart = target.selectionStart ?? raw.length;
      const formatted = formatNumberInput(raw);
      if (formatted !== raw) {
        const countBeforeCaret = raw.slice(0, selectionStart).replace(/[^0-9.]/g, "").length;
        let nextCaret = formatted.length;
        if (countBeforeCaret > 0) {
          let seen = 0;
          for (let i = 0; i < formatted.length; i += 1) {
            if (/[0-9.]/.test(formatted[i])) {
              seen += 1;
            }
            if (seen >= countBeforeCaret) {
              nextCaret = i + 1;
              break;
            }
          }
        }
        target.value = formatted;
        if (document.activeElement === target) {
          target.setSelectionRange(nextCaret, nextCaret);
        }
      }
      onChange?.(event);
    };
    if (!isNumeric || !autoFormat) {
      return (
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] ring-offset-[var(--background)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--muted-weak)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            className
          )}
          type={resolvedType}
          inputMode={resolvedInputMode}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />
      );
    }
    const alignClassName =
      typeof className === "string"
        ? className.includes("text-right")
          ? "justify-end text-right"
          : className.includes("text-center")
            ? "justify-center text-center"
            : ""
        : "";
    return (
      <div className="relative w-full">
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-transparent caret-[var(--foreground)] ring-offset-[var(--background)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--muted-weak)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            className
          )}
          type={resolvedType}
          inputMode={resolvedInputMode}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />
        {displayParts ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center px-3 py-2 text-sm tabular-nums text-[var(--foreground)]",
              alignClassName,
              displayClassName
            )}
          >
            {hasComma ? <span className="text-[color:var(--primary)]">{displayParts.prefix}</span> : displayParts.prefix}
            {displayParts.rest}
            {displayParts.decimal ? <><span className="decimal-point-emphasis">.</span>{displayParts.decimal.slice(1)}</> : null}
          </div>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] ring-offset-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
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
        "flex min-h-[80px] w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] ring-offset-[var(--background)] placeholder:text-[var(--muted-weak)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      {...props}
    />
  );
}
