"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ListCard } from "@/components/ui/list-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentHeaderRow = {
  shipment_id?: string | null;
  ship_date?: string | null;
  status?: string | null;
  is_store_pickup?: boolean | null;
  customer_party_id?: string | null;
  customer?: { name?: string | null } | null;
};

type ShipmentLineRow = {
  shipment_line_id?: string | null;
  shipment_id?: string | null;
  master_id?: string | null;
  model_name?: string | null;
  qty?: number | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  base_labor_krw?: number | null;
  extra_labor_krw?: number | null;
  total_amount_sell_krw?: number | null;
  measured_weight_g?: number | null;
  deduction_weight_g?: number | null;
  net_weight_g?: number | null;
  extra_labor_items?: unknown;
  created_at?: string | null;
};

type MasterRow = {
  master_id?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
};

type ReceiptMatchRow = {
  shipment_line_id?: string | null;
  status?: string | null;
  confirmed_at?: string | null;
  selected_factory_labor_basic_cost_krw?: number | null;
  selected_factory_labor_other_cost_krw?: number | null;
  selected_factory_total_cost_krw?: number | null;
  selected_weight_g?: number | null;
};

type DerivedLine = {
  shipment_line_id: string;
  shipment_id: string;
  ship_date: string;
  customer_party_id: string;
  customer_name: string;
  model_name: string;
  color: string;
  size: string;
  qty: number;
  base_sell: number;
  extra_sell: number;
  sell_total: number;
  base_cost: number | null;
  extra_cost: number | null;
  receipt_total_cost: number | null;
  base_uplift: number | null;
  extra_uplift: number | null;
  margin: number | null;
  master_net_g: number | null;
  ship_net_g: number | null;
  weight_diff_g: number | null;
  missing_match: boolean;
  missing_master: boolean;
};

type PartyOption = { partyId: string; partyName: string; count: number };

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toKstDate = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);

const getKstYmd = () => {
  const now = new Date();
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return text.replace(/\//g, "-");
};

const getKstYmdOffset = (days: number) => {
  const now = new Date();
  const baseText = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const base = new Date(`${baseText.replace(/\//g, "-")}T00:00:00+09:00`);
  base.setDate(base.getDate() + days);
  const out = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
  return out.replace(/\//g, "-");
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replaceAll(",", "")) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const formatKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatSignedKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}₩${new Intl.NumberFormat("ko-KR").format(Math.round(abs))}`;
};

const formatGram = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(value)}g`;
};

const formatSignedGram = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(abs)}g`;
};

const weekdayShort = (ymd: string) => {
  try {
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(toKstDate(ymd));
  } catch {
    return "";
  }
};

const safeText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
};

export default function ShipmentsAnalysisPage() {
  const schemaClient = getSchemaClient();
  const today = useMemo(() => getKstYmd(), []);
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => today);
  const [excludeStorePickup, setExcludeStorePickup] = useState(true);
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("ALL");

  const analysisQuery = useQuery({
    queryKey: ["shipments-analysis", fromYmd, toYmd, excludeStorePickup, matchedOnly],
    enabled: Boolean(schemaClient) && isValidYmd(fromYmd) && isValidYmd(toYmd),
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!isValidYmd(fromYmd) || !isValidYmd(toYmd)) return { lines: [] as DerivedLine[], parties: [] as PartyOption[] };

      const { data: headerData, error: headerError } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, ship_date, status, is_store_pickup, customer_party_id, customer:cms_party(name)")
        .eq("status", "CONFIRMED")
        .gte("ship_date", fromYmd)
        .lte("ship_date", toYmd)
        .order("ship_date", { ascending: false });
      if (headerError) throw headerError;

      const headers = (headerData ?? []) as ShipmentHeaderRow[];
      const filteredHeaders = excludeStorePickup ? headers.filter((h) => h.is_store_pickup !== true) : headers;

      const headerMap = new Map<string, ShipmentHeaderRow>();
      filteredHeaders.forEach((h) => {
        const id = String(h.shipment_id ?? "").trim();
        if (!id) return;
        headerMap.set(id, h);
      });

      const shipmentIds = Array.from(headerMap.keys());
      if (shipmentIds.length === 0) return { lines: [] as DerivedLine[], parties: [] as PartyOption[] };

      const shipmentLines: ShipmentLineRow[] = [];
      for (const ids of chunk(shipmentIds, 300)) {
        const { data, error } = await schemaClient
          .from("cms_shipment_line")
          .select(
            "shipment_line_id, shipment_id, master_id, model_name, qty, material_code, color, size, base_labor_krw, extra_labor_krw, total_amount_sell_krw, measured_weight_g, deduction_weight_g, net_weight_g, extra_labor_items, created_at"
          )
          .in("shipment_id", ids)
          .order("created_at", { ascending: true });
        if (error) throw error;
        shipmentLines.push(...((data ?? []) as ShipmentLineRow[]));
      }

      const lineIds = Array.from(
        new Set(shipmentLines.map((l) => String(l.shipment_line_id ?? "").trim()).filter(Boolean))
      );
      const masterIds = Array.from(
        new Set(shipmentLines.map((l) => String(l.master_id ?? "").trim()).filter(Boolean))
      );

      const masterMap = new Map<string, MasterRow>();
      if (masterIds.length > 0) {
        for (const ids of chunk(masterIds, 500)) {
          const { data, error } = await schemaClient
            .from("cms_master_item")
            .select("master_id, weight_default_g, deduction_weight_default_g")
            .in("master_id", ids);
          if (error) throw error;
          (data ?? []).forEach((row) => {
            const id = String((row as MasterRow).master_id ?? "").trim();
            if (!id) return;
            masterMap.set(id, row as MasterRow);
          });
        }
      }

      const matchMap = new Map<string, ReceiptMatchRow>();
      if (lineIds.length > 0) {
        for (const ids of chunk(lineIds, 500)) {
          const { data, error } = await schemaClient
            .from("cms_receipt_line_match")
            .select(
              "shipment_line_id, status, confirmed_at, selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw, selected_weight_g"
            )
            .in("shipment_line_id", ids)
            .eq("status", "CONFIRMED")
            .order("confirmed_at", { ascending: false });
          if (error) throw error;
          (data ?? []).forEach((row) => {
            const parsed = row as ReceiptMatchRow;
            const id = String(parsed.shipment_line_id ?? "").trim();
            if (!id) return;
            // confirmed_at desc로 가져오므로, 최초 1개만 유지
            if (!matchMap.has(id)) matchMap.set(id, parsed);
          });
        }
      }

      const derived: DerivedLine[] = shipmentLines
        .map((line) => {
          const shipmentId = String(line.shipment_id ?? "").trim();
          const header = headerMap.get(shipmentId);
          const shipDate = String(header?.ship_date ?? "").trim();
          const customerPartyId = String(header?.customer_party_id ?? "").trim();
          if (!shipmentId || !shipDate || !customerPartyId) return null;

          const shipmentLineId = String(line.shipment_line_id ?? "").trim();
          if (!shipmentLineId) return null;

          const match = matchMap.get(shipmentLineId) ?? null;
          const baseCost = match?.selected_factory_labor_basic_cost_krw ?? null;
          const extraCost = match?.selected_factory_labor_other_cost_krw ?? null;
          const receiptTotalCost =
            match?.selected_factory_total_cost_krw ??
            (baseCost !== null || extraCost !== null ? (toNumber(baseCost, 0) + toNumber(extraCost, 0)) : null);

          const baseSell = toNumber(line.base_labor_krw, 0);
          const extraSell = toNumber(line.extra_labor_krw, 0);
          const sellTotal = toNumber(line.total_amount_sell_krw, 0);

          const baseUplift = baseCost === null || baseCost === undefined ? null : baseSell - toNumber(baseCost, 0);
          const extraUplift = extraCost === null || extraCost === undefined ? null : extraSell - toNumber(extraCost, 0);
          const margin = receiptTotalCost === null || receiptTotalCost === undefined ? null : sellTotal - toNumber(receiptTotalCost, 0);

          const shipNet = (() => {
            const direct = line.net_weight_g;
            if (typeof direct === "number" && Number.isFinite(direct)) return direct;
            const measured = toNumber(line.measured_weight_g, 0);
            const deduct = toNumber(line.deduction_weight_g, 0);
            const net = measured - deduct;
            return Number.isFinite(net) && net !== 0 ? net : null;
          })();

          const masterNet = (() => {
            const masterId = String(line.master_id ?? "").trim();
            if (!masterId) return null;
            const master = masterMap.get(masterId);
            if (!master) return null;
            const gross = toNumber(master.weight_default_g, 0);
            const deduct = toNumber(master.deduction_weight_default_g, 0);
            const net = Math.max(gross - deduct, 0);
            return Number.isFinite(net) && net > 0 ? net : null;
          })();

          const weightDiff = masterNet === null || shipNet === null ? null : shipNet - masterNet;

          const missingMatch = !match;
          const missingMaster = masterNet === null;

          return {
            shipment_line_id: shipmentLineId,
            shipment_id: shipmentId,
            ship_date: shipDate,
            customer_party_id: customerPartyId,
            customer_name: safeText(header?.customer?.name ?? null, "-") as string,
            model_name: safeText(line.model_name ?? null, "-") as string,
            color: safeText(line.color ?? null, "") as string,
            size: safeText(line.size ?? null, "") as string,
            qty: Math.max(toNumber(line.qty, 1), 1),
            base_sell: baseSell,
            extra_sell: extraSell,
            sell_total: sellTotal,
            base_cost: baseCost === null || baseCost === undefined ? null : toNumber(baseCost, 0),
            extra_cost: extraCost === null || extraCost === undefined ? null : toNumber(extraCost, 0),
            receipt_total_cost: receiptTotalCost === null || receiptTotalCost === undefined ? null : toNumber(receiptTotalCost, 0),
            base_uplift: baseUplift,
            extra_uplift: extraUplift,
            margin,
            master_net_g: masterNet,
            ship_net_g: shipNet,
            weight_diff_g: weightDiff,
            missing_match: missingMatch,
            missing_master: missingMaster,
          } satisfies DerivedLine;
        })
        .filter(Boolean) as DerivedLine[];

      const filteredDerived = matchedOnly ? derived.filter((row) => row.receipt_total_cost !== null) : derived;

      const partyMap = new Map<string, PartyOption>();
      filteredDerived.forEach((row) => {
        const partyId = row.customer_party_id;
        const partyName = row.customer_name;
        const current = partyMap.get(partyId) ?? { partyId, partyName, count: 0 };
        current.count += 1;
        partyMap.set(partyId, current);
      });
      const parties = Array.from(partyMap.values()).sort((a, b) => a.partyName.localeCompare(b.partyName, "ko-KR"));

      return { lines: filteredDerived, parties };
    },
  });

  const partyOptions = useMemo(() => analysisQuery.data?.parties ?? [], [analysisQuery.data?.parties]);

  const visibleLines = useMemo(() => {
    const lines = analysisQuery.data?.lines ?? [];
    if (selectedPartyId === "ALL") return lines;
    return lines.filter((row) => row.customer_party_id === selectedPartyId);
  }, [analysisQuery.data?.lines, selectedPartyId]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, DerivedLine[]>();
    visibleLines.forEach((row) => {
      const key = row.ship_date;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    });
    const dates = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return dates.map((d) => ({ date: d, lines: map.get(d) ?? [] }));
  }, [visibleLines]);

  const totals = useMemo(() => {
    const sum = {
      sell: 0,
      receipt: 0,
      margin: 0,
      baseUplift: 0,
      extraUplift: 0,
      weightDiff: 0,
      lines: visibleLines.length,
      matched: 0,
      masterLinked: 0,
    };

    visibleLines.forEach((row) => {
      sum.sell += row.sell_total;
      if (row.receipt_total_cost !== null) {
        sum.receipt += row.receipt_total_cost;
        sum.matched += 1;
      }
      if (row.margin !== null) sum.margin += row.margin;
      if (row.base_uplift !== null) sum.baseUplift += row.base_uplift;
      if (row.extra_uplift !== null) sum.extraUplift += row.extra_uplift;
      if (row.weight_diff_g !== null) sum.weightDiff += row.weight_diff_g;
      if (!row.missing_master) sum.masterLinked += 1;
    });

    return sum;
  }, [visibleLines]);

  const subtitle = useMemo(() => {
    const partyLabel =
      selectedPartyId === "ALL"
        ? "전체"
        : partyOptions.find((p) => p.partyId === selectedPartyId)?.partyName ?? "-";
    return `기간: ${fromYmd} ~ ${toYmd} · 대상: ${partyLabel}`;
  }, [fromYmd, partyOptions, selectedPartyId, toYmd]);

  const renderDaySummaryMeta = (rows: DerivedLine[]) => {
    const sell = rows.reduce((s, r) => s + r.sell_total, 0);
    const receipt = rows.reduce((s, r) => s + (r.receipt_total_cost ?? 0), 0);
    const matched = rows.filter((r) => r.receipt_total_cost !== null).length;
    const missing = rows.length - matched;
    const margin = rows.reduce((s, r) => s + (r.margin ?? 0), 0);
    const baseU = rows.reduce((s, r) => s + (r.base_uplift ?? 0), 0);
    const extraU = rows.reduce((s, r) => s + (r.extra_uplift ?? 0), 0);
    const wdiff = rows.reduce((s, r) => s + (r.weight_diff_g ?? 0), 0);

    const line1 = `기본공임 ▲ ${formatSignedKrw(baseU)} · 보석/기타 ▲ ${formatSignedKrw(extraU)}`;
    const line2 = `중량 Δ ${formatSignedGram(wdiff)} · 마진 ${formatSignedKrw(margin)}`;
    const line3 = `출고 ${formatKrw(sell)} · 영수증 ${formatKrw(receipt)} · 미매칭 ${missing}건`;
    return (
      <span className="whitespace-pre-line">{`${line1}\n${line2}\n${line3}`}</span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--panel-border)] bg-[var(--background)]/80 px-6 py-4 backdrop-blur">
        <ActionBar
          title="출고 분석"
          subtitle={subtitle}
          actions={
            <Button
              variant="secondary"
              onClick={() => analysisQuery.refetch()}
              disabled={analysisQuery.isFetching}
            >
              {analysisQuery.isFetching ? "갱신 중..." : "새로고침"}
            </Button>
          }
        />
      </div>

      <div className="px-6 py-6 space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--foreground)]">필터</div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={excludeStorePickup}
                    onChange={(e) => setExcludeStorePickup(e.target.checked)}
                    className="h-4 w-4"
                  />
                  매장픽업 제외
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={matchedOnly}
                    onChange={(e) => setMatchedOnly(e.target.checked)}
                    className="h-4 w-4"
                  />
                  매칭된 건만
                </label>
              </div>
            </div>
          </CardHeader>
          <CardBody className="px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--muted)]">시작일</div>
                <Input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--muted)]">종료일</div>
                <Input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-[var(--muted)]">거래처</div>
                <Select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  disabled={analysisQuery.isLoading}
                >
                  <option value="ALL">전체</option>
                  {partyOptions.map((p) => (
                    <option key={p.partyId} value={p.partyId}>
                      {p.partyName} ({p.count})
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-[var(--muted)]">
              기본값은 최근 30일입니다. 기간이 길고 출고건이 많으면 로딩이 오래 걸릴 수 있어요.
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <KpiCard
            label="출고가 합계"
            value={formatKrw(totals.sell)}
            trend={`라인 ${totals.lines}건`}
            className="md:col-span-2"
          />
          <KpiCard
            label="영수증가 합계"
            value={formatKrw(totals.receipt)}
            trend={`매칭 ${totals.matched}/${totals.lines}`}
            trendTone={totals.matched === totals.lines ? "success" : "muted"}
            className="md:col-span-2"
          />
          <KpiCard
            label="마진"
            value={formatSignedKrw(totals.margin)}
            trend={`(출고 - 영수증)`}
            trendTone={totals.margin < 0 ? "danger" : "success"}
            className="md:col-span-2"
          />
          <KpiCard
            label="기본공임 상승"
            value={formatSignedKrw(totals.baseUplift)}
            trend={`(판매 - 원가)`}
            trendTone={totals.baseUplift < 0 ? "danger" : "success"}
            className="md:col-span-2"
          />
          <KpiCard
            label="보석/기타 상승"
            value={formatSignedKrw(totals.extraUplift)}
            trend={`(판매 - 원가)`}
            trendTone={totals.extraUplift < 0 ? "danger" : "success"}
            className="md:col-span-2"
          />
          <KpiCard
            label="중량차 합계"
            value={formatSignedGram(totals.weightDiff)}
            trend={`마스터 연결 ${totals.masterLinked}/${totals.lines}`}
            trendTone={totals.masterLinked === totals.lines ? "success" : "muted"}
            className="md:col-span-2"
          />
        </div>

        <Card className="shadow-sm">
          <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--foreground)]">날짜별 출고 분석</div>
              {analysisQuery.isLoading ? (
                <span className="text-xs text-[var(--muted)]">로딩 중...</span>
              ) : null}
            </div>
          </CardHeader>
          <CardBody className="px-4 py-4">
            {analysisQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : analysisQuery.error ? (
              <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                데이터를 불러오지 못했어요: {String((analysisQuery.error as Error)?.message ?? analysisQuery.error)}
              </div>
            ) : groupedByDate.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                조건에 해당하는 출고가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {groupedByDate.map((group) => {
                  const missingCount = group.lines.filter((l) => l.missing_match).length;
                  const dateLabel = `${group.date} (${weekdayShort(group.date)})`;
                  const dayMargin = group.lines.reduce((s, r) => s + (r.margin ?? 0), 0);
                  const dayTone: "active" | "danger" = dayMargin < 0 ? "danger" : "active";
                  return (
                    <details
                      key={group.date}
                      className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]"
                    >
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <ListCard
                          title={dateLabel}
                          subtitle={`출고 ${group.lines.length}건${missingCount ? ` · 미매칭 ${missingCount}건` : ""}`}
                          meta={renderDaySummaryMeta(group.lines)}
                          right={
                            <div className="flex items-center gap-2">
                              <Badge tone={dayTone}>{formatSignedKrw(dayMargin)}</Badge>
                            </div>
                          }
                        />
                      </summary>

                      <div className="border-t border-[var(--panel-border)] bg-[var(--background)] p-2">
                        <div className="flex flex-col">
                          {group.lines.map((row) => {
                            const titleParts = [row.model_name];
                            const suffix = [row.color, row.size].filter(Boolean).join(" ");
                            if (suffix) titleParts.push(suffix);
                            titleParts.push(`x${row.qty}`);
                            const title = titleParts.join(" ");

                            const badge = row.missing_match
                              ? { label: row.missing_master ? "미매칭/마스터X" : "미매칭", tone: "warning" as const }
                              : row.missing_master
                                ? { label: "마스터X", tone: "warning" as const }
                                : undefined;

                            const line1 = `기본공임: ${formatKrw(row.base_sell)} - ${formatKrw(row.base_cost)} = ${formatSignedKrw(row.base_uplift)}`;
                            const line2 = `보석/기타: ${formatKrw(row.extra_sell)} - ${formatKrw(row.extra_cost)} = ${formatSignedKrw(row.extra_uplift)}`;
                            const line3 = `중량: M ${formatGram(row.master_net_g)} → 출고 ${formatGram(row.ship_net_g)} (Δ ${formatSignedGram(row.weight_diff_g)}) · 마진 ${formatSignedKrw(row.margin)}`;

                            const marginTone: "active" | "danger" =
                              row.margin !== null && row.margin < 0 ? "danger" : "active";

                            return (
                              <ListCard
                                key={row.shipment_line_id}
                                title={title}
                                subtitle={row.customer_name}
                                badge={badge}
                                meta={<span className="whitespace-pre-line">{`${line1}\n${line2}\n${line3}`}</span>}
                                right={
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge tone={marginTone}>{formatSignedKrw(row.margin)}</Badge>
                                    <span className="text-[10px] text-[var(--muted)]">{formatKrw(row.sell_total)}</span>
                                  </div>
                                }
                                className={cn("border-[var(--panel-border)]", "rounded-none")}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
