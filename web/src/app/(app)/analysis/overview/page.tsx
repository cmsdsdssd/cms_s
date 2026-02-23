"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSchemaClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import { formatKrw, getKstYmd, getKstYmdOffset, toNumber } from "@/components/analysis/analysis-helpers";
import {
  AnalysisCopyLinkButton,
  AnalysisFreshnessBadge,
  AnalysisHelpSection,
  AnalysisReadOnlyBadge,
  AnalysisSkeletonBlock,
} from "@/components/analysis/analysis-common";

type OverviewSummary = {
  leakage?: {
    neg_margin_count?: number;
    below_floor_count?: number;
    provisional_cost_count?: number;
    stale_tick_count?: number;
  };
  integrity?: {
    ar_mismatch_count?: number;
    labor_mismatch_count?: number;
    cost_missing_count?: number;
    inventory_exception_count?: number;
  };
  market?: {
    stale_symbol_count?: number;
    avg_age_minutes?: number;
  };
  sales?: {
    active_customers?: number;
    top_growth_count?: number;
  };
  recommendations?: {
    sampled_parties?: number;
  };
  top_issues?: Array<{ title?: string; severity?: string; impact_krw?: number; href?: string }>;
};

export default function AnalysisOverviewPage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => getKstYmd());

  const query = useQuery({
    queryKey: ["analysis-overview", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient.rpc("cms_fn_an_overview_summary_v1", {
        p_from: fromYmd,
        p_to: toYmd,
      });
      if (error) throw error;
      return (data ?? null) as OverviewSummary | null;
    },
  });

  const subtitle = useMemo(
    () => `기간: ${fromYmd} ~ ${toYmd} · 오늘 상태를 30초 내 요약`,
    [fromYmd, toYmd]
  );

  const summary = query.data;

  return (
    <AnalysisPageShell
      title="분석 요약"
      subtitle={subtitle}
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={query.isFetching} /><AnalysisCopyLinkButton /><AnalysisHeaderRefresh onRefresh={() => query.refetch()} loading={query.isFetching} /></div>}
      filterBar={<AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd} />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="누수 이슈"
          value={String(toNumber(summary?.leakage?.neg_margin_count) + toNumber(summary?.leakage?.below_floor_count))}
          trend={`NEG_MARGIN ${toNumber(summary?.leakage?.neg_margin_count)} / BELOW_FLOOR ${toNumber(summary?.leakage?.below_floor_count)}`}
          trendTone="danger"
        />
        <KpiCard
          label="정합성 이슈"
          value={String(toNumber(summary?.integrity?.ar_mismatch_count) + toNumber(summary?.integrity?.labor_mismatch_count))}
          trend={`AR ${toNumber(summary?.integrity?.ar_mismatch_count)} / LABOR ${toNumber(summary?.integrity?.labor_mismatch_count)}`}
          trendTone="danger"
        />
        <KpiCard
          label="시장 경보"
          value={String(toNumber(summary?.market?.stale_symbol_count))}
          trend={`평균 age ${toNumber(summary?.market?.avg_age_minutes).toFixed(1)}분`}
          trendTone="muted"
        />
      </div>

      <Card>
        <CardHeader title="Top Issues" description="severity + impact 순으로 상위 10건" />
        <CardBody>
          {query.isLoading ? <AnalysisSkeletonBlock /> : null}
          {query.error ? <p className="text-sm text-[var(--danger)]">요약 데이터를 불러오지 못했습니다.</p> : null}
          <div className="space-y-2">
            {(summary?.top_issues ?? []).map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <div className="text-sm font-semibold">{item.title ?? "이슈"}</div>
                <div className="text-xs text-[var(--muted)]">
                  severity={item.severity ?? "-"} · impact={formatKrw(item.impact_krw ?? 0)}
                  {item.href ? (
                    <>
                      {" · "}
                      <Link className="underline" href={item.href}>
                        이동
                      </Link>
                    </>
                  ) : ""}
                </div>
              </div>
            ))}
            {!query.isLoading && (summary?.top_issues?.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--muted)]">표시할 이슈가 없습니다.</p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AnalysisHelpSection
          title="지표 정의"
          items={[
            { label: "누수 이슈", description: "NEG_MARGIN + BELOW_FLOOR 합계입니다." },
            { label: "정합성 이슈", description: "AR mismatch + labor mismatch 기반입니다." },
          ]}
        />
        <Card>
          <CardHeader title="모듈 빠른 이동" description="Top issue drill-down" />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/analysis/leakage"><Button variant="secondary">누수</Button></Link>
            <Link href="/analysis/integrity"><Button variant="secondary">정합성</Button></Link>
            <Link href="/analysis/market"><Button variant="secondary">시세</Button></Link>
            <Link href="/analysis/sales-priority"><Button variant="secondary">영업</Button></Link>
            <Link href="/analysis/recommendations"><Button variant="secondary">추천</Button></Link>
          </CardBody>
        </Card>
      </div>
    </AnalysisPageShell>
  );
}
