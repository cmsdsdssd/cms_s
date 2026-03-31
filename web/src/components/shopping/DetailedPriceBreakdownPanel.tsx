import type { GalleryDetailBaseBreakdown } from "@/lib/shop/channel-products-gallery-detail";
import type { VariantCompareStatus } from "@/lib/shop/variant-compare-status";

type Props = {
  baseBreakdown: GalleryDetailBaseBreakdown | null | undefined;
  publishedMinPriceKrw: number | null | undefined;
  publishedMaxPriceKrw: number | null | undefined;
  compareStatusOverride?: VariantCompareStatus | null | undefined;
  compareDetailOverride?: string | null | undefined;
};

type Fact = {
  label: string;
  value: string;
  secondaryValue?: string | null;
  detail?: string | null;
  formula?: string | null;
  leadingHighlights?: string[];
  highlights?: string[];
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  surfaceTone?: "default" | "success" | "primary";
  wide?: boolean;
  compact?: boolean;
  cardClassName?: string;
};

const formatMoney = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString()}원`;
};

const formatRate = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
};

const formatFactor = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
};

const formatWeight = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} g`;
};

const formatWhen = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
};

const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

const formatCompactTimestamp = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  const date = new Date(parsed);
  const year = padTwoDigits(date.getFullYear() % 100);
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());
  const seconds = padTwoDigits(date.getSeconds());

  return `${year}${month}${day} |${hours}:${minutes}:${seconds}`;
};

const formatBasis = (value: string | null | undefined): string => {
  if (!value) return "-";
  if (value === "GOLD") return "금 시세";
  if (value === "SILVER") return "은 시세";
  return value;
};

const formatSelectedBasis = (value: string | null | undefined): string => {
  if (!value) return "-";
  if (value === "override") return "override 선택";
  if (value === "floor") return "floor 선택";
  if (value === "guardrail") return "guardrail 선택";
  if (value === "rounding") return "올림가 선택";
  if (value === "candidate") return "후보가 선택";
  if (value === "published") return "게시가 사용";
  return value;
};

const formatStorefrontCompareStatus = (value: "MATCH" | "THRESHOLD_HELD" | "OUT_OF_SYNC" | "UNAVAILABLE" | null | undefined): string => {
  if (value === "MATCH") return "일치";
  if (value === "THRESHOLD_HELD") return "정상 보류";
  if (value === "OUT_OF_SYNC") return "차이 있음";
  return "비교 불가";
};

const hasNumber = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

const hasText = (value: string | null | undefined): value is string => typeof value === "string" && value.trim().length > 0;

const compact = <T,>(values: Array<T | null | undefined | false>): T[] => values.filter(Boolean) as T[];

const joinDetail = (...parts: Array<string | null | undefined | false>): string | null => {
  const filtered = parts.filter((part): part is string => Boolean(part && part !== "-"));
  return filtered.length > 0 ? filtered.join(" · ") : null;
};

const formatNamedRate = (label: string, value: number | null | undefined): string | null => {
  if (!hasNumber(value)) return null;
  return `${label} ${formatRate(value)}`;
};

const formatAbsorbSecondaryValue = (value: number | null | undefined): string | null => {
  if (!hasNumber(value) || value === 0) return null;
  return `(흡수공임 ${formatMoney(value)})`;
};

const toneClassName = (tone: Fact["tone"] = "default") => {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-destructive";
  if (tone === "primary") return "text-primary";
  return "text-[var(--foreground)]";
};

const surfaceToneClassName = (tone: Fact["surfaceTone"] = "default") => {
  if (tone === "success") {
    return "border-[var(--success-soft)] bg-[linear-gradient(180deg,var(--success-soft),var(--panel)_60%)]";
  }
  if (tone === "primary") {
    return "border-[var(--primary-soft)] bg-[linear-gradient(180deg,var(--primary-soft),var(--panel)_60%)]";
  }
  return "border-[var(--hairline)] bg-[var(--panel)]";
};

function SummaryCard({ label, value, detail, tone = "default" }: Fact) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${toneClassName(tone)}`}>{value}</div>
      {detail ? <div className="mt-1 text-[11px] text-[var(--muted)]">{detail}</div> : null}
    </div>
  );
}

function FactCard({ fact, dense = false }: { fact: Fact; dense?: boolean }) {
  const detailItems = compact<{ label: string; value: string }>([
    fact.formula ? { label: "계산식", value: fact.formula } : null,
    fact.detail ? { label: "설명", value: fact.detail } : null,
  ]);

  return (
    <div
      className={[
        "rounded-[var(--radius)] border text-xs",
        surfaceToneClassName(fact.surfaceTone),
        dense ? "px-2 py-2" : "px-2.5 py-2.5",
        fact.cardClassName ?? (fact.wide ? (dense ? "sm:col-span-2 xl:col-span-4" : "md:col-span-2") : ""),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {fact.leadingHighlights?.map((highlight) => (
              <span
                key={`${fact.label}-leading-${highlight}`}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium leading-none tabular-nums text-[var(--muted-strong)]"
              >
                {highlight}
              </span>
            ))}
            <div className="font-semibold text-[var(--foreground)]">{fact.label}</div>
            {fact.highlights?.map((highlight) => (
              <span
                key={`${fact.label}-${highlight}`}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-medium leading-none tabular-nums text-[var(--muted-strong)]"
              >
                {highlight}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-sm font-semibold tabular-nums ${toneClassName(fact.tone)}`}>{fact.value}</div>
          {fact.secondaryValue ? <div className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{fact.secondaryValue}</div> : null}
        </div>
      </div>

      {detailItems.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-[11px] text-[var(--muted)]">
            <span className="flex items-center justify-between gap-2">
              <span>세부 내용</span>
              <span className="text-[10px] text-[var(--muted)]">{detailItems.length}개</span>
            </span>
          </summary>

          <div className="mt-2 space-y-1.5 border-t border-[var(--hairline)] pt-2">
            {detailItems.map((item) => (
              <div
                key={`${fact.label}-${item.label}`}
                className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2 py-2"
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{item.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-[var(--muted-strong)]">{item.value}</div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FlowStep({
  index,
  title,
  summary,
  facts,
  emptyText,
  compactGridClass = "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4",
  regularGridClass = "grid grid-cols-1 gap-2 md:grid-cols-2",
  groups,
}: {
  index: number;
  title: string;
  summary: string;
  facts: Fact[];
  emptyText: string;
  compactGridClass?: string;
  regularGridClass?: string;
  groups?: Array<{ facts: Fact[]; gridClass: string; dense?: boolean }>;
}) {
  const compactFacts = facts.filter((fact) => fact.compact);
  const regularFacts = facts.filter((fact) => !fact.compact);
  const sections = groups ?? compact([
    compactFacts.length > 0 ? { facts: compactFacts, gridClass: compactGridClass, dense: true } : null,
    regularFacts.length > 0 ? { facts: regularFacts, gridClass: regularGridClass } : null,
  ]);

  return (
    <section className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">{summary}</div>
        </div>
      </div>

      <div className="mt-3">
        {facts.length > 0 ? (
          <div className="space-y-2">
            {sections.map((section, sectionIndex) => (
              <div key={`${title}-group-${sectionIndex}`} className={section.gridClass}>
                {section.facts.map((fact) => (
                  <FactCard key={`${title}-${fact.label}`} fact={fact} dense={section.dense} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] bg-[var(--panel)] px-3 py-4 text-sm text-[var(--muted)]">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

export function DetailedPriceBreakdownPanel({
  baseBreakdown,
  publishedMinPriceKrw,
  publishedMaxPriceKrw,
  compareStatusOverride,
  compareDetailOverride,
}: Props) {
  const detailed = baseBreakdown?.detailed ?? null;
  const summaryRows = baseBreakdown?.rows ?? [];
  const laborComponents = detailed?.laborComponents ?? [];
  const laborComponentByKey = new Map(laborComponents.map((component) => [component.key, component]));

  if (!baseBreakdown) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3">
        <div className="mb-2 text-sm font-medium">기준가 계산 흐름</div>
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] bg-[var(--background)] px-3 py-4 text-sm text-[var(--muted)]">
          표시할 기준가 계산 정보가 없습니다.
        </div>
      </div>
    );
  }

  const publishedRangeDetail = hasNumber(publishedMinPriceKrw) || hasNumber(publishedMaxPriceKrw)
    ? `${formatMoney(publishedMinPriceKrw)} - ${formatMoney(publishedMaxPriceKrw)}`
    : null;
  const storefrontValueMissing = !detailed || !hasNumber(detailed.storefrontPriceKrw);
  const selectedValueMissing = !detailed || !hasNumber(detailed.selectedPriceKrw);
  const effectiveCompareStatus: VariantCompareStatus | null = selectedValueMissing || storefrontValueMissing
    ? "UNAVAILABLE"
    : (compareStatusOverride ?? detailed?.storefrontCompareStatus ?? null);
  const freshnessText = baseBreakdown.snapshot_available
    ? (() => {
        const timestamp = detailed?.marketTickAsOf ?? baseBreakdown.computed_at;
        const formatted = formatWhen(timestamp);
        return formatted !== "-" ? formatted : "snapshot ready";
      })()
    : "snapshot unavailable";
  const showRoundedStage = Boolean(detailed && hasNumber(detailed.roundedTargetPriceKrw));

  const outcomeFacts: Fact[] = [
    {
      label: "published base",
      value: hasNumber(baseBreakdown.published_base_price_krw)
        ? formatMoney(baseBreakdown.published_base_price_krw)
        : "게시 기준가 없음",
      detail: publishedRangeDetail ? `게시 범위 ${publishedRangeDetail}` : null,
      tone: hasNumber(baseBreakdown.published_base_price_krw) ? "default" : "warning",
    },
    {
      label: "storefront compare",
      value: storefrontValueMissing ? "storefront 비교값 없음" : formatMoney(detailed.storefrontPriceKrw),
      detail: storefrontValueMissing
        ? "blocking field"
        : joinDetail(
            detailed?.storefrontPriceSource === "LIVE"
              ? "live storefront"
              : detailed?.storefrontPriceSource === "PUBLISHED_PREVIEW"
                ? "published preview"
                : null,
            detailed?.marketTickAsOf ? `as-of ${formatWhen(detailed.marketTickAsOf)}` : null
          ),
      tone: storefrontValueMissing ? "warning" : "default",
    },
    {
      label: "compare status",
      value: selectedValueMissing || storefrontValueMissing
        ? "비교 불가"
        : formatStorefrontCompareStatus(effectiveCompareStatus),
      detail: selectedValueMissing
        ? "선택 기준가 없음"
        : storefrontValueMissing
          ? null
          : joinDetail(
              compareDetailOverride,
              effectiveCompareStatus === "THRESHOLD_HELD" && !compareDetailOverride ? "threshold 미만 보류" : null,
              detailed?.storefrontDiffKrw == null ? null : `차이 ${formatMoney(detailed.storefrontDiffKrw)}`,
              detailed?.storefrontDiffPct == null ? null : formatRate(detailed.storefrontDiffPct)
            ),
      tone: selectedValueMissing || storefrontValueMissing
        ? "warning"
        : effectiveCompareStatus === "MATCH"
          ? "success"
          : effectiveCompareStatus === "THRESHOLD_HELD"
            ? "primary"
            : "danger",
    },
    {
      label: "freshness",
      value: freshnessText,
      detail: baseBreakdown.snapshot_available
        ? detailed?.marketTickAsOf
          ? "market snapshot timestamp"
          : baseBreakdown.computed_at
            ? "computed_at timestamp"
            : null
        : "세부 계산 snapshot이 없어 trace를 펼칠 수 없습니다.",
      tone: baseBreakdown.snapshot_available ? "default" : "warning",
    },
    {
      label: "publish version",
      value: hasText(baseBreakdown.publish_version) ? baseBreakdown.publish_version : "publish version 없음",
      detail: hasText(baseBreakdown.computed_at) ? `computed ${formatWhen(baseBreakdown.computed_at)}` : null,
      tone: hasText(baseBreakdown.publish_version) ? "default" : "warning",
    },
  ];

  const stepOneFactsBase = compact<Fact>([
    detailed && hasText(detailed.materialCodeEffective)
      ? {
          label: "적용 소재",
          value: detailed.materialCodeEffective,
          compact: true,
        }
      : null,
    detailed && (hasNumber(detailed.marketTickKrwPerG) || hasText(detailed.marketTickLabel))
      ? {
          label: "시세 입력",
          value: hasNumber(detailed.marketTickKrwPerG)
            ? `${formatBasis(detailed.marketTickLabel)} ${formatMoney(detailed.marketTickKrwPerG)}`
            : formatBasis(detailed.marketTickLabel),
          highlights: compact<string>([formatCompactTimestamp(detailed.marketTickAsOf)]),
          compact: true,
        }
      : null,
    detailed && (hasNumber(detailed.netWeightG) || hasNumber(detailed.convertedWeightG))
      ? {
          label: "중량 환산",
          value: `${formatWeight(detailed.netWeightG)} -> ${formatWeight(detailed.convertedWeightG)}`,
          detail: joinDetail(
            hasNumber(detailed.purityRate) ? `함량 ${formatRate(detailed.purityRate)}` : null,
            hasNumber(detailed.adjustFactor) ? `보정 ${formatFactor(detailed.adjustFactor)}` : null,
            hasNumber(detailed.effectiveFactor) ? `환산계수 ${formatFactor(detailed.effectiveFactor)}` : null,
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(detailed.materialPriceKrw)
        ? {
            label: "소재가 총합",
            value: formatMoney(detailed.materialPriceKrw),
            leadingHighlights: compact<string>([
              formatNamedRate("소재 마진", detailed.materialMarginRate),
            ]),
            surfaceTone: "success",
            formula:
              hasNumber(detailed.materialMarginRate) && hasNumber(detailed.materialPriceAfterMarginKrw)
                ? `${formatMoney(detailed.materialPriceKrw)} x (1 + ${formatRate(detailed.materialMarginRate)}) = ${formatMoney(detailed.materialPriceAfterMarginKrw)}`
                : hasNumber(detailed.materialMarginRate)
                  ? `소재가 x (1 + ${formatRate(detailed.materialMarginRate)})`
                : null,
          detail: joinDetail(
            hasNumber(detailed.materialMarginAmountKrw) ? `마진 ${formatMoney(detailed.materialMarginAmountKrw)}` : null,
            hasNumber(detailed.materialPriceAfterMarginKrw) ? `소재 pre-fee ${formatMoney(detailed.materialPriceAfterMarginKrw)}` : null,
          ),
          compact: true,
        }
      : null,
  ]);

  const stepOneFacts = stepOneFactsBase.length === 4
    ? stepOneFactsBase.map((fact, index) => ({
        ...fact,
        cardClassName: index === 0 ? "xl:col-span-1" : index === 1 ? "xl:col-span-4" : index === 3 ? "xl:col-span-4" : "xl:col-span-3",
      }))
    : stepOneFactsBase;
  const stepOneCompactGridClass = stepOneFacts.length === 4
    ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-12"
    : "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4";

  const stepTwoLaborFacts = compact<Fact>([
    detailed && hasNumber(laborComponentByKey.get("BASE_LABOR")?.costIncludingAbsorbKrw ?? detailed.laborBaseSellKrw)
      ? {
          label: "기본공임 원가",
          value: formatMoney(laborComponentByKey.get("BASE_LABOR")?.costIncludingAbsorbKrw ?? detailed.laborBaseSellKrw),
          secondaryValue: formatAbsorbSecondaryValue(
            laborComponentByKey.get("BASE_LABOR")?.absorbAppliedKrw ?? laborComponentByKey.get("BASE_LABOR")?.absorbRawKrw
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(laborComponentByKey.get("STONE_LABOR")?.costIncludingAbsorbKrw ?? detailed.laborStoneSellKrw)
      ? {
          label: "알공임 원가",
          value: formatMoney(laborComponentByKey.get("STONE_LABOR")?.costIncludingAbsorbKrw ?? detailed.laborStoneSellKrw),
          secondaryValue: formatAbsorbSecondaryValue(
            laborComponentByKey.get("STONE_LABOR")?.absorbAppliedKrw ?? laborComponentByKey.get("STONE_LABOR")?.absorbRawKrw
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(laborComponentByKey.get("PLATING")?.costIncludingAbsorbKrw ?? detailed.laborPlatingSellKrw)
      ? {
          label: "도금공임 원가",
          value: formatMoney(laborComponentByKey.get("PLATING")?.costIncludingAbsorbKrw ?? detailed.laborPlatingSellKrw),
          secondaryValue: formatAbsorbSecondaryValue(
            laborComponentByKey.get("PLATING")?.absorbAppliedKrw ?? laborComponentByKey.get("PLATING")?.absorbRawKrw
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(laborComponentByKey.get("DECOR")?.costIncludingAbsorbKrw ?? detailed.laborDecorSellKrw)
      ? {
          label: "장식공임 원가",
          value: formatMoney(laborComponentByKey.get("DECOR")?.costIncludingAbsorbKrw ?? detailed.laborDecorSellKrw),
          secondaryValue: formatAbsorbSecondaryValue(
            laborComponentByKey.get("DECOR")?.absorbAppliedKrw ?? laborComponentByKey.get("DECOR")?.absorbRawKrw
          ),
          compact: true,
        }
      : null,
  ]);

  const stepTwoSummaryFacts = compact<Fact>([
    detailed && (hasNumber(detailed.laborTotalAbsorbAppliedKrw) || hasNumber(detailed.laborTotalAbsorbRawKrw))
      ? {
          label: "흡수공임합",
          value: hasNumber(detailed.laborTotalAbsorbAppliedKrw)
            ? formatMoney(detailed.laborTotalAbsorbAppliedKrw)
            : formatMoney(detailed.laborTotalAbsorbRawKrw),
          detail: joinDetail(
            hasNumber(detailed.absorbBaseLaborKrw) ? `기본 ${formatMoney(detailed.absorbBaseLaborKrw)}` : null,
            hasNumber(detailed.absorbStoneLaborKrw) ? `석 ${formatMoney(detailed.absorbStoneLaborKrw)}` : null,
            hasNumber(detailed.absorbPlatingKrw) ? `도금 ${formatMoney(detailed.absorbPlatingKrw)}` : null,
            hasNumber(detailed.absorbEtcKrw) ? `기타 ${formatMoney(detailed.absorbEtcKrw)}` : null,
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(detailed.laborTotalIncludingAbsorbKrw)
      ? {
          label: "공임원가합(흡수 포함)",
          value: formatMoney(detailed.laborTotalIncludingAbsorbKrw),
          leadingHighlights: compact<string>([
            formatNamedRate("공임 마진", detailed.laborMarginRate),
          ]),
          compact: true,
        }
      : null,
  ]);

  const stepTwoFinalFacts = compact<Fact>([
    detailed && hasNumber(detailed.laborPriceAfterMarginKrw)
      ? {
          label: "공임 마진 적용",
          value: formatMoney(detailed.laborPriceAfterMarginKrw),
          formula:
            hasNumber(detailed.laborTotalIncludingAbsorbKrw) && hasNumber(detailed.laborMarginRate)
              ? `${formatMoney(detailed.laborTotalIncludingAbsorbKrw)} x (1 + ${formatRate(detailed.laborMarginRate)}) = ${formatMoney(detailed.laborPriceAfterMarginKrw)}`
              : null,
          detail: joinDetail(
            hasNumber(detailed.laborMarginAmountKrw) ? `마진 ${formatMoney(detailed.laborMarginAmountKrw)}` : null,
            hasNumber(detailed.laborTotalIncludingAbsorbKrw) ? `공임원가합 ${formatMoney(detailed.laborTotalIncludingAbsorbKrw)}` : null,
          ),
          compact: true,
        }
      : null,
    detailed && hasNumber(detailed.fixedPreFeeKrw)
      ? {
          label: "고정항목",
          value: formatMoney(detailed.fixedPreFeeKrw),
          highlights: compact<string>([formatNamedRate("고정 마진", detailed.fixedMarginRate)]),
          formula: hasNumber(detailed.fixedMarginRate) ? `고정원가 x (1 + ${formatRate(detailed.fixedMarginRate)})` : null,
          compact: true,
        }
      : null,
    detailed && hasNumber(detailed.laborPriceAfterMarginKrw)
      ? {
          label: "공임가 총합",
          value: formatMoney(detailed.laborPriceAfterMarginKrw),
          compact: true,
          surfaceTone: "success",
        }
      : null,
  ]);

  const stepTwoFacts = compact<Fact>([
    ...stepTwoLaborFacts,
    ...stepTwoSummaryFacts,
    ...stepTwoFinalFacts,
  ]);

  const stepThreeFacts = compact<Fact>([
    detailed && hasNumber(detailed.candidatePreFeeKrw)
      ? {
          label: "후보합(수수료 전)",
          compact: true,
          value: formatMoney(detailed.candidatePreFeeKrw),
          detail: joinDetail(
            hasNumber(detailed.materialPriceAfterMarginKrw) ? `소재 ${formatMoney(detailed.materialPriceAfterMarginKrw)}` : null,
            hasNumber(detailed.laborPriceAfterMarginKrw) ? `공임 ${formatMoney(detailed.laborPriceAfterMarginKrw)}` : null,
            hasNumber(detailed.fixedPreFeeKrw) ? `고정 ${formatMoney(detailed.fixedPreFeeKrw)}` : null
          ),
        }
      : null,
    detailed && hasNumber(detailed.candidatePriceKrw)
      ? {
          label: "후보기준가",
          compact: true,
          value: formatMoney(detailed.candidatePriceKrw),
          leadingHighlights: compact<string>([
            formatNamedRate("수수료", detailed.feeRate),
          ]),
          formula:
            hasNumber(detailed.feeRate) && hasNumber(detailed.candidatePreFeeKrw)
              ? `${formatMoney(detailed.candidatePreFeeKrw)} / (1 - ${formatRate(detailed.feeRate)}) = ${formatMoney(detailed.candidatePriceKrw)}`
              : null,
          detail: joinDetail(
            hasNumber(detailed.feeMarginAmountKrw) ? `수수료 가산 ${formatMoney(detailed.feeMarginAmountKrw)}` : null,
            hasNumber(detailed.candidatePreFeeKrw) ? `후보합 ${formatMoney(detailed.candidatePreFeeKrw)}` : null
          ),
        }
      : null,
    detailed && hasNumber(detailed.guardrailPriceKrw)
      ? {
          label: "가드레일",
          compact: true,
          value: formatMoney(detailed.guardrailPriceKrw),
          leadingHighlights: compact<string>([
            formatNamedRate("수수료", detailed.feeRate),
          ]),
          highlights: compact<string>([
            formatNamedRate("가드레일", detailed.guardrailRate),
          ]),
          formula:
            hasNumber(detailed.guardrailRate) && hasNumber(detailed.feeRate)
              ? `원가합 / (1 - ${formatRate(detailed.feeRate)} - ${formatRate(detailed.guardrailRate)}) = ${formatMoney(detailed.guardrailPriceKrw)}`
              : hasNumber(detailed.guardrailRate)
                ? `가드레일율 ${formatRate(detailed.guardrailRate)}`
                : null,
          detail: joinDetail(
            hasText(detailed.guardrailReasonCode) ? detailed.guardrailReasonCode : null
          ),
        }
      : null,
    detailed && hasNumber(detailed.roundedTargetPriceKrw)
      ? {
          label: "반올림 결과",
          compact: true,
          value: formatMoney(detailed.roundedTargetPriceKrw),
          detail: joinDetail(
            hasNumber(detailed.roundingUnitKrw)
              ? `단위 ${Math.round(detailed.roundingUnitKrw).toLocaleString()}원`
              : null,
            hasText(detailed.roundingMode) ? detailed.roundingMode : null
          ),
        }
      : null,
  ]);

  const stepFourFacts = compact<Fact>([
    {
      label: "선택 기준가",
      compact: true,
      value: selectedValueMissing ? "선택 기준가 없음" : formatMoney(detailed?.selectedPriceKrw),
      detail: selectedValueMissing ? "blocking field" : joinDetail(formatSelectedBasis(detailed?.selectedPriceBasis ?? null), hasNumber(detailed?.candidatePriceKrw) ? `후보 ${formatMoney(detailed?.candidatePriceKrw ?? null)}` : null, hasNumber(detailed?.guardrailPriceKrw) ? `가드레일 ${formatMoney(detailed?.guardrailPriceKrw ?? null)}` : null),
      tone: selectedValueMissing ? "warning" : "primary",
      surfaceTone: selectedValueMissing ? "default" : "primary",
    },
    {
      label: "게시 기준가",
      compact: true,
      value: hasNumber(baseBreakdown.published_base_price_krw)
        ? formatMoney(baseBreakdown.published_base_price_krw)
        : "게시 기준가 없음",
      detail: publishedRangeDetail ? `허용 범위 ${publishedRangeDetail}` : null,
      tone: hasNumber(baseBreakdown.published_base_price_krw) ? "default" : "warning",
    },
    hasNumber(baseBreakdown.target_price_raw_krw)
      ? {
          label: "계산 목표가",
          compact: true,
          value: formatMoney(baseBreakdown.target_price_raw_krw),
        }
      : null,
  ]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">기준가 계산 흐름</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            운영자가 먼저 publish/storefront 결과를 보고, 이어서 4단계 계산 흐름과 audit trace를 분리해서 확인합니다.
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {outcomeFacts.map((fact) => (
          <SummaryCard key={fact.label} {...fact} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <FlowStep
          index={1}
          title="시장 / 소재 입력"
          summary="시세 기준, 적용 소재, 중량 환산, 소재가를 먼저 확인합니다."
          facts={stepOneFacts}
          compactGridClass={stepOneCompactGridClass}
          regularGridClass="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
          emptyText={baseBreakdown.snapshot_available ? "표시할 시장/소재 trace가 없습니다." : "snapshot unavailable"}
        />

        <FlowStep
          index={2}
          title="공임 / 고정 입력"
          summary="공임 합계와 흡수 반영, 공임 마진 적용, 고정 항목을 분리해 봅니다."
          facts={stepTwoFacts}
          groups={[
            { facts: stepTwoLaborFacts, gridClass: "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4", dense: true },
            { facts: stepTwoSummaryFacts, gridClass: "grid grid-cols-1 gap-2 md:grid-cols-2", dense: true },
            { facts: stepTwoFinalFacts, gridClass: "grid grid-cols-1 gap-2 md:grid-cols-3", dense: true },
          ]}
          compactGridClass="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
          regularGridClass="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-2"
          emptyText={baseBreakdown.snapshot_available ? "표시할 공임/고정 입력값이 없습니다." : "snapshot unavailable"}
        />

        <FlowStep
          index={3}
          title={showRoundedStage ? "후보가 / 가드레일 / 반올림" : "후보가 / 가드레일"}
          summary={showRoundedStage ? "후보 기준가가 어떻게 guardrail과 rounding을 거쳐 정리되는지 순서대로 봅니다." : "후보 기준가와 가드레일 중 어떤 값이 선택되는지 순서대로 봅니다."}
          facts={stepThreeFacts}
          compactGridClass="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
          regularGridClass="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
          emptyText={baseBreakdown.snapshot_available ? "표시할 후보/가드레일 trace가 없습니다." : "snapshot unavailable"}
        />

        <FlowStep
          index={4}
          title="선택 기준가"
          summary="최종 선택 기준가와 publish 기준가를 바로 비교합니다."
          facts={stepFourFacts}
          compactGridClass="grid grid-cols-1 gap-2 md:grid-cols-3"
          regularGridClass="grid grid-cols-1 gap-2 md:grid-cols-3"
          emptyText="표시할 선택 기준가 정보가 없습니다."
        />
      </div>

      <div className="mt-4 space-y-3">
        <details className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-[var(--foreground)]">
            <span className="flex items-center justify-between gap-3">
              <span>공임 세부 audit</span>
              <span className="text-[11px] text-[var(--muted)]">{laborComponents.length} rows</span>
            </span>
          </summary>

          <div className="mt-3 space-y-2">
            {laborComponents.length > 0 ? (
              laborComponents.map((component) => {
                const componentFacts = compact<string>([
                  component.costExcludingAbsorbKrw == null ? null : `원가 ${formatMoney(component.costExcludingAbsorbKrw)}`,
                  component.costIncludingAbsorbKrw == null ? null : `원가+흡수 ${formatMoney(component.costIncludingAbsorbKrw)}`,
                  component.sellExcludingAbsorbKrw == null ? null : `판매가 ${formatMoney(component.sellExcludingAbsorbKrw)}`,
                  component.absorbRawKrw == null ? null : `흡수 raw ${formatMoney(component.absorbRawKrw)}`,
                  component.absorbAppliedKrw == null ? null : `흡수 적용 ${formatMoney(component.absorbAppliedKrw)}`,
                  component.sellIncludingAbsorbKrw == null ? null : `판매가+흡수 ${formatMoney(component.sellIncludingAbsorbKrw)}`,
                ]);

                return (
                  <div
                    key={component.key}
                    className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-3"
                  >
                    <div className="text-xs font-semibold text-[var(--foreground)]">{component.label}</div>
                    {componentFacts.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted-strong)]">
                        {componentFacts.map((entry) => (
                          <span
                            key={`${component.key}-${entry}`}
                            className="rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--background)] px-2 py-1"
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-[var(--muted)]">표시할 세부 공임값이 없습니다.</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-4 text-sm text-[var(--muted)]">
                공임 항목별 세부값이 없습니다.
              </div>
            )}
          </div>
        </details>

        <details className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-[var(--foreground)]">
            <span className="flex items-center justify-between gap-3">
              <span>요약 row audit</span>
              <span className="text-[11px] text-[var(--muted)]">{summaryRows.length} rows</span>
            </span>
          </summary>

          <div className="mt-3 space-y-2">
            {summaryRows.length > 0 ? (
              summaryRows.map((row) => (
                <div
                  key={`${row.label}-${row.amountKrw}`}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--foreground)]">{row.label}</div>
                    {row.detail ? <div className="mt-0.5 text-[11px] text-[var(--muted)]">{row.detail}</div> : null}
                  </div>
                  <div className="shrink-0 font-semibold text-[var(--foreground)]">{formatMoney(row.amountKrw)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-4 text-sm text-[var(--muted)]">
                요약 row가 없습니다.
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
