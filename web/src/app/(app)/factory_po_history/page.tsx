"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTRACTS } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { getSchemaClient } from "@/lib/supabase/client";
import { FactoryVendorList, FactoryVendorItem } from "./_components/FactoryVendorList";
import { PoList, PoRow } from "./_components/PoList";
import { PoDetailDrawer, PoDetailData, PoDetailLine } from "./_components/PoDetailDrawer";

type FactoryPoSummaryRow = {
  po_id?: string | null;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  vendor_prefix?: string | null;
  status?: string | null;
  fax_sent_at?: string | null;
  fax_provider?: string | null;
  fax_payload_url?: string | null;
  line_count?: number | null;
  total_qty?: number | null;
  model_names?: string | null;
  customers?: string | null;
};

type FactoryPoDetailResponse = { lines?: PoDetailLine[] } | PoDetailLine[] | null;

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

const getKstStartIso = (ymd: string) => `${ymd}T00:00:00+09:00`;

const getKstNextStartIso = (ymd: string) => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const shiftYmd = (ymd: string, delta: number) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + delta * 86400000));

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
};

const formatTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

function FactoryPoHistoryPageContent() {
  const schemaClient = getSchemaClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateParam = (searchParams.get("date") ?? "").trim();
  const vendorPartyId = (searchParams.get("vendor_party_id") ?? "").trim();
  const vendorPrefix = (searchParams.get("vendor_prefix") ?? "").trim();
  const selectedDate = useMemo(() => (isValidYmd(dateParam) ? dateParam : getKstYmd()), [dateParam]);
  const prevDate = useMemo(() => shiftYmd(selectedDate, -1), [selectedDate]);
  const dateStartIso = useMemo(() => getKstStartIso(selectedDate), [selectedDate]);
  const dateEndIso = useMemo(() => getKstNextStartIso(selectedDate), [selectedDate]);
  const prevDateStartIso = useMemo(() => getKstStartIso(prevDate), [prevDate]);
  const prevDateEndIso = useMemo(() => getKstNextStartIso(prevDate), [prevDate]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activePoId, setActivePoId] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>("");

  const updateQuery = useCallback(
    (next: { date?: string; vendorPartyId?: string | null; vendorPrefix?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.date) {
        params.set("date", next.date);
      }
      if (next.vendorPartyId) {
        params.set("vendor_party_id", next.vendorPartyId);
        params.delete("vendor_prefix");
      } else if (next.vendorPartyId === null) {
        params.delete("vendor_party_id");
      }
      if (next.vendorPrefix) {
        params.set("vendor_prefix", next.vendorPrefix);
        params.delete("vendor_party_id");
      } else if (next.vendorPrefix === null) {
        params.delete("vendor_prefix");
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [searchParams, router, pathname]
  );

  // Current day query
  const summaryQuery = useQuery({
    queryKey: ["factory-po-history", selectedDate, vendorPartyId, vendorPrefix],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from(CONTRACTS.views.factoryPoSummary)
        .select("*")
        .eq("status", "SENT_TO_VENDOR")
        .gte("fax_sent_at", dateStartIso)
        .lt("fax_sent_at", dateEndIso);
      if (vendorPartyId) {
        query = query.eq("vendor_party_id", vendorPartyId);
      } else if (vendorPrefix) {
        query = query.eq("vendor_prefix", vendorPrefix);
      }
      const { data, error } = await query.order("fax_sent_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FactoryPoSummaryRow[];
    },
    enabled: Boolean(schemaClient),
  });

  // Previous day query for delta calculation
  const prevSummaryQuery = useQuery({
    queryKey: ["factory-po-history-prev", prevDate, vendorPartyId, vendorPrefix],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from(CONTRACTS.views.factoryPoSummary)
        .select("*")
        .eq("status", "SENT_TO_VENDOR")
        .gte("fax_sent_at", prevDateStartIso)
        .lt("fax_sent_at", prevDateEndIso);
      if (vendorPartyId) {
        query = query.eq("vendor_party_id", vendorPartyId);
      } else if (vendorPrefix) {
        query = query.eq("vendor_prefix", vendorPrefix);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FactoryPoSummaryRow[];
    },
    enabled: Boolean(schemaClient),
  });

  // Vendor list for left sidebar
  const vendorList = useMemo<FactoryVendorItem[]>(() => {
    const map = new Map<string, FactoryVendorItem>();
    (summaryQuery.data ?? []).forEach((row) => {
      const key = row.vendor_party_id ?? row.vendor_prefix ?? "unknown";
      const existing = map.get(key);
      if (existing) {
        existing.poCount += 1;
        existing.totalQty += Number(row.total_qty ?? 0);
      } else {
        map.set(key, {
          vendorPartyId: row.vendor_party_id ?? "",
          vendorName: (row.vendor_name ?? "").trim() || (row.vendor_prefix ?? "").trim() || "미지정",
          vendorPrefix: (row.vendor_prefix ?? "").trim(),
          poCount: 1,
          totalQty: Number(row.total_qty ?? 0),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName, "ko-KR"));
  }, [summaryQuery.data]);

  // PO rows for right table
  const poRows = useMemo<PoRow[]>(() => {
    return (summaryQuery.data ?? []).map((row) => ({
      po_id: row.po_id ?? "",
      fax_sent_at: row.fax_sent_at ?? null,
      fax_provider: row.fax_provider ?? null,
      fax_payload_url: row.fax_payload_url ?? null,
      line_count: row.line_count ?? 0,
      total_qty: row.total_qty ?? 0,
      model_names: row.model_names ?? null,
      customers: row.customers ?? null,
    }));
  }, [summaryQuery.data]);

  // KPI stats
  const summaryStats = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.totalPos += 1;
        acc.totalLines += Number(row.line_count ?? 0);
        acc.totalQty += Number(row.total_qty ?? 0);
        return acc;
      },
      { totalPos: 0, totalLines: 0, totalQty: 0 }
    );
  }, [summaryQuery.data]);

  const prevSummaryStats = useMemo(() => {
    const rows = prevSummaryQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.totalPos += 1;
        acc.totalLines += Number(row.line_count ?? 0);
        acc.totalQty += Number(row.total_qty ?? 0);
        return acc;
      },
      { totalPos: 0, totalLines: 0, totalQty: 0 }
    );
  }, [prevSummaryQuery.data]);

  // Delta trends
  const deltaPos = summaryStats.totalPos - prevSummaryStats.totalPos;
  const deltaLines = summaryStats.totalLines - prevSummaryStats.totalLines;
  const deltaQty = summaryStats.totalQty - prevSummaryStats.totalQty;

  const formatDelta = (delta: number) => {
    if (delta > 0) return `▲ ${delta}`;
    if (delta < 0) return `▼ ${Math.abs(delta)}`;
    return `± 0`;
  };

  const getTrendTone = (delta: number): "success" | "danger" | "muted" => {
    if (delta > 0) return "success";
    if (delta < 0) return "danger";
    return "muted";
  };

  // Detail query
  const detailQuery = useQuery({
    queryKey: ["factory-po-detail", activePoId],
    queryFn: async () => {
      if (!activePoId) return null;
      const linesResult = await callRpc<FactoryPoDetailResponse>(CONTRACTS.functions.factoryPoGetDetails, {
        p_po_id: activePoId,
      });

      let lines: PoDetailLine[] = [];
      if (Array.isArray(linesResult)) {
        lines = linesResult as PoDetailLine[];
      } else if (linesResult && typeof linesResult === "object" && "lines" in linesResult) {
        lines = (linesResult.lines ?? []) as PoDetailLine[];
      }

      const poData = (summaryQuery.data ?? []).find((row) => row.po_id === activePoId);

      return {
        po_id: activePoId,
        vendor_name: poData?.vendor_name ?? null,
        fax_sent_at: poData?.fax_sent_at ?? null,
        fax_provider: poData?.fax_provider ?? null,
        fax_payload_url: poData?.fax_payload_url ?? null,
        line_count: poData?.line_count ?? 0,
        total_qty: poData?.total_qty ?? 0,
        lines,
      } as PoDetailData;
    },
    enabled: Boolean(activePoId) && detailOpen,
  });

  const handleOpenDetail = useCallback((poId: string) => {
    setActivePoId(poId);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setActivePoId(null);
  }, []);

  // Prev/Next navigation indices
  const currentPoIndex = useMemo(() => {
    if (!activePoId) return -1;
    return poRows.findIndex((row) => row.po_id === activePoId);
  }, [activePoId, poRows]);

  const handlePrevious = useCallback(() => {
    if (currentPoIndex > 0) {
      const prevPoId = poRows[currentPoIndex - 1].po_id;
      setActivePoId(prevPoId);
    }
  }, [currentPoIndex, poRows]);

  const handleNext = useCallback(() => {
    if (currentPoIndex >= 0 && currentPoIndex < poRows.length - 1) {
      const nextPoId = poRows[currentPoIndex + 1].po_id;
      setActivePoId(nextPoId);
    }
  }, [currentPoIndex, poRows]);

  const handleRefresh = useCallback(() => {
    void summaryQuery.refetch();
    void prevSummaryQuery.refetch();
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    setLastRefreshTime(timeStr);
  }, [summaryQuery, prevSummaryQuery]);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Sticky ActionBar */}
        <div className="sticky top-[var(--topbar-sticky-offset)] z-30 border-b border-[var(--panel-border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="px-6 py-4">
          <ActionBar
            title="공장발주 전송내역"
            subtitle={`기준일: ${selectedDate} · SENT_TO_VENDOR · FAX sent`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => updateQuery({ date: shiftYmd(selectedDate, -1) })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      if (!isValidYmd(next)) return;
                      updateQuery({ date: next });
                    }}
                    className="h-8 w-[140px]"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => updateQuery({ date: shiftYmd(selectedDate, 1) })}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  새로고침
                </Button>
                {lastRefreshTime && (
                  <span className="text-xs text-[var(--muted)] ml-2">
                    마지막 갱신: {lastRefreshTime}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 py-6 border-b border-[var(--panel-border)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="전송 PO 수"
            value={summaryStats.totalPos.toString()}
            trend={formatDelta(deltaPos)}
            trendTone={getTrendTone(deltaPos)}
          />
          <KpiCard
            label="총 라인 수"
            value={formatNumber(summaryStats.totalLines)}
            trend={formatDelta(deltaLines)}
            trendTone={getTrendTone(deltaLines)}
          />
          <KpiCard
            label="총 수량"
            value={formatNumber(summaryStats.totalQty)}
            trend={formatDelta(deltaQty)}
            trendTone={getTrendTone(deltaQty)}
          />
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Vendor List (hidden on mobile, shown on md+) */}
        <div className="hidden md:flex md:w-80 lg:w-96 shrink-0">
          <FactoryVendorList
            vendors={vendorList}
            isLoading={summaryQuery.isLoading}
            selectedVendorPartyId={vendorPartyId || null}
            selectedVendorPrefix={vendorPrefix || null}
            onSelectVendor={(partyId, prefix) => {
              if (partyId) {
                updateQuery({ vendorPartyId: partyId });
              } else if (prefix) {
                updateQuery({ vendorPrefix: prefix });
              } else {
                updateQuery({ vendorPartyId: null, vendorPrefix: null });
              }
            }}
          />
        </div>

        {/* Right: PO List */}
        <div className="flex-1 overflow-hidden">
          {summaryQuery.isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : summaryQuery.isError ? (
            <div className="p-6 text-center space-y-4">
              <div className="text-sm text-[var(--danger)]">데이터를 불러오는 중 오류가 발생했습니다.</div>
              <Button variant="secondary" onClick={handleRefresh}>
                재시도
              </Button>
            </div>
          ) : poRows.length === 0 ? (
            <div className="p-6 text-center space-y-4">
              <div className="text-3xl mb-4">📦</div>
              <div className="text-sm text-[var(--muted)] mb-4">조회된 전송 내역이 없습니다.</div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="secondary" onClick={() => updateQuery({ vendorPartyId: null, vendorPrefix: null })}>
                  전체 보기
                </Button>
                <Button variant="secondary" onClick={handleRefresh}>
                  새로고침
                </Button>
              </div>
            </div>
          ) : (
            <PoList rows={poRows} onOpenDetail={handleOpenDetail} />
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <PoDetailDrawer
        open={detailOpen}
        onClose={handleCloseDetail}
        data={detailQuery.data ?? null}
        isLoading={detailQuery.isLoading}
        onPrevious={handlePrevious}
        onNext={handleNext}
        canGoPrevious={currentPoIndex > 0}
        canGoNext={currentPoIndex >= 0 && currentPoIndex < poRows.length - 1}
      />
    </div>
  );
}

export default function FactoryPoHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] px-6 py-6 text-sm text-[var(--muted)]">
          로딩 중...
        </div>
      }
    >
      <FactoryPoHistoryPageContent />
    </Suspense>
  );
}
