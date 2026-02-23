"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import {
  formatKrw,
  formatPercent,
  formatSignedKrw,
  getKstYmd,
  getKstYmdOffset,
  toNumber,
} from "@/components/analysis/analysis-helpers";
import { getSchemaClient } from "@/lib/supabase/client";
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

type LeakageRow = {
  shipment_id: string;
  shipment_line_id: string;
  ship_date: string;
  status: string;
  customer_name: string;
  model_name: string;
  material_code: string;
  qty: number;
  net_weight_g: number | null;
  sell_total_krw: number;
  cost_basis_krw: number;
  margin_krw: number;
  margin_rate: number | null;
  pricing_mode: string;
  leak_type: string;
  floor_delta_krw: number;
  evidence: Record<string, unknown> | null;
  app_link: string;
};

type LeakageSummary = {
  total_sell_krw?: number;
  total_cost_krw?: number;
  total_margin_krw?: number;
  neg_margin_count?: number;
  below_floor_count?: number;
  provisional_count?: number;
  stale_tick_count?: number;
};

export default function LeakagePage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => getKstYmd());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [selected, setSelected] = useState<LeakageRow | null>(null);

  const rowsQuery = useQuery({
    queryKey: ["analysis-leakage-rows", fromYmd, toYmd, statusFilter],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as LeakageRow[];
      let q = schemaClient
        .from("cms_v_an_leakage_lines_v1")
        .select("*")
        .gte("ship_date", fromYmd)
        .lte("ship_date", toYmd)
        .order("abs_impact_krw", { ascending: false })
        .limit(500);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeakageRow[];
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["analysis-leakage-summary", fromYmd, toYmd],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient.rpc("cms_fn_an_leakage_summary_v1", {
        p_from: fromYmd,
        p_to: toYmd,
        p_party_id: null,
      });
      if (error) throw error;
      return (data ?? null) as LeakageSummary | null;
    },
  });

  const subtitle = useMemo(
    () => `기간: ${fromYmd} ~ ${toYmd} · Read-only 누수 분석`,
    [fromYmd, toYmd]
  );

  const rows = rowsQuery.data ?? [];
  const filteredRows = rows.filter((row) => {
    if (partyFilter !== "ALL" && row.customer_name !== partyFilter) return false;
    if (materialFilter !== "ALL" && row.material_code !== materialFilter) return false;
    return true;
  });

  const negTop = filteredRows.filter((row) => row.leak_type === "NEG_MARGIN").slice(0, 20);
  const floorTop = filteredRows.filter((row) => row.leak_type === "BELOW_FLOOR").slice(0, 20);
  const provisionalTop = filteredRows.filter((row) => row.leak_type === "PROVISIONAL_COST").slice(0, 20);
  const parties = Array.from(new Set(rows.map((row) => row.customer_name))).sort();
  const materials = Array.from(new Set(rows.map((row) => row.material_code))).sort();
  const summary = summaryQuery.data;

  return (
    <AnalysisPageShell
      title="돈 새는 곳 (ProfitGuard)"
      subtitle={subtitle}
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={rowsQuery.isFetching} /><AnalysisCopyLinkButton /><AnalysisExportCsvButton rows={filteredRows as unknown as Array<Record<string, unknown>>} filename={`analysis-leakage-${fromYmd}-${toYmd}.csv`} /><AnalysisHeaderRefresh onRefresh={() => rowsQuery.refetch()} loading={rowsQuery.isFetching} /></div>}
      filterBar={
        <AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">상태</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
              >
                <option value="ALL">전체</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CONFIRMED">CONFIRMED</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">거래처</div>
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
              >
                <option value="ALL">전체</option>
                {parties.map((party) => <option key={party} value={party}>{party}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">재질</div>
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
              >
                <option value="ALL">전체</option>
                {materials.map((material) => <option key={material} value={material}>{material}</option>)}
              </select>
            </div>
          </div>
        </AnalysisFilterBar>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="기간 매출" value={formatKrw(summary?.total_sell_krw ?? 0)} />
        <KpiCard label="기간 원가" value={formatKrw(summary?.total_cost_krw ?? 0)} />
        <KpiCard
          label="기간 마진"
          value={formatSignedKrw(summary?.total_margin_krw ?? 0)}
          trendTone={toNumber(summary?.total_margin_krw) < 0 ? "danger" : "success"}
        />
        <KpiCard
          label="주요 경보"
          value={String(toNumber(summary?.neg_margin_count) + toNumber(summary?.below_floor_count))}
          trend={`NEG ${toNumber(summary?.neg_margin_count)} / FLOOR ${toNumber(summary?.below_floor_count)}`}
          trendTone="danger"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><CardHeader title="NEG_MARGIN TOP 20" /><CardBody className="space-y-1 text-xs">{negTop.map((row) => <div key={`neg-${row.shipment_line_id}`}>{row.customer_name} · {formatSignedKrw(row.margin_krw)}</div>)}</CardBody></Card>
        <Card><CardHeader title="BELOW_FLOOR TOP 20" /><CardBody className="space-y-1 text-xs">{floorTop.map((row) => <div key={`floor-${row.shipment_line_id}`}>{row.customer_name} · {formatKrw(row.floor_delta_krw)}</div>)}</CardBody></Card>
        <Card><CardHeader title="PROVISIONAL 고액 TOP 20" /><CardBody className="space-y-1 text-xs">{provisionalTop.map((row) => <div key={`prov-${row.shipment_line_id}`}>{row.customer_name} · {formatKrw(row.cost_basis_krw)}</div>)}</CardBody></Card>
      </div>

      <Card>
        <CardHeader title="누수 라인" description="Impact 큰 순으로 최대 500건 표시" />
        <CardBody className="space-y-2">
          {rowsQuery.isLoading ? <AnalysisSkeletonBlock /> : null}
          {rowsQuery.error ? <p className="text-sm text-[var(--danger)]">데이터를 불러오지 못했습니다.</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-[var(--muted)]">
                  <th className="px-2 py-2">일자</th>
                  <th className="px-2 py-2">거래처/모델</th>
                  <th className="px-2 py-2">유형</th>
                  <th className="px-2 py-2">매출</th>
                  <th className="px-2 py-2">마진</th>
                  <th className="px-2 py-2">근거</th>
                  <th className="px-2 py-2">링크</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.shipment_line_id} className={`border-b border-[var(--hairline)] ${row.floor_delta_krw > 0 ? "bg-[var(--warning)]/10" : ""}`}>
                    <td className="px-2 py-2">{row.ship_date}</td>
                    <td className="px-2 py-2">{row.customer_name} / {row.model_name}</td>
                    <td className="px-2 py-2"><Badge tone={row.leak_type === "NEG_MARGIN" ? "danger" : "warning"}>{row.leak_type}</Badge></td>
                    <td className="px-2 py-2">{formatKrw(row.sell_total_krw)}</td>
                    <td className="px-2 py-2">
                      {formatSignedKrw(row.margin_krw)} ({formatPercent(row.margin_rate)})
                      {row.leak_type === "OUTLIER_DISCOUNT" ? <span className="ml-1 text-[10px] text-[var(--danger)]">OUTLIER</span> : null}
                    </td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                        상세
                      </Button>
                    </td>
                    <td className="px-2 py-2">
                      <a className="text-[var(--primary)] underline" href={row.app_link} target="_blank" rel="noreferrer">
                        업무 화면
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rowsQuery.isLoading && filteredRows.length === 0 ? <AnalysisEmptyState message="조건에 맞는 누수 라인이 없습니다." /> : null}
        </CardBody>
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="근거 상세">
        <div className="p-4">
          <AnalysisEvidencePreview evidence={selected?.evidence} />
        </div>
      </Drawer>

      <AnalysisHelpSection
        title="누수 산식/주의"
        items={[
          { label: "cost_basis", description: "purchase_total_cost 또는 material+labor+plating 합으로 계산합니다." },
          { label: "margin", description: "sell_total - cost_basis 입니다." },
          { label: "floor", description: "cost_basis*(1+min_margin)를 rounding_unit으로 올림한 값과 material floor 중 최대값입니다." },
        ]}
      />
    </AnalysisPageShell>
  );
}
