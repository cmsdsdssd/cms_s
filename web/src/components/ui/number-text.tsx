import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number";

type NumberTextProps = {
  value?: number | null;
  className?: string;
  highlightClassName?: string;
};

export function NumberText({ value, className, highlightClassName }: NumberTextProps) {
  const formatted = formatNumber(value);
  const [integerPartRaw, decimalPartRaw] = formatted.split(".");
  const integerPart = integerPartRaw ?? "";
  const lastCommaIndex = integerPart.lastIndexOf(",");
  const head = lastCommaIndex === -1 ? "" : integerPart.slice(0, lastCommaIndex);
  const tailInt = lastCommaIndex === -1 ? integerPart : integerPart.slice(lastCommaIndex);
  const tailDecimal = decimalPartRaw ?? "";
  return (
    <span className={className}>
      {head ? <span className={cn("text-[color:var(--primary)]", highlightClassName)}>{head}</span> : null}
      {tailInt}
      {tailDecimal ? <><span className="decimal-point-emphasis">.</span>{tailDecimal}</> : null}
    </span>
  );
}
