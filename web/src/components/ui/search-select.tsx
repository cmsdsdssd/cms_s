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
};

export function SearchSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  showResultsOnEmptyQuery = true,
}: SearchSelectProps) {
  const [query, setQuery] = useState("");
  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((option) => option.value === value)?.label ?? "";
  }, [options, value]);
  const inputValue = query.length > 0 ? query : selectedLabel;
  const normalizedQuery = query.trim();
  const showAll = normalizedQuery.includes("*");
  const cleanedQuery = normalizedQuery.replace(/\*/g, "").trim();
  const shouldShowResults = showResultsOnEmptyQuery || normalizedQuery.length > 0;
  const filtered = useMemo(
    () => {
      if (showAll) return options;
      const needle = cleanedQuery.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(needle));
    },
    [options, cleanedQuery, showAll]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      ) : null}

      <Input placeholder={placeholder} value={inputValue} onChange={(e) => setQuery(e.target.value)} />

      {shouldShowResults ? (
        <div className="max-h-40 overflow-y-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)]">
          {filtered.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange?.(option.value);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-[var(--primary)]/10 text-[var(--foreground)]" : "hover:bg-[var(--muted)]/10 text-[var(--foreground)]"
                )}
              >
                {option.label}
                {active ? <span className="text-xs text-[var(--primary)]">선택됨</span> : null}
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted)]">검색 결과 없음</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
