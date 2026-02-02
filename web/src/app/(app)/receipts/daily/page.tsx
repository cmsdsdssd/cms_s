"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { ListCard } from "@/components/ui/list-card";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentLineRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  model_name?: string | null;
  qty?: number | null;
  material_code?: string | null;
  material_amount_sell_krw?: number | null;
  labor_total_sell_krw?: number | null;
  total_amount_sell_krw?: number | null;
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
    is_store_pickup?: boolean | null;
    customer?: { name?: string | null } | null;
  } | null;
};

type Amounts = {
  gold: number;
  silver: number;
  labor: number;
  total: number;
};

type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ShipmentLineRow[];
  totals: Amounts;
  today: Amounts;
  previous: Amounts;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
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

const toLineAmounts = (line: ShipmentLineRow): Amounts => {
  const material = Number(line.material_amount_sell_krw ?? 0);
  const labor = Number(line.labor_total_sell_krw ?? 0);
  const total = Number(line.total_amount_sell_krw ?? 0);
  const isSilver = line.material_code === "925";
  return {
    gold: isSilver ? 0 : material,
    silver: isSilver ? material : 0,
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

const ReceiptHalf = ({
  partyName,
  dateLabel,
  lines,
  totals,
  today,
  previous,
}: {
  partyName: string;
  dateLabel: string;
  lines: ShipmentLineRow[];
  totals: Amounts;
  today: Amounts;
  previous: Amounts;
}) => {
  const paddedLines = useMemo(() => {
    const next = [...lines];
    while (next.length < 8) next.push({});
    return next;
  }, [lines]);

  const summaryRows = [
    { label: "합계", value: totals },
    { label: "이전 미수", value: previous },
    { label: "당일출고 미수", value: today },
  ];

  return (
    <div className="flex h-full flex-col gap-4 text-[11px] text-black">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">MS</div>
          <div className="text-[10px] text-neutral-600">거래명세/영수증</div>
        </div>
        <div className="text-right text-[10px] text-neutral-600">
          <div>{dateLabel}</div>
          <div className="font-medium text-black">{partyName}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">당일 출고 내역</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">모델</th>
              <th className="py-1 text-right font-medium">수량</th>
              <th className="py-1 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {paddedLines.map((line, index) => (
              <tr key={line.shipment_line_id ?? `row-${index}`} className="border-b border-neutral-200">
                <td className="py-1 pr-2 align-middle">
                  {(line.model_name ?? "").toString()}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {line.qty ?? ""}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {line.total_amount_sell_krw === null || line.total_amount_sell_krw === undefined
                    ? ""
                    : formatKrw(line.total_amount_sell_krw)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">미수 내역 (요약)</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">구분</th>
              <th className="py-1 text-right font-medium">금</th>
              <th className="py-1 text-right font-medium">은</th>
              <th className="py-1 text-right font-medium">공임</th>
              <th className="py-1 text-right font-medium">총금액</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label} className="border-b border-neutral-200">
                <td className="py-1 font-medium">{row.label}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.gold)}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.silver)}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.labor)}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
          "shipment_line_id, shipment_id, model_name, qty, material_code, material_amount_sell_krw, labor_total_sell_krw, total_amount_sell_krw, shipment_header:cms_shipment_header(ship_date, confirmed_at, status, customer_party_id, is_store_pickup, customer:cms_party(name))"
        )
        .eq("shipment_header.status", "CONFIRMED")
        .eq("shipment_header.ship_date", today)
        .or("shipment_header.is_store_pickup.is.null,shipment_header.is_store_pickup.eq.false")
        .order("shipment_header.confirmed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const todayLines = useMemo(() => todayLinesQuery.data ?? [], [todayLinesQuery.data]);

  const partyGroups = useMemo(() => {
    const map = new Map<string, { partyId: string; partyName: string; lines: ShipmentLineRow[] }>();
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
          "shipment_line_id, material_code, material_amount_sell_krw, labor_total_sell_krw, total_amount_sell_krw, shipment_header:cms_shipment_header(ship_date, status, customer_party_id, is_store_pickup)"
        )
        .eq("shipment_header.status", "CONFIRMED")
        .lte("shipment_header.ship_date", today)
        .in("shipment_header.customer_party_id", partyIds)
        .or("shipment_header.is_store_pickup.is.null,shipment_header.is_store_pickup.eq.false");
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
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
      chunks.forEach((chunk) => {
        result.push({
          partyId: group.partyId,
          partyName: group.partyName,
          lines: chunk,
          totals,
          today: todaySum,
          previous,
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
                style={{ width: "297mm", minHeight: "210mm" }}
              >
                <div className="grid h-full grid-cols-2 gap-4">
                  <div className="border-r border-dashed border-neutral-300 pr-4">
                    <ReceiptHalf
                      partyName={page.partyName}
                      dateLabel={today}
                      lines={page.lines}
                      totals={page.totals}
                      today={page.today}
                      previous={page.previous}
                    />
                  </div>
                  <div className="pl-4">
                    <ReceiptHalf
                      partyName={page.partyName}
                      dateLabel={today}
                      lines={page.lines}
                      totals={page.totals}
                      today={page.today}
                      previous={page.previous}
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
