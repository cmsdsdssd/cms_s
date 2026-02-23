"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { KpiCard } from "@/components/ui/kpi-card";
import { getSchemaClient } from "@/lib/supabase/client";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import { formatKrw, getKstYmd, getKstYmdOffset, toNumber } from "@/components/analysis/analysis-helpers";
import {
  AnalysisCopyLinkButton,
  AnalysisEvidencePreview,
  AnalysisExportCsvButton,
  AnalysisFreshnessBadge,
  AnalysisHelpSection,
  AnalysisReadOnlyBadge,
  AnalysisSkeletonBlock,
} from "@/components/analysis/analysis-common";

type TickHealth = { symbol: string; age_minutes: number | null; is_stale: boolean; last_observed_at: string | null };
type LeakageRow = { floor_delta_krw: number; leak_type: string; ship_date: string };
type MarketHealthSummary = { stale_count?: number; avg_age_minutes?: number; max_age_minutes?: number };
type OhlcRow = {
  day: string;
  symbol: string;
  open_krw_per_g: number | null;
  close_krw_per_g: number | null;
  high_krw_per_g: number | null;
  low_krw_per_g: number | null;
  tick_count: number | null;
};

export default function MarketPage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => getKstYmd());
  const [minMargin, setMinMargin] = useState("0.20");
  const [roundingUnit, setRoundingUnit] = useState("5000");

  const healthQuery = useQuery({
    queryKey: ["analysis-market-health"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as TickHealth[];
      const { data, error } = await schemaClient
        .from("cms_v_market_tick_health_v1")
        .select("symbol, age_minutes, is_stale, last_observed_at")
        .order("symbol", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TickHealth[];
    },
  });

  const healthSummaryQuery = useQuery({
    queryKey: ["analysis-market-health-summary"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient.rpc("cms_fn_an_market_health_summary_v1", {});
      if (error) throw error;
      return (data ?? null) as MarketHealthSummary | null;
    },
  });

  const ohlcQuery = useQuery({
    queryKey: ["analysis-market-ohlc", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as OhlcRow[];
      const { data, error } = await schemaClient
        .from("cms_v_market_tick_daily_ohlc_v1")
        .select("day, symbol, open_krw_per_g, close_krw_per_g, high_krw_per_g, low_krw_per_g, tick_count")
        .gte("day", fromYmd)
        .lte("day", toYmd)
        .order("day", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as OhlcRow[];
    },
  });

  const impactQuery = useQuery({
    queryKey: ["analysis-market-impact", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as LeakageRow[];
      const { data, error } = await schemaClient
        .from("cms_v_an_leakage_lines_v1")
        .select("floor_delta_krw, leak_type, ship_date")
        .eq("leak_type", "STALE_TICK")
        .gte("ship_date", fromYmd)
        .lte("ship_date", toYmd)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LeakageRow[];
    },
  });

  const staleCount = useMemo(
    () => healthSummaryQuery.data?.stale_count ?? healthQuery.data?.filter((row) => row.is_stale).length ?? 0,
    [healthSummaryQuery.data, healthQuery.data]
  );
  const tickDropCount = useMemo(
    () => (ohlcQuery.data ?? []).filter((row) => toNumber(row.tick_count) < 3).length,
    [ohlcQuery.data]
  );

  const whatIf = useMemo(() => {
    const margin = Number(minMargin);
    const round = Number(roundingUnit);
    const base = (impactQuery.data ?? []).reduce((sum, row) => sum + toNumber(row.floor_delta_krw), 0);
    if (!Number.isFinite(margin) || !Number.isFinite(round) || round <= 0) return { delta: 0, impactedLines: 0 };
    const factor = Math.max(0.5, margin / 0.2);
    return {
      delta: Math.round((base * factor) / round) * round,
      impactedLines: Math.round((impactQuery.data?.length ?? 0) * factor),
    };
  }, [impactQuery.data, minMargin, roundingUnit]);

  return (
    <AnalysisPageShell
      title="시세/정책 (MarketShock)"
      subtitle={`기간: ${fromYmd} ~ ${toYmd} · Read-only 시뮬레이션`}
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={healthQuery.isFetching || ohlcQuery.isFetching} /><AnalysisCopyLinkButton /><AnalysisExportCsvButton rows={(ohlcQuery.data ?? []) as unknown as Array<Record<string, unknown>>} filename={`analysis-market-${fromYmd}-${toYmd}.csv`} /><AnalysisHeaderRefresh onRefresh={() => healthQuery.refetch()} loading={healthQuery.isFetching} /></div>}
      filterBar={<AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd} />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Stale 심볼 수" value={String(staleCount)} trend="Tick Health" trendTone={staleCount > 0 ? "danger" : "success"} />
        <KpiCard label="Stale 의심 라인" value={String(impactQuery.data?.length ?? 0)} trend="기간 내 출고" trendTone="danger" />
        <KpiCard label="What-if 추정 증가" value={formatKrw(whatIf.delta)} trend={`라인 변화 ${whatIf.impactedLines}`} trendTone="success" />
        <KpiCard label="정책 상태" value="Read-only" trend="저장/적용 없음" trendTone="muted" />
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs">
        경고: What-if 인상은 수요 감소/고객 반발 위험이 있습니다. 적용 전 영업 검토가 필요합니다.
      </div>

      <Card>
        <CardHeader title="What-if 시뮬레이션" description="저장 없이 화면에서만 계산" />
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs text-[var(--muted)]">min_margin_rate</div>
            <Input value={minMargin} onChange={(e) => setMinMargin(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <div className="mb-1 text-xs text-[var(--muted)]">rounding_unit_krw</div>
            <Input value={roundingUnit} onChange={(e) => setRoundingUnit(e.target.value)} inputMode="numeric" />
          </div>
          <p className="md:col-span-2 text-xs text-[var(--muted)]">
            주의: 본 결과는 분석용 가정치이며 실제 저장/적용 버튼은 v1에서 제공하지 않습니다.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tick Health" description="symbol별 stale/age" />
        <CardBody>
          {healthQuery.isLoading ? <AnalysisSkeletonBlock /> : null}
          <div className="space-y-2">
            {(healthQuery.data ?? []).map((row) => (
              <div key={row.symbol} className="rounded border border-[var(--hairline)] p-3 text-sm">
                {row.symbol} · age={row.age_minutes ?? "-"}분 · stale={String(row.is_stale)}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tick 급감 감지" description="tick_count < 3" />
        <CardBody className="text-sm">
          급감 건수: {tickDropCount}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="변동성(최근 60행)" description="OHLC + tick_count" />
        <CardBody>
          {ohlcQuery.isLoading ? <AnalysisSkeletonBlock /> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-[var(--muted)]">
                  <th className="px-2 py-2">day</th>
                  <th className="px-2 py-2">symbol</th>
                  <th className="px-2 py-2">open</th>
                  <th className="px-2 py-2">close</th>
                  <th className="px-2 py-2">high/low</th>
                  <th className="px-2 py-2">tick_count</th>
                </tr>
              </thead>
              <tbody>
                {(ohlcQuery.data ?? []).map((row, idx) => (
                  <tr key={`${String(row.day)}-${String(row.symbol)}-${idx}`} className="border-b border-[var(--hairline)]">
                    <td className="px-2 py-2">{String(row.day ?? "-")}</td>
                    <td className="px-2 py-2">{String(row.symbol ?? "-")}</td>
                    <td className="px-2 py-2">{formatKrw(toNumber(row.open_krw_per_g))}</td>
                    <td className="px-2 py-2">{formatKrw(toNumber(row.close_krw_per_g))}</td>
                    <td className="px-2 py-2">{formatKrw(toNumber(row.high_krw_per_g))} / {formatKrw(toNumber(row.low_krw_per_g))}</td>
                    <td className="px-2 py-2">{String(row.tick_count ?? "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <AnalysisEvidencePreview evidence={{ stale_rule: "is_stale = true OR age > 6h", tick_drop_threshold: 3, period: `${fromYmd}~${toYmd}` }} />
          </div>
        </CardBody>
      </Card>

      <AnalysisHelpSection
        title="시장 해석 가이드"
        items={[
          { label: "stale 판정", description: "tick health view의 is_stale와 age_minutes를 그대로 사용합니다." },
          { label: "What-if", description: "저장 없이 추정치만 계산합니다. 정책값은 변경되지 않습니다." },
        ]}
      />
    </AnalysisPageShell>
  );
}
