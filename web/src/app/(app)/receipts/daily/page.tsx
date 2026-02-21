"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { ReceiptPrintHalf, type ReceiptAmounts } from "@/components/receipt/receipt-print";
import { Button } from "@/components/ui/button";
import { ListCard } from "@/components/ui/list-card";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { getMaterialFactor } from "@/lib/material-factors";
import { cn } from "@/lib/utils";

type ShipmentLineRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  model_name?: string | null;
  qty?: number | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  net_weight_g?: number | null;
  labor_total_sell_krw?: number | null;
  total_amount_sell_krw?: number | null;
  gold_tick_krw_per_g?: number | null;
  silver_tick_krw_per_g?: number | null;
  purity_rate_snapshot?: number | null;
  material_adjust_factor_snapshot?: number | null;
  market_adjust_factor_snapshot?: number | null;
  effective_factor_snapshot?: number | null;
  gold_adjust_factor_snapshot?: number | null;
  price_basis_snapshot?: string | null;
  silver_adjust_factor?: number | null;
  commodity_due_g?: number | null;
  commodity_price_snapshot_krw_per_g?: number | null;
  material_cash_due_krw?: number | null;
  labor_cash_due_krw?: number | null;
  total_cash_due_krw?: number | null;
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
    is_store_pickup?: boolean | null;
    customer?: { name?: string | null } | null;
  } | null;
};

type Amounts = ReceiptAmounts;

type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ShipmentLineRow[];
  totals: Amounts;
  today: Amounts;
  previous: Amounts;
  goldPrice: number | null;
  silverPrice: number | null;
};

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

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

const getMaterialBucket = (line: ShipmentLineRow) => {
  const material = (line.material_code ?? "").trim();
  if (!material || material === "00") return { kind: "none" as const, factor: 0 };
  const snapshotEffective = Number(line.effective_factor_snapshot ?? Number.NaN);
  if (Number.isFinite(snapshotEffective) && snapshotEffective > 0) {
    if (material === "925" || material === "999") {
      return { kind: "silver" as const, factor: snapshotEffective };
    }
    if (material === "14" || material === "18" || material === "24") {
      return { kind: "gold" as const, factor: snapshotEffective };
    }
  }
  if (material === "14" || material === "18" || material === "24") {
    return { kind: "gold" as const, factor: getMaterialFactor({ materialCode: material }).effectiveFactor };
  }
  if (material === "925" || material === "999") {
    return { kind: "silver" as const, factor: getMaterialFactor({ materialCode: material }).effectiveFactor };
  }
  return { kind: "none" as const, factor: 0 };
};

const toLineAmounts = (line: ShipmentLineRow): Amounts => {
  const netWeight = Number(line.net_weight_g ?? 0);
  const labor = Number(line.labor_total_sell_krw ?? 0);
  const total = Number(line.total_amount_sell_krw ?? 0);
  const bucket = getMaterialBucket(line);
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


const chunkLines = (lines: ShipmentLineRow[], size: number) => {
  const chunks: ShipmentLineRow[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
};

const getTickPrices = (lines: ShipmentLineRow[]) => {
  const goldPrice = lines.find((line) => line.gold_tick_krw_per_g != null)?.gold_tick_krw_per_g ?? null;
  const silverPrice = lines.find((line) => line.silver_tick_krw_per_g != null)?.silver_tick_krw_per_g ?? null;
  return { goldPrice, silverPrice };
};

export default function DailyReceiptsPage() {
  const schemaClient = getSchemaClient();
  const today = useMemo(() => getKstYmd(), []);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

  const todayLinesQuery = useQuery({
    queryKey: ["daily-receipts", today],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, model_name, qty, material_code, color, size, net_weight_g, labor_total_sell_krw, total_amount_sell_krw, gold_tick_krw_per_g, silver_tick_krw_per_g, purity_rate_snapshot, material_adjust_factor_snapshot, market_adjust_factor_snapshot, effective_factor_snapshot, gold_adjust_factor_snapshot, price_basis_snapshot, silver_adjust_factor, shipment_header:cms_shipment_header(ship_date, confirmed_at, status, customer_party_id, is_store_pickup, customer:cms_party(name))"
        )
        .not("shipment_header", "is", null)
        .order("created_at", { ascending: true });
      // Filter in JS since PostgREST nested filtering is limited
      const filtered = (data ?? []).filter((row: ShipmentLineRow) => {
        const header = row.shipment_header;
        if (!header) return false;
        if (header.status !== "CONFIRMED") return false;
        if (header.ship_date !== today) return false;
        if (header.is_store_pickup === true) return false;
        return true;
      });
      if (error) throw error;
      return filtered as ShipmentLineRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const todayLines = useMemo(() => todayLinesQuery.data ?? [], [todayLinesQuery.data]);

  const todayLineIds = useMemo(
    () => Array.from(new Set(todayLines.map((line) => String(line.shipment_line_id ?? "").trim()).filter(Boolean))),
    [todayLines]
  );

  const invoiceSnapshotQuery = useQuery({
    queryKey: ["daily-receipts-invoice-snapshot", todayLineIds.join(",")],
    queryFn: async () => {
      if (!schemaClient || todayLineIds.length === 0) return [] as Array<{
        shipment_line_id?: string | null;
        commodity_due_g?: number | null;
        commodity_price_snapshot_krw_per_g?: number | null;
        material_cash_due_krw?: number | null;
        labor_cash_due_krw?: number | null;
        total_cash_due_krw?: number | null;
      }>;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select("shipment_line_id, commodity_due_g, commodity_price_snapshot_krw_per_g, material_cash_due_krw, labor_cash_due_krw, total_cash_due_krw")
        .in("shipment_line_id", todayLineIds);
      if (error) throw error;
      return (data ?? []) as Array<{
        shipment_line_id?: string | null;
        commodity_due_g?: number | null;
        commodity_price_snapshot_krw_per_g?: number | null;
        material_cash_due_krw?: number | null;
        labor_cash_due_krw?: number | null;
        total_cash_due_krw?: number | null;
      }>;
    },
    enabled: Boolean(schemaClient) && todayLineIds.length > 0,
  });

  const invoiceSnapshotByLineId = useMemo(() => {
    const map = new Map<string, {
      commodity_due_g?: number | null;
      commodity_price_snapshot_krw_per_g?: number | null;
      material_cash_due_krw?: number | null;
      labor_cash_due_krw?: number | null;
      total_cash_due_krw?: number | null;
    }>();
    (invoiceSnapshotQuery.data ?? []).forEach((row) => {
      const key = String(row.shipment_line_id ?? "").trim();
      if (!key) return;
      map.set(key, {
        commodity_due_g: row.commodity_due_g ?? null,
        commodity_price_snapshot_krw_per_g: row.commodity_price_snapshot_krw_per_g ?? null,
        material_cash_due_krw: row.material_cash_due_krw ?? null,
        labor_cash_due_krw: row.labor_cash_due_krw ?? null,
        total_cash_due_krw: row.total_cash_due_krw ?? null,
      });
    });
    return map;
  }, [invoiceSnapshotQuery.data]);

  const todayLinesForReceipt = useMemo(
    () =>
      todayLines.map((line) => {
        const key = String(line.shipment_line_id ?? "").trim();
        const snapshot = key ? invoiceSnapshotByLineId.get(key) : undefined;
        if (!snapshot) return line;
        return {
          ...line,
          commodity_due_g: snapshot.commodity_due_g ?? null,
          commodity_price_snapshot_krw_per_g: snapshot.commodity_price_snapshot_krw_per_g ?? null,
          material_cash_due_krw: snapshot.material_cash_due_krw ?? null,
          labor_cash_due_krw: snapshot.labor_cash_due_krw ?? null,
          total_cash_due_krw: snapshot.total_cash_due_krw ?? null,
        };
      }),
    [invoiceSnapshotByLineId, todayLines]
  );

  const partyGroups = useMemo(() => {
    const map = new Map<string, { partyId: string; partyName: string; lines: ShipmentLineRow[] }>();
    todayLinesForReceipt.forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const partyName = line.shipment_header?.customer?.name ?? "-";
      const entry = map.get(partyId) ?? { partyId, partyName, lines: [] };
      entry.lines.push(line);
      map.set(partyId, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.partyName.localeCompare(b.partyName, "ko-KR"));
  }, [todayLinesForReceipt]);

  const partyIds = useMemo(() => partyGroups.map((group) => group.partyId), [partyGroups]);
  const activePartyId = selectedPartyId ?? partyGroups[0]?.partyId ?? null;

  const arPositionsQuery = useQuery({
    queryKey: ["daily-receipts-ar", partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as Array<{ party_id?: string | null; receivable_krw?: number | null }>;
      const { data, error } = await schemaClient
        .from("cms_v_ar_position_by_party")
        .select("party_id, receivable_krw")
        .in("party_id", partyIds);
      if (error) throw error;
      return (data ?? []) as Array<{ party_id?: string | null; receivable_krw?: number | null }>;
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const totalsQuery = useQuery({
    queryKey: ["daily-receipts-total", today, partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ShipmentLineRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, material_code, net_weight_g, labor_total_sell_krw, total_amount_sell_krw, shipment_header:cms_shipment_header(ship_date, status, customer_party_id, is_store_pickup)"
        )
        .in("shipment_header.customer_party_id", partyIds);
      if (error) throw error;
      // Filter in JS since PostgREST nested OR is unsupported
      const filtered = (data ?? []).filter((row: ShipmentLineRow) => {
        const header = row.shipment_header;
        if (!header) return false;
        if (header.status !== "CONFIRMED") return false;
        if (header.ship_date && header.ship_date > today) return false;
        if (header.is_store_pickup === true) return false;
        return true;
      });
      return filtered as ShipmentLineRow[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const totalsByParty = useMemo(() => {
    const map = new Map<string, Amounts>();
    (totalsQuery.data ?? []).forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const current = map.get(partyId) ?? { ...zeroAmounts };
      map.set(partyId, addAmounts(current, toLineAmounts(line)));
    });
    return map;
  }, [totalsQuery.data]);

  const arReceivableMap = useMemo(() => {
    return new Map(
      (arPositionsQuery.data ?? []).map((row) => [
        row.party_id ?? "",
        Number(row.receivable_krw ?? 0),
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

  const pages = useMemo(() => {
    const result: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const chunks = chunkLines(group.lines, 8);
      const totalsBase = totalsByParty.get(group.partyId) ?? { ...zeroAmounts };
      const totals = {
        ...totalsBase,
        total: arReceivableMap.get(group.partyId) ?? totalsBase.total,
      };
      const todaySum = todayByParty.get(group.partyId) ?? { ...zeroAmounts };
      const previous = subtractAmounts(totals, todaySum);
      const { goldPrice, silverPrice } = getTickPrices(group.lines);
      chunks.forEach((chunk) => {
        result.push({
          partyId: group.partyId,
          partyName: group.partyName,
          lines: chunk,
          totals,
          today: todaySum,
          previous,
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
  }, [partyGroups, todayByParty, totalsByParty, arReceivableMap]);

  const visiblePages = useMemo(() => {
    if (!activePartyId) return pages;
    return pages.filter((page) => page.partyId === activePartyId);
  }, [activePartyId, pages]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions border-b border-[var(--panel-border)] bg-[var(--background)]/80 px-6 py-4 backdrop-blur">
        <ActionBar
          title="A4 가로 영수증 (당일 출고)"
          subtitle={`기준일: ${today}`}
          actions={
            <Button variant="primary" onClick={() => window.print()}>
              인쇄
            </Button>
          }
        />
      </div>

      <div className="flex gap-6 px-6 py-6">
        <aside className="receipt-party-sidebar w-[280px] shrink-0">
          <div className="rounded-[var(--radius)] border border-[var(--panel-border)] bg-[var(--panel)]">
            <div className="border-b border-[var(--panel-border)] px-4 py-3 text-sm font-semibold">
              당일 출고 거래처
            </div>
            {todayLinesQuery.isLoading ? (
              <div className="px-4 py-3 text-sm text-[var(--muted)]">로딩 중...</div>
            ) : partyGroups.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--muted)]">당일 출고 없음</div>
            ) : (
              <div className="flex flex-col">
                {partyGroups.map((group) => (
                  <button
                    key={group.partyId}
                    onClick={() => setSelectedPartyId(group.partyId)}
                    className="w-full text-left"
                    type="button"
                  >
                    <ListCard
                      title={group.partyName}
                      subtitle={`출고 ${group.lines.length}건`}
                      selected={group.partyId === activePartyId}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="receipt-print-root flex-1 space-y-6">
          {todayLinesQuery.isLoading ? (
            <div className="text-sm text-[var(--muted)]">로딩 중...</div>
          ) : (
            visiblePages.map((page, index) => (
              <div
                key={`${page.partyId}-${index}`}
                className={cn(
                  "receipt-print-page mx-auto bg-white p-4 text-black shadow-sm",
                  "border border-neutral-200"
                )}
                style={{ width: "297mm", height: "210mm" }}
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
                        { label: "당일출고 미수", value: page.today },
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
                        { label: "당일출고 미수", value: page.today },
                      ]}
                      goldPrice={page.goldPrice}
                      silverPrice={page.silverPrice}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
