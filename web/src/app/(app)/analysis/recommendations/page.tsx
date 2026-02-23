"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import {
  AnalysisFilterBar,
  AnalysisHeaderRefresh,
  AnalysisPageShell,
} from "@/components/analysis/analysis-page-shell";
import { getSchemaClient } from "@/lib/supabase/client";
import { getKstYmd, getKstYmdOffset } from "@/components/analysis/analysis-helpers";
import {
  AnalysisCopyLinkButton,
  AnalysisEvidencePreview,
  AnalysisExportCsvButton,
  AnalysisFreshnessBadge,
  AnalysisHelpSection,
  AnalysisReadOnlyBadge,
  AnalysisSkeletonBlock,
} from "@/components/analysis/analysis-common";

type Party = { party_id: string; name: string };
type Reco = {
  model_name: string;
  score: number;
  reason_text: string;
  evidence: Record<string, unknown> | null;
  app_link: string;
};

export default function RecommendationsPage() {
  const schemaClient = getSchemaClient();
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-180));
  const [toYmd, setToYmd] = useState(() => getKstYmd());
  const [partyId, setPartyId] = useState<string>("");
  const [limit, setLimit] = useState("10");
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [stockBoost, setStockBoost] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  const partiesQuery = useQuery({
    queryKey: ["analysis-reco-parties"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as Party[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name")
        .eq("party_type", "CUSTOMER")
        .order("name", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Party[];
    },
  });

  const recoQuery = useQuery({
    queryKey: ["analysis-reco-preview", partyId, fromYmd, toYmd, limit],
    enabled: Boolean(schemaClient) && Boolean(partyId),
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as Reco[];
      const started = performance.now();
      const { data, error } = await schemaClient.rpc("cms_fn_an_party_reco_preview_v1", {
        p_party_id: partyId,
        p_from: fromYmd,
        p_to: toYmd,
        p_limit: Math.max(1, Math.min(Number(limit) || 10, 30)),
      });
      if (error) throw error;
      if (!Array.isArray(data)) return [] as Reco[];
      let rows = data as Reco[];
      if (excludeRecent) {
        rows = rows.filter((row) => !row.reason_text.includes("최근 구매"));
      }
      if (stockBoost) {
        rows = rows
          .map((row) => ({ ...row, score: row.score + (row.reason_text.includes("유사고객") ? 0.5 : 0) }))
          .sort((a, b) => b.score - a.score);
      }
      setElapsedMs(Math.round(performance.now() - started));
      return rows;
    },
  });

  const selectedParty = useMemo(
    () => partiesQuery.data?.find((party) => party.party_id === partyId) ?? null,
    [partiesQuery.data, partyId]
  );

  return (
    <AnalysisPageShell
      title="추천 (NextBestOffer)"
      subtitle="거래처별 추천/교차판매 · Read-only"
      actions={<div className="flex items-center gap-2"><AnalysisReadOnlyBadge /><AnalysisFreshnessBadge isFetching={recoQuery.isFetching} /><AnalysisCopyLinkButton /><AnalysisExportCsvButton rows={(recoQuery.data ?? []) as unknown as Array<Record<string, unknown>>} filename={`analysis-reco-${fromYmd}-${toYmd}.csv`} /><AnalysisHeaderRefresh onRefresh={() => recoQuery.refetch()} loading={recoQuery.isFetching} /></div>}
      filterBar={
        <AnalysisFilterBar fromYmd={fromYmd} toYmd={toYmd} onFromChange={setFromYmd} onToChange={setToYmd}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">거래처</div>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
              >
                <option value="">선택하세요</option>
                {(partiesQuery.data ?? []).map((party) => (
                  <option key={party.party_id} value={party.party_id}>
                    {party.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">추천 개수</div>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={excludeRecent} onChange={(e) => setExcludeRecent(e.target.checked)} />최근 구매 제외</label>
            <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={stockBoost} onChange={(e) => setStockBoost(e.target.checked)} />재고 가산점(가정)</label>
          </div>
        </AnalysisFilterBar>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="거래처 프로필" description="최근 구매 패턴 기반" />
          <CardBody>
            {selectedParty ? (
              <div className="space-y-2 text-sm">
                <div className="font-semibold">{selectedParty.name}</div>
                <div className="text-[var(--muted)]">기간: {fromYmd} ~ {toYmd}</div>
                <div className="text-[var(--muted)]">추천은 SQL 기반 co-occurrence v1입니다.</div>
                <div className="text-[var(--muted)]">응답시간: {elapsedMs}ms</div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">거래처를 선택하세요.</p>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="추천 리스트" description="TOP N + 근거 문장" />
          <CardBody className="space-y-2">
            {recoQuery.isLoading ? <AnalysisSkeletonBlock /> : null}
            {(recoQuery.data ?? []).map((item, index) => (
              <div key={`${item.model_name}-${index}`} className="rounded border border-[var(--hairline)] p-3">
                <div className="text-sm font-semibold">{index + 1}. {item.model_name}</div>
                <div className="text-xs text-[var(--muted)]">score={item.score.toFixed(2)}</div>
                <div className="mt-1 text-sm">{item.reason_text}</div>
                <a className="mt-1 inline-block text-xs text-[var(--primary)] underline" href={item.app_link} target="_blank" rel="noreferrer">관련 화면</a>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-[var(--primary)]">근거 데이터</summary>
                  <div className="mt-1"><AnalysisEvidencePreview evidence={item.evidence} /></div>
                </details>
              </div>
            ))}
            {partyId && !recoQuery.isLoading && (recoQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--muted)]">추천 결과가 없습니다.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <AnalysisHelpSection
        title="추천 해석/한계"
        items={[
          { label: "알고리즘", description: "최근 180일 co-occurrence 기반의 휴리스틱 점수입니다." },
          { label: "주의", description: "재고/가격/거래 조건은 부분 반영이며 최종 제안 전 영업 검토가 필요합니다." },
          { label: "응답 목표", description: "2~5초 목표, 현재 측정은 클라이언트 elapsed(ms)로 표시합니다." },
        ]}
      />
    </AnalysisPageShell>
  );
}
