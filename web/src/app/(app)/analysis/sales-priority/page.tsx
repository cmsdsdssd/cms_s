"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import { formatPercent, getKstYmd, getKstYmdOffset, toNumber } from "@/components/analysis/analysis-helpers";
import { getSchemaClient } from "@/lib/supabase/client";
import {
  AnalysisCopyLinkButton,
  AnalysisEmptyState,
  AnalysisExportCsvButton,
  AnalysisFreshnessBadge,
  AnalysisHelpSection,
  AnalysisReadOnlyBadge,
  AnalysisSkeletonBlock,
} from "@/components/analysis/analysis-common";

type SalesRow = {
  customer_party_id: string;
  customer_name: string;
  recency_days: number;
  frequency_90d: number;
  monetary_90d_krw: number;
  margin_rate_90d: number | null;
  ar_outstanding_krw: number;
  overdue_count: number;
  growth_score: number;
  risk_score: number;
  reason_text: string;
  app_link: string;
};

export default function SalesPriorityPage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-90));
  const [toYmd, setToYmd] = useState(() => getKstYmd());
  const [tab, setTab] = useState<"growth" | "risk">("growth");

  const query = useQuery({
    queryKey: ["analysis-sales-priority", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as SalesRow[];
      const { data, error } = await schemaClient
        .from("cms_v_an_sales_rfm_v1")
        .select("*")
        .gte("as_of_date", fromYmd)
        .lte("as_of_date", toYmd)
        .limit(300);
      if (error) throw error;
      return (data ?? []) as SalesRow[];
    },
  });

  const rows = useMemo(() => {
    const base = [...(query.data ?? [])];
    base.sort((a, b) => (tab === "growth" ? b.growth_score - a.growth_score : b.risk_score - a.risk_score));
    return base;
  }, [query.data, tab]);

  const top20 = rows.slice(0, 20);

  return (
    <AnalysisPageShell
      title="영업 우선순위 (SalesPriority)"
      subtitle={`기간: ${fromYmd} ~ ${toYmd} · 최근 90일 기본`}
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={query.isFetching} /><AnalysisCopyLinkButton /><AnalysisExportCsvButton rows={rows as unknown as Array<Record<string, unknown>>} filename={`analysis-sales-${fromYmd}-${toYmd}.csv`} /><AnalysisHeaderRefresh onRefresh={() => query.refetch()} loading={query.isFetching} /></div>}
      filterBar={<AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd} />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Active 고객" value={String(rows.length)} trend="최근 90일" />
        <KpiCard label="Top 20 비중" value={`${Math.round((top20.length / Math.max(rows.length, 1)) * 100)}%`} trend="고객 기준" />
        <KpiCard label="재구매율" value={`${Math.round((rows.filter((r) => r.frequency_90d > 1).length / Math.max(rows.length, 1)) * 100)}%`} trend="frequency > 1" />
        <KpiCard label="AR 리스크" value={String(rows.filter((r) => r.overdue_count > 0).length)} trend="overdue > 0" trendTone="danger" />
      </div>

      <Card>
        <CardHeader title="우선순위 탭" description="Growth / Risk 목적 분리" />
        <CardBody className="space-y-3">
          {query.isLoading ? <AnalysisSkeletonBlock /> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("growth")}
              className={`rounded px-3 py-1 text-sm ${tab === "growth" ? "bg-[var(--primary)] text-white" : "bg-[var(--chip)]"}`}
            >
              Growth
            </button>
            <button
              type="button"
              onClick={() => setTab("risk")}
              className={`rounded px-3 py-1 text-sm ${tab === "risk" ? "bg-[var(--primary)] text-white" : "bg-[var(--chip)]"}`}
            >
              Risk
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-[var(--muted)]">
                  <th className="px-2 py-2">거래처</th>
                  <th className="px-2 py-2">R/F/M</th>
                  <th className="px-2 py-2">Margin</th>
                  <th className="px-2 py-2">AR/Overdue</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.customer_party_id} className="border-b border-[var(--hairline)]">
                    <td className="px-2 py-2">{row.customer_name}</td>
                    <td className="px-2 py-2">R{toNumber(row.recency_days)} / F{toNumber(row.frequency_90d)} / M{toNumber(row.monetary_90d_krw)}</td>
                    <td className="px-2 py-2">{formatPercent(row.margin_rate_90d)}</td>
                    <td className="px-2 py-2">{toNumber(row.ar_outstanding_krw)} / {toNumber(row.overdue_count)}</td>
                    <td className="px-2 py-2">{tab === "growth" ? row.growth_score : row.risk_score}</td>
                    <td className="px-2 py-2">
                      {row.reason_text}
                      <Link className="ml-2 text-[var(--primary)] underline" href={row.app_link} target="_blank" rel="noreferrer">
                        업무
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.isLoading && rows.length === 0 ? <AnalysisEmptyState message="우선순위 데이터가 없습니다." /> : null}
        </CardBody>
      </Card>

      <AnalysisHelpSection
        title="스코어 가중치"
        items={[
          { label: "Growth", description: "Recency/Frequency/Monetary + margin_rate 가중합입니다." },
          { label: "Risk", description: "AR outstanding/overdue + recency 저하 + 저마진 패널티 가중합입니다." },
        ]}
      />
    </AnalysisPageShell>
  );
}
