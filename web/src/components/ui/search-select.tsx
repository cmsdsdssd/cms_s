"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/field";

type Option = { label: string; value: string };

type SearchSelectProps = {
  label?: string;
  placeholder?: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  showResultsOnEmptyQuery?: boolean;
  floating?: boolean;
  columns?: number;
  clearValueOnType?: boolean;
};

export function SearchSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  showResultsOnEmptyQuery = true,
  floating = false,
  columns,
  clearValueOnType = false,
}: SearchSelectProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((option) => option.value === value)?.label ?? "";
  }, [options, value]);
  const inputValue = query.length > 0 ? query : selectedLabel;
  const normalizedQuery = query.trim();
  const showAll = normalizedQuery.includes("*");
  const cleanedQuery = normalizedQuery.replace(/\*/g, "").trim();
  const shouldShowResults = isFocused && (showResultsOnEmptyQuery ? normalizedQuery.length > 0 : normalizedQuery.length > 0);
  const filtered = useMemo(
    () => {
      if (showAll) return options;
      const needle = cleanedQuery.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(needle));
    },
    [options, cleanedQuery, showAll]
  );

  return (
    <div className={cn("space-y-2", floating && "relative", className)}>
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      ) : null}

      <Input
        placeholder={placeholder}
        value={inputValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => {
          const nextQuery = e.target.value;
          setQuery(nextQuery);
          if (clearValueOnType && value) {
            onChange?.("");
          }
        }}
      />

      {shouldShowResults ? (
        <div
          className={cn(
            "max-h-60 overflow-y-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-lg",
            floating && "absolute left-0 right-0 z-50 mt-1"
          )}
        >
          <div
            className="grid"
            style={columns && columns > 1 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
          >
            {filtered.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setQuery("");
                    setIsFocused(false);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-[var(--primary)]/10 text-[var(--foreground)]"
                      : "hover:bg-[var(--muted)]/10 text-[var(--foreground)]"
                  )}
                >
                  {option.label}
                  {active ? <span className="text-xs text-[var(--primary)]">선택됨</span> : null}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">검색 결과 없음</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
