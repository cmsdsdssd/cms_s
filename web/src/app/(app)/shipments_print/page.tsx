"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
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
    size?: string | null;
    material_amount_sell_krw?: number | null;
    labor_total_sell_krw?: number | null;
    total_amount_sell_krw?: number | null;
  }> | null;
};

type ReceiptLine = {
  shipment_line_id?: string;
  model_name?: string | null;
  qty?: number | null;
  material_code?: string | null;
  net_weight_g?: number | null;
  size?: string | null;
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
  lines: ReceiptLine[];
  totals: Amounts;
  today: Amounts;
  previous: Amounts;
};

type ShipmentRow = {
  shipmentId: string;
  customerName: string;
  shipDate: string | null;
  confirmedAt: string | null;
  memo: string | null;
  totalQty: number;
  totalAmount: number;
  models: string[];
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatWeight = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}g`;
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

const zeroAmounts: Amounts = { gold: 0, silver: 0, labor: 0, total: 0 };

const addAmounts = (base: Amounts, add: Amounts) => ({
  gold: base.gold + add.gold,
  silver: base.silver + add.silver,
  labor: base.labor + add.labor,
  total: base.total + add.total,
});


const toLineAmounts = (line: ReceiptLine): Amounts => {
  const netWeight = Number(line.net_weight_g ?? 0);
  const labor = Number(line.labor_total_sell_krw ?? 0);
  const total = Number(line.total_amount_sell_krw ?? 0);
  const isSilver = line.material_code === "925";
  return {
    gold: isSilver ? 0 : netWeight,
    silver: isSilver ? netWeight : 0,
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
  lines: ReceiptLine[];
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
    { label: "당일 미수", value: today },
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

      <div className="flex-1 space-y-2">
        <div className="text-xs font-semibold">당일 출고 내역</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">모델</th>
              <th className="py-1 text-left font-medium">소재</th>
              <th className="py-1 text-right font-medium">중량(g)</th>
              <th className="py-1 text-right font-medium">사이</th>
              <th className="py-1 text-right font-medium">공임</th>
              <th className="py-1 text-right font-medium">은(g)</th>
              <th className="py-1 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {paddedLines.map((line, index) => (
              <tr key={line.shipment_line_id ?? `row-${index}`} className="border-b border-neutral-200">
                <td className="py-1 pr-2 align-middle">
                  {(line.model_name ?? "").toString()}
                </td>
                <td className="py-1 text-left tabular-nums">{line.material_code ?? ""}</td>
                <td className="py-1 text-right tabular-nums">
                  {line.net_weight_g === null || line.net_weight_g === undefined
                    ? ""
                    : formatWeight(line.net_weight_g)}
                </td>
                <td className="py-1 text-right tabular-nums">{line.size ?? ""}</td>
                <td className="py-1 text-right tabular-nums">
                  {line.labor_total_sell_krw === null || line.labor_total_sell_krw === undefined
                    ? ""
                    : formatKrw(line.labor_total_sell_krw)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {line.material_code === "925" && line.net_weight_g !== null && line.net_weight_g !== undefined
                    ? formatWeight(line.net_weight_g)
                    : ""}
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

      <div className="mt-auto space-y-2">
        <div className="text-xs font-semibold">미수 내역 (요약)</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">구분</th>
              <th className="py-1 text-right font-medium">금(g)</th>
              <th className="py-1 text-right font-medium">은(g)</th>
              <th className="py-1 text-right font-medium">공임</th>
              <th className="py-1 text-right font-medium">총금액</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label} className="border-b border-neutral-200">
                <td className="py-1 font-medium">{row.label}</td>
                <td className="py-1 text-right tabular-nums">{formatWeight(row.value.gold)}</td>
                <td className="py-1 text-right tabular-nums">{formatWeight(row.value.silver)}</td>
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

export default function ShipmentsPrintPage() {
  const schemaClient = getSchemaClient();
  const searchParams = useSearchParams();
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [targetShipmentId, setTargetShipmentId] = useState<string | null>(null);

  const mode = searchParams.get("mode") ?? "";
  const isStorePickupMode = mode === "store_pickup";
  const filterPartyId = (searchParams.get("party_id") ?? "").trim();

  const today = useMemo(() => getKstYmd(), []);
  const todayStartIso = useMemo(() => getKstStartIso(today), [today]);
  const todayEndIso = useMemo(() => getKstNextStartIso(today), [today]);
  const nowLabel = useMemo(() => getKstDateTime(), []);

  const shipmentsQuery = useQuery({
    queryKey: ["shipments-print", today, mode, filterPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, ship_date, confirmed_at, is_store_pickup, memo, customer_party_id, customer:cms_party(name), cms_shipment_line(shipment_line_id, model_name, qty, material_code, net_weight_g, size, material_amount_sell_krw, labor_total_sell_krw, total_amount_sell_krw)"
        )
        .eq("status", "CONFIRMED");

      if (isStorePickupMode) {
        query = query
          .eq("is_store_pickup", true)
          .gte("confirmed_at", todayStartIso)
          .lt("confirmed_at", todayEndIso);
        if (filterPartyId) {
          query = query.eq("customer_party_id", filterPartyId);
        }
      } else {
        query = query
          .eq("ship_date", today)
          .or("is_store_pickup.is.null,is_store_pickup.eq.false");
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
          size: line.size ?? null,
          material_amount_sell_krw: line.material_amount_sell_krw ?? null,
          labor_total_sell_krw: line.labor_total_sell_krw ?? null,
          total_amount_sell_krw: line.total_amount_sell_krw ?? null,
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

  const totalsQuery = useQuery({
    queryKey: ["shipments-print-total", today, mode, filterPartyId, partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ReceiptLine[];
      let query = schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, material_code, net_weight_g, material_amount_sell_krw, labor_total_sell_krw, total_amount_sell_krw, shipment_header:cms_shipment_header(ship_date, confirmed_at, status, customer_party_id, is_store_pickup)"
        )
        .eq("shipment_header.status", "CONFIRMED")
        .in("shipment_header.customer_party_id", partyIds);

      if (isStorePickupMode) {
        query = query
          .eq("shipment_header.is_store_pickup", true)
          .lte("shipment_header.confirmed_at", todayEndIso);
      } else {
        query = query
          .lte("shipment_header.ship_date", today)
          .or("shipment_header.is_store_pickup.is.null,shipment_header.is_store_pickup.eq.false");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReceiptLine[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const arPositionsQuery = useQuery({
    queryKey: ["shipments-print-ar", partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as Array<{ party_id?: string | null; balance_krw?: number | null }>;
      const { data, error } = await schemaClient
        .from("cms_v_ar_position_by_party")
        .select("party_id, balance_krw")
        .in("party_id", partyIds);
      if (error) throw error;
      return (data ?? []) as Array<{ party_id?: string | null; balance_krw?: number | null }>;
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

  const arBalanceMap = useMemo(() => {
    return new Map(
      (arPositionsQuery.data ?? []).map((row) => [
        row.party_id ?? "",
        Number(row.balance_krw ?? 0),
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

  const previousLinesQuery = useQuery({
    queryKey: ["shipments-print-prev-lines", today, mode, filterPartyId, partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ReceiptLine[];
      let query = schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, model_name, qty, material_code, net_weight_g, material_amount_sell_krw, labor_total_sell_krw, total_amount_sell_krw, shipment_header:cms_shipment_header(ship_date, confirmed_at, status, customer_party_id, is_store_pickup, customer:cms_party(name))"
        )
        .eq("shipment_header.status", "CONFIRMED")
        .in("shipment_header.customer_party_id", partyIds);

      if (isStorePickupMode) {
        query = query
          .eq("shipment_header.is_store_pickup", true)
          .lt("shipment_header.confirmed_at", todayStartIso);
      } else {
        query = query
          .lt("shipment_header.ship_date", today)
          .or("shipment_header.is_store_pickup.is.null,shipment_header.is_store_pickup.eq.false");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReceiptLine[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const previousByParty = useMemo(() => {
    const map = new Map<string, Amounts>();
    (previousLinesQuery.data ?? []).forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const current = map.get(partyId) ?? { ...zeroAmounts };
      map.set(partyId, addAmounts(current, toLineAmounts(line)));
    });
    return map;
  }, [previousLinesQuery.data]);

  const arPreviousQuery = useQuery({
    queryKey: ["shipments-print-ar-prev", todayStartIso, partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as Array<{ party_id?: string | null; amount_krw?: number | null }>;
      const { data, error } = await schemaClient
        .from("cms_ar_ledger")
        .select("party_id, amount_krw, occurred_at")
        .in("party_id", partyIds)
        .lt("occurred_at", todayStartIso);
      if (error) throw error;
      return (data ?? []) as Array<{ party_id?: string | null; amount_krw?: number | null }>;
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const arPreviousMap = useMemo(() => {
    const map = new Map<string, number>();
    (arPreviousQuery.data ?? []).forEach((row) => {
      const partyId = row.party_id ?? "";
      if (!partyId) return;
      const current = map.get(partyId) ?? 0;
      map.set(partyId, current + Number(row.amount_krw ?? 0));
    });
    return map;
  }, [arPreviousQuery.data]);

  const receiptPages = useMemo(() => {
    const result: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const chunks = chunkLines(group.lines, 8);
      const todaySum = todayByParty.get(group.partyId) ?? { ...zeroAmounts };
      const previousBase = previousByParty.get(group.partyId) ?? { ...zeroAmounts };
      const previous = {
        ...previousBase,
        total: arPreviousMap.get(group.partyId) ?? previousBase.total,
      };
      const totals = {
        gold: previous.gold + todaySum.gold,
        silver: previous.silver + todaySum.silver,
        labor: previous.labor + todaySum.labor,
        total: arBalanceMap.get(group.partyId) ?? previous.total + todaySum.total,
      };
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
  }, [partyGroups, arBalanceMap, todayByParty, previousByParty, arPreviousMap]);

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
  const totalQty = shipments.reduce((sum, row) => sum + row.totalQty, 0);
  const totalAmount = shipments.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="출고 영수증(통상)"
          subtitle={
            <span suppressHydrationWarning>
              기준일: {today} · {nowLabel} · 매장출고 제외 · 출고확정됨
            </span>
          }
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
              <div className="text-xs text-[var(--muted)]">총 수량</div>
              <div className="text-xl font-semibold tabular-nums">{totalQty}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 금액</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalAmount)}</div>
            </CardBody>
          </Card>
        </div>

        <Card className="border-[var(--panel-border)]">
          <CardHeader className="border-b border-[var(--panel-border)] py-3">
            <div className="text-sm font-semibold">오늘 출고 대상</div>
          </CardHeader>
          <CardBody className="p-0">
            {shipmentsQuery.isLoading ? (
              <div className="p-6 text-sm text-[var(--muted)]">로딩 중...</div>
            ) : shipments.length === 0 ? (
              <div className="p-6 text-sm text-[var(--muted)]">대상 없음</div>
            ) : (
              <div className="divide-y divide-[var(--panel-border)]">
                {shipments.map((row) => (
                  <div key={row.shipmentId} className="p-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-4">
                    <div>
                      <div className="text-sm font-semibold">{row.customerName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {row.models.join(", ") || "-"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">ID: {row.shipmentId.slice(0, 8)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">확정시각</div>
                      <div className="text-sm font-medium">{formatDateTimeKst(row.confirmedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">수량/금액</div>
                      <div className="text-sm font-medium tabular-nums">
                        {row.totalQty}개 · {formatKrw(row.totalAmount)}
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenReason(row.shipmentId)}
                      >
                        출고 초기화
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="receipt-print-root px-6 pb-10 pt-2">
        <div className="space-y-6">
          {shipmentsQuery.isLoading ? (
            <div className="text-sm text-[var(--muted)]">로딩 중...</div>
          ) : (
            receiptPages.map((page, index) => (
              <div
                key={`${page.partyId}-${index}`}
                className={cn(
                  "receipt-print-page mx-auto bg-white p-4 text-black shadow-sm",
                  "border border-neutral-200"
                )}
                style={{ width: "100%", minHeight: "194mm" }}
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
