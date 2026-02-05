"use client";

"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { ReceiptPrintHalf, type ReceiptAmounts, type ReceiptLineItem } from "@/components/receipt/receipt-print";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentHeaderRow = {
  shipment_id?: string;
  ship_date?: string | null;
  confirmed_at?: string | null;
  is_store_pickup?: boolean | null;
  memo?: string | null;
  customer_party_id?: string | null;
  customer?: { name?: string | null } | null;
  cms_shipment_line?: Array<{
    shipment_line_id?: string | null;
    model_name?: string | null;
    qty?: number | null;
    material_code?: string | null;
    net_weight_g?: number | null;
    color?: string | null;
    size?: string | null;
    labor_total_sell_krw?: number | null;
    total_amount_sell_krw?: number | null;
    gold_tick_krw_per_g?: number | null;
    silver_tick_krw_per_g?: number | null;
  }> | null;
};

type ReceiptLine = ReceiptLineItem & {
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
    is_store_pickup?: boolean | null;
    customer?: { name?: string | null } | null;
  } | null;
};

type Amounts = ReceiptAmounts;

type ArPositionRow = {
  party_id?: string | null;
  receivable_krw?: number | null;
  labor_cash_outstanding_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
};

type ArInvoicePositionRow = {
  party_id?: string | null;
  occurred_at?: string | null;
  commodity_type?: "gold" | "silver" | null;
  commodity_outstanding_g?: number | null;
  labor_cash_outstanding_krw?: number | null;
  total_cash_outstanding_krw?: number | null;
  shipment_line?: {
    shipment_header?: {
      ship_date?: string | null;
      confirmed_at?: string | null;
      is_store_pickup?: boolean | null;
    } | null;
  } | null;
};


type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ReceiptLine[];
  totals: Amounts;
  today: Amounts;
  previous: Amounts;
  goldPrice: number | null;
  silverPrice: number | null;
};

type ShipmentRow = {
  shipmentId: string;
  customerName: string;
  shipDate: string | null;
  confirmedAt: string | null;
  memo: string | null;
  totalQty: number;
  totalLabor: number;
  totalAmount: number;
  models: string[];
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

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

const getKstDateTime = () => {
  const now = new Date();
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);


const zeroAmounts: Amounts = { gold: 0, silver: 0, labor: 0, total: 0 };

const addAmounts = (base: Amounts, add: Amounts) => ({
  gold: base.gold + add.gold,
  silver: base.silver + add.silver,
  labor: base.labor + add.labor,
  total: base.total + add.total,
});

const subtractAmounts = (base: Amounts, sub: Amounts) => ({
  gold: base.gold - sub.gold,
  silver: base.silver - sub.silver,
  labor: base.labor - sub.labor,
  total: base.total - sub.total,
});

const toArAmounts = (row: ArInvoicePositionRow): Amounts => {
  const commodity = Number(row.commodity_outstanding_g ?? 0);
  const labor = Number(row.labor_cash_outstanding_krw ?? 0);
  const total = Number(row.total_cash_outstanding_krw ?? 0);
  return {
    gold: row.commodity_type === "gold" ? commodity : 0,
    silver: row.commodity_type === "silver" ? commodity : 0,
    labor,
    total,
  };
};

const getArBucket = (
  shipDate: string | null,
  confirmedAtMs: number,
  occurredAtMs: number,
  today: string,
  todayStartMs: number,
  todayEndMs: number
) => {
  const eventMs = Number.isFinite(occurredAtMs) ? occurredAtMs : confirmedAtMs;
  if (Number.isFinite(eventMs)) {
    if (eventMs >= todayStartMs && eventMs < todayEndMs) return "today" as const;
    if (eventMs < todayStartMs) return "previous" as const;
    return "future" as const;
  }
  if (shipDate) {
    if (shipDate === today) return "today" as const;
    if (shipDate < today) return "previous" as const;
    return "future" as const;
  }
  return "unknown" as const;
};

const getMaterialBucket = (code?: string | null) => {
  const material = (code ?? "").trim();
  if (!material || material === "00") return { kind: "none" as const, factor: 0 };
  if (material === "14") return { kind: "gold" as const, factor: 0.6435 };
  if (material === "18") return { kind: "gold" as const, factor: 0.825 };
  if (material === "24") return { kind: "gold" as const, factor: 1 };
  if (material === "925") return { kind: "silver" as const, factor: 0.925 };
  if (material === "999") return { kind: "silver" as const, factor: 1 };
  return { kind: "none" as const, factor: 0 };
};


const toLineAmounts = (line: ReceiptLine): Amounts => {
  const netWeight = Number(line.net_weight_g ?? 0);
  const labor = Number(line.labor_total_sell_krw ?? 0);
  const total = Number(line.total_amount_sell_krw ?? 0);
  const bucket = getMaterialBucket(line.material_code ?? null);
  if (bucket.kind === "none") {
    return { gold: 0, silver: 0, labor: 0, total: 0 };
  }
  const weighted = netWeight * bucket.factor;
  return {
    gold: bucket.kind === "gold" ? weighted : 0,
    silver: bucket.kind === "silver" ? weighted : 0,
    labor,
    total,
  };
};


const chunkLines = (lines: ReceiptLine[], size: number) => {
  const chunks: ReceiptLine[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
};

const getTickPrices = (lines: ReceiptLine[]) => {
  const goldPrice = lines.find((line) => line.gold_tick_krw_per_g != null)?.gold_tick_krw_per_g ?? null;
  const silverPrice = lines.find((line) => line.silver_tick_krw_per_g != null)?.silver_tick_krw_per_g ?? null;
  return { goldPrice, silverPrice };
};

function ShipmentsPrintContent() {
  const schemaClient = getSchemaClient();
  const searchParams = useSearchParams();
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [targetShipmentId, setTargetShipmentId] = useState<string | null>(null);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);

  const mode = searchParams.get("mode") ?? "";
  const isStorePickupMode = mode === "store_pickup";
  const filterPartyId = (searchParams.get("party_id") ?? "").trim();

  const dateParam = (searchParams.get("date") ?? "").trim();
  const today = useMemo(() => (isValidYmd(dateParam) ? dateParam : getKstYmd()), [dateParam]);
  const todayStartIso = useMemo(() => getKstStartIso(today), [today]);
  const todayEndIso = useMemo(() => getKstNextStartIso(today), [today]);
  const todayStartMs = useMemo(() => new Date(todayStartIso).getTime(), [todayStartIso]);
  const todayEndMs = useMemo(() => new Date(todayEndIso).getTime(), [todayEndIso]);
  const [nowLabel, setNowLabel] = useState("");

  useEffect(() => {
    setNowLabel(getKstDateTime());
  }, []);

  const shipmentsQuery = useQuery({
    queryKey: ["shipments-print", today, mode, filterPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, ship_date, confirmed_at, is_store_pickup, memo, customer_party_id, customer:cms_party(name), cms_shipment_line(shipment_line_id, model_name, qty, material_code, net_weight_g, color, size, labor_total_sell_krw, total_amount_sell_krw, gold_tick_krw_per_g, silver_tick_krw_per_g)"
        )
        .eq("status", "CONFIRMED");

      if (isStorePickupMode) {
        const dateFilter = `ship_date.eq.${today},and(ship_date.is.null,confirmed_at.gte.${todayStartIso},confirmed_at.lt.${todayEndIso})`;
        query = query.eq("is_store_pickup", true).or(dateFilter);
        if (filterPartyId) {
          query = query.eq("customer_party_id", filterPartyId);
        }
      } else {
        const nonStorePickup = "or(is_store_pickup.is.null,is_store_pickup.eq.false)";
        const dateFilter = `and(${nonStorePickup},ship_date.eq.${today}),and(${nonStorePickup},confirmed_at.gte.${todayStartIso},confirmed_at.lt.${todayEndIso})`;
        query = query.or(dateFilter);
      }

      const { data, error } = await query.order("confirmed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShipmentHeaderRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const shipments = useMemo<ShipmentRow[]>(() => {
    return (shipmentsQuery.data ?? [])
      .filter((row) => (isStorePickupMode ? row.is_store_pickup : !row.is_store_pickup))
      .map((row) => {
        const lines = row.cms_shipment_line ?? [];
        const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
        const totalLabor = lines.reduce((sum, line) => sum + Number(line.labor_total_sell_krw ?? 0), 0);
        const totalAmount = lines.reduce((sum, line) => sum + Number(line.total_amount_sell_krw ?? 0), 0);
        const models = lines
          .map((line) => (line.model_name ?? "-").trim())
          .filter(Boolean);

        return {
          shipmentId: row.shipment_id ?? "",
          customerName: row.customer?.name ?? "-",
          shipDate: row.ship_date ?? null,
          confirmedAt: row.confirmed_at ?? null,
          memo: row.memo ?? null,
          totalQty,
          totalLabor,
          totalAmount,
          models,
        };
      })
      .filter((row) => Boolean(row.shipmentId));
  }, [shipmentsQuery.data]);

  const todayLines = useMemo<ReceiptLine[]>(() => {
    return (shipmentsQuery.data ?? [])
      .filter((row) => (isStorePickupMode ? row.is_store_pickup : !row.is_store_pickup))
      .flatMap((row) => {
        const header = {
          ship_date: row.ship_date ?? null,
          status: "CONFIRMED",
          customer_party_id: row.customer_party_id ?? null,
          is_store_pickup: row.is_store_pickup ?? null,
          customer: row.customer ?? null,
        };
        return (row.cms_shipment_line ?? []).map((line) => ({
          shipment_line_id: line.shipment_line_id ?? undefined,
          model_name: line.model_name ?? null,
          qty: line.qty ?? null,
          material_code: line.material_code ?? null,
          net_weight_g: line.net_weight_g ?? null,
          color: line.color ?? null,
          size: line.size ?? null,
          labor_total_sell_krw: line.labor_total_sell_krw ?? null,
          total_amount_sell_krw: line.total_amount_sell_krw ?? null,
          gold_tick_krw_per_g: line.gold_tick_krw_per_g ?? null,
          silver_tick_krw_per_g: line.silver_tick_krw_per_g ?? null,
          shipment_header: header,
        }));
      });
  }, [shipmentsQuery.data]);

  const partyGroups = useMemo(() => {
    const map = new Map<string, { partyId: string; partyName: string; lines: ReceiptLine[] }>();
    todayLines.forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const partyName = line.shipment_header?.customer?.name ?? "-";
      const entry = map.get(partyId) ?? { partyId, partyName, lines: [] };
      entry.lines.push(line);
      map.set(partyId, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.partyName.localeCompare(b.partyName, "ko-KR"));
  }, [todayLines]);

  const partyIds = useMemo(() => partyGroups.map((group) => group.partyId), [partyGroups]);

  useEffect(() => {
    if (!activePartyId && partyGroups.length > 0) {
      setActivePartyId(partyGroups[0].partyId);
    }
  }, [activePartyId, partyGroups]);

  const arPositionsQuery = useQuery({
    queryKey: ["shipments-print-ar", partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ArPositionRow[];
      const { data, error } = await schemaClient
        .from("cms_v_ar_position_by_party_v2")
        .select("party_id, receivable_krw, labor_cash_outstanding_krw, gold_outstanding_g, silver_outstanding_g")
        .in("party_id", partyIds);
      if (error) throw error;
      return (data ?? []) as ArPositionRow[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const arInvoicePositionsQuery = useQuery({
    queryKey: ["shipments-print-ar-invoice", today, mode, filterPartyId, partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ArInvoicePositionRow[];
      const { data, error } = await schemaClient
        .from("cms_v_ar_invoice_position_v1")
        .select(
          "party_id, occurred_at, commodity_type, commodity_outstanding_g, labor_cash_outstanding_krw, total_cash_outstanding_krw, shipment_line:cms_shipment_line(shipment_line_id, shipment_header:cms_shipment_header(ship_date, confirmed_at, is_store_pickup))"
        )
        .in("party_id", partyIds);
      if (error) throw error;
      return (data ?? []) as ArInvoicePositionRow[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });


  const arTotalsMap = useMemo(() => {
    return new Map(
      (arPositionsQuery.data ?? []).map((row) => [
        row.party_id ?? "",
        {
          gold: Number(row.gold_outstanding_g ?? 0),
          silver: Number(row.silver_outstanding_g ?? 0),
          labor: Number(row.labor_cash_outstanding_krw ?? 0),
          total: Number(row.receivable_krw ?? 0),
        },
      ])
    );
  }, [arPositionsQuery.data]);


  const todayByParty = useMemo(() => {
    const map = new Map<string, Amounts>();
    todayLines.forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const current = map.get(partyId) ?? { ...zeroAmounts };
      map.set(partyId, addAmounts(current, toLineAmounts(line)));
    });
    return map;
  }, [todayLines]);

  const arTodayMap = useMemo(() => {
    const map = new Map<string, Amounts>();
    (arInvoicePositionsQuery.data ?? []).forEach((row) => {
      const partyId = row.party_id ?? "";
      if (!partyId) return;
      const header = row.shipment_line?.shipment_header ?? null;
      const isStorePickup = header?.is_store_pickup ?? null;
      if (isStorePickupMode ? !isStorePickup : isStorePickup) return;
      const shipDate = header?.ship_date ?? null;
      const confirmedAt = header?.confirmed_at ?? null;
      const occurredAt = row.occurred_at ?? null;
      const confirmedAtMs = confirmedAt ? new Date(confirmedAt).getTime() : NaN;
      const occurredAtMs = occurredAt ? new Date(occurredAt).getTime() : NaN;
      const bucket = getArBucket(shipDate, confirmedAtMs, occurredAtMs, today, todayStartMs, todayEndMs);
      if (bucket !== "today") return;
      const current = map.get(partyId) ?? { ...zeroAmounts };
      map.set(partyId, addAmounts(current, toArAmounts(row)));
    });
    return map;
  }, [arInvoicePositionsQuery.data, isStorePickupMode, today, todayStartMs, todayEndMs]);

  const receiptPages = useMemo(() => {
    const result: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const chunks = chunkLines(group.lines, 15);
      const totals = arTotalsMap.get(group.partyId) ?? { ...zeroAmounts };
      const todaySummary = arTodayMap.get(group.partyId) ?? { ...zeroAmounts };
      const previousSummary = subtractAmounts(totals, todaySummary);
      const { goldPrice, silverPrice } = getTickPrices(group.lines);
      chunks.forEach((chunk) => {
        result.push({
          partyId: group.partyId,
          partyName: group.partyName,
          lines: chunk,
          totals,
          today: todaySummary,
          previous: previousSummary,
          goldPrice,
          silverPrice,
        });
      });
    });

    if (result.length === 0) {
      result.push({
        partyId: "empty",
        partyName: "-",
        lines: [],
        totals: { ...zeroAmounts },
        today: { ...zeroAmounts },
        previous: { ...zeroAmounts },
        goldPrice: null,
        silverPrice: null,
      });
    }

    return result;
  }, [partyGroups, arTotalsMap, arTodayMap]);

  const activeParty = useMemo(() => {
    return partyGroups.find((group) => group.partyId === activePartyId) ?? partyGroups[0] ?? null;
  }, [partyGroups, activePartyId]);

  const visiblePages = useMemo(() => {
    if (!activeParty) return [] as PartyReceiptPage[];
    return receiptPages.filter((page) => page.partyId === activeParty.partyId);
  }, [receiptPages, activeParty]);

  const unconfirmShipmentMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentUnconfirm,
    successMessage: "출고 초기화 완료",
    onSuccess: () => {
      setReasonModalOpen(false);
      setReasonText("");
      setTargetShipmentId(null);
      shipmentsQuery.refetch();
    },
  });

  const handleOpenReason = (shipmentId: string) => {
    setTargetShipmentId(shipmentId);
    setReasonText("");
    setReasonModalOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!targetShipmentId) return;
    const reason = reasonText.trim();
    if (!reason) return;
    await unconfirmShipmentMutation.mutateAsync({
      p_shipment_id: targetShipmentId,
      p_reason: reason,
      p_note: "unconfirm from shipments_print",
    });
  };

  const totalCount = shipments.length;
  const totalLabor = shipments.reduce((sum, row) => sum + row.totalLabor, 0);
  const totalAmount = shipments.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="출고 영수증(통상)"
          subtitle={`기준일: ${today} · ${nowLabel} · 매장출고 제외 · 출고확정됨`}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => shipmentsQuery.refetch()}>
                새로고침
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                영수증 출력
              </Button>
            </div>
          }
        />
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">출고 건수</div>
              <div className="text-xl font-semibold tabular-nums">{totalCount}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 공임</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalLabor)}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 금액</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalAmount)}</div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="border-[var(--panel-border)] h-fit">
            <CardHeader className="border-b border-[var(--panel-border)] py-3">
              <div className="text-sm font-semibold">거래처 선택</div>
            </CardHeader>
            <CardBody className="p-0">
              {shipmentsQuery.isLoading ? (
                <div className="p-6 text-sm text-[var(--muted)]">로딩 중...</div>
              ) : partyGroups.length === 0 ? (
                <div className="p-6 text-sm text-[var(--muted)]">대상 없음</div>
              ) : (
                <div className="divide-y divide-[var(--panel-border)]">
                  {partyGroups.map((group) => {
                    const isActive = group.partyId === activeParty?.partyId;
                    const todaySum = todayByParty.get(group.partyId) ?? { ...zeroAmounts };
                    return (
                      <button
                        key={group.partyId}
                        type="button"
                        onClick={() => setActivePartyId(group.partyId)}
                        className={cn(
                          "w-full text-left px-4 py-3 transition-colors",
                          isActive ? "bg-[var(--panel-hover)]" : "hover:bg-[var(--panel-hover)]"
                        )}
                      >
                        <div className="text-sm font-semibold truncate">{group.partyName}</div>
                        <div className="text-xs text-[var(--muted)] tabular-nums">
                          {group.lines.length}건 · 공임 {formatKrw(todaySum.labor)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="receipt-print-root">
            {shipmentsQuery.isLoading ? (
              <div className="text-sm text-[var(--muted)]">로딩 중...</div>
            ) : visiblePages.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">미리볼 거래처를 선택하세요.</div>
            ) : (
              <div className="space-y-6">
                {visiblePages.map((page, index) => (
                  <div
                    key={`${page.partyId}-${index}`}
                    className={cn(
                      "receipt-print-page mx-auto bg-white p-4 text-black shadow-sm",
                      "border border-neutral-200"
                    )}
                    style={{ width: "100%", height: "194mm" }}
                  >
                    <div className="grid h-full grid-cols-2 gap-4">
                      <div className="h-full border-r border-dashed border-neutral-300 pr-4">
                        <ReceiptPrintHalf
                          partyName={page.partyName}
                          dateLabel={today}
                          lines={page.lines}
                          summaryRows={[
                            { label: "합계", value: page.totals },
                            { label: "이전 미수", value: page.previous },
                            { label: "당일 미수", value: page.today },
                          ]}
                          goldPrice={page.goldPrice}
                          silverPrice={page.silverPrice}
                        />
                      </div>
                      <div className="h-full pl-4">
                        <ReceiptPrintHalf
                          partyName={page.partyName}
                          dateLabel={today}
                          lines={page.lines}
                          summaryRows={[
                            { label: "합계", value: page.totals },
                            { label: "이전 미수", value: page.previous },
                            { label: "당일 미수", value: page.today },
                          ]}
                          goldPrice={page.goldPrice}
                          silverPrice={page.silverPrice}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        title="출고 초기화 사유"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">사유</label>
            <Textarea
              placeholder="예: 당일 발송 불가"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className={cn("text-xs", reasonText.trim() ? "text-[var(--muted)]" : "text-[var(--danger)]")}>
              사유를 입력해야 삭제됩니다.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReasonModalOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmClear}
                disabled={!reasonText.trim() || unconfirmShipmentMutation.isPending}
              >
                {unconfirmShipmentMutation.isPending ? "처리 중..." : "초기화"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ShipmentsPrintPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--muted)]">
          Loading...
        </div>
      )}
    >
      <ShipmentsPrintContent />
    </Suspense>
  );
}
