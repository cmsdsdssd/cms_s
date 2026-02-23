"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import { getSchemaClient } from "@/lib/supabase/client";
import { getKstYmd, getKstYmdOffset, toNumber } from "@/components/analysis/analysis-helpers";
import {
  AnalysisCopyLinkButton,
  AnalysisEmptyState,
  AnalysisEvidencePreview,
  AnalysisExportCsvButton,
  AnalysisFreshnessBadge,
  AnalysisHelpSection,
  AnalysisReadOnlyBadge,
  AnalysisSkeletonBlock,
} from "@/components/analysis/analysis-common";

type ArSnapshot = {
  invoice_ledger_mismatch_count?: number;
  ship_invoice_mismatch_count?: number;
};

type LaborSummary = {
  mismatch_lines?: number;
  confirmed_mismatch_lines?: number;
  draft_mismatch_lines?: number;
};

type IntegritySnapshot = {
  ar?: ArSnapshot;
  labor?: LaborSummary;
  inventory_exception_count?: number;
  cost_missing_count?: number;
};

export default function IntegrityPage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => getKstYmd());

  const snapshotQuery = useQuery({
    queryKey: ["analysis-integrity-snapshot", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient.rpc("cms_fn_an_integrity_snapshot_v1", { p_limit: 1000 });
      if (error) throw error;
      return (data ?? null) as IntegritySnapshot | null;
    },
  });

  const laborSummaryQuery = useQuery({
    queryKey: ["analysis-integrity-labor"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient.rpc("cms_fn_shipment_labor_integrity_summary_v1", {});
      if (error) throw error;
      return (data ?? null) as LaborSummary | null;
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["analysis-integrity-inventory"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as Array<{ exception_type: string; severity: number; details: Record<string, unknown> }>;
      const { data, error } = await schemaClient
        .from("cms_v_inventory_exceptions_v1")
        .select("exception_type, severity, details")
        .order("severity", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{ exception_type: string; severity: number; details: Record<string, unknown> }>;
    },
  });

  const costQuery = useQuery({
    queryKey: ["analysis-integrity-cost", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return 0;
      const { count, error } = await schemaClient
        .from("cms_v_purchase_cost_worklist_v1")
        .select("shipment_line_id", { count: "exact", head: true })
        .gte("ship_date", fromYmd)
        .lte("ship_date", toYmd);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const score = useMemo(() => {
    const ar = toNumber(snapshotQuery.data?.ar?.invoice_ledger_mismatch_count) + toNumber(snapshotQuery.data?.ar?.ship_invoice_mismatch_count);
    const labor = toNumber(laborSummaryQuery.data?.mismatch_lines);
    const inventory = inventoryQuery.data?.length ?? 0;
    const cost = toNumber(costQuery.data);
    const penalty = ar * 2 + labor * 1.5 + inventory * 1.2 + cost * 0.8;
    return Math.max(0, Math.round(100 - penalty));
  }, [snapshotQuery.data, laborSummaryQuery.data, inventoryQuery.data, costQuery.data]);

  return (
    <AnalysisPageShell
      title="정합성 (IntegrityShield)"
      subtitle={`기간: ${fromYmd} ~ ${toYmd} · 이슈 센터`}
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={snapshotQuery.isFetching || laborSummaryQuery.isFetching} /><AnalysisCopyLinkButton /><AnalysisExportCsvButton rows={(inventoryQuery.data ?? []) as unknown as Array<Record<string, unknown>>} filename={`analysis-integrity-${fromYmd}-${toYmd}.csv`} /><AnalysisHeaderRefresh onRefresh={() => snapshotQuery.refetch()} loading={snapshotQuery.isFetching} /></div>}
      filterBar={<AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd} />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <KpiCard label="Data Quality Score" value={`${score}점`} trend={score >= 90 ? "좋음" : score >= 75 ? "주의" : "위험"} trendTone={score >= 90 ? "success" : "danger"} />
        <KpiCard label="AR SOT 이슈" value={String(toNumber(snapshotQuery.data?.ar?.invoice_ledger_mismatch_count) + toNumber(snapshotQuery.data?.ar?.ship_invoice_mismatch_count))} trend="invoice/ledger mismatch" trendTone="danger" />
        <KpiCard label="공임 mismatch" value={String(toNumber(laborSummaryQuery.data?.mismatch_lines))} trend="extra_labor vs items" trendTone="danger" />
        <KpiCard label="원가 누락" value={String(toNumber(costQuery.data))} trend="purchase_cost_worklist" trendTone="muted" />
        <KpiCard label="재고 예외" value={String(inventoryQuery.data?.length ?? 0)} trend="exceptions open" trendTone="muted" />
      </div>

      <Card>
        <CardHeader title="재고 예외 (상위 50)" description="severity/impact 우선" />
        <CardBody className="space-y-2">
          {inventoryQuery.isLoading ? <AnalysisSkeletonBlock /> : null}
          {(inventoryQuery.data ?? []).map((row, index) => (
            <div key={`${row.exception_type}-${index}`} className="rounded border border-[var(--hairline)] p-3">
              <div className="flex items-center gap-2">
                <Badge tone={row.severity <= 1 ? "danger" : row.severity <= 2 ? "warning" : "neutral"}>
                  {row.exception_type}
                </Badge>
                <span className="text-xs text-[var(--muted)]">severity={row.severity}</span>
              </div>
              <div className="mt-2">
                <AnalysisEvidencePreview evidence={row.details} />
              </div>
            </div>
          ))}
          {!inventoryQuery.isLoading && (inventoryQuery.data?.length ?? 0) === 0 ? <AnalysisEmptyState message="오픈 이슈가 없습니다. 건강 상태입니다." /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="수동 조치 링크" description="업무 화면에서 정리" />
        <CardBody className="flex flex-wrap gap-2 text-sm">
          <Link href="/ar/v2" className="underline">AR 정리</Link>
          <Link href="/purchase_cost_worklist" className="underline">원가 작업대</Link>
          <Link href="/shipments_main" className="underline">출고 라인 확인</Link>
        </CardBody>
      </Card>

      <AnalysisHelpSection
        title="정합성 점수 산식"
        items={[
          { label: "Score", description: "100 - (AR*2 + Labor*1.5 + Inventory*1.2 + Cost*0.8) 방식입니다." },
          { label: "AR mismatch", description: "invoice/ledger 및 ship/invoice mismatch 합계를 사용합니다." },
          { label: "Labor mismatch", description: "extra_labor_krw와 sanitized_sum_krw delta 기준입니다." },
        ]}
      />
    </AnalysisPageShell>
  );
}
