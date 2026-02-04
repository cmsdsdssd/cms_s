import { cn } from "@/lib/utils";
import { formatNumber, splitFormattedNumberParts } from "@/lib/number";

type NumberTextProps = {
  value?: number | null;
  className?: string;
  highlightClassName?: string;
};

export function NumberText({ value, className, highlightClassName }: NumberTextProps) {
  const formatted = formatNumber(value);
  const parts = splitFormattedNumberParts(formatted);
  const hasComma = Boolean(parts.rest);
  return (
    <span className={className}>
      {hasComma ? <span className={cn("text-[color:var(--primary)]", highlightClassName)}>{parts.prefix}</span> : parts.prefix}
      {parts.rest}
      {parts.decimal ? <span className="text-[#fca5a5]">{parts.decimal}</span> : null}
    </span>
  );
}
