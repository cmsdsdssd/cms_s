"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileDataList } from "@/mobile/shared/MobileDataList";
import { MobileStickyActions } from "@/mobile/shared/MobileStickyActions";

type UnshippedRow = {
  order_line_id: string;
  customer_party_id: string;
  customer_name?: string;
  model_name?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  status?: string;
  display_status?: string;
  queue_sort_date?: string;
  sent_to_vendor_at?: string | null;
  inbound_at?: string | null;
  memo?: string | null;
};

type ConfirmedShipmentRow = {
  shipment_id: string;
  ship_date?: string | null;
  status?: string | null;
  customer?: { name?: string | null } | null;
};

type ShipmentStageKey = "ORDER_PENDING" | "SENT_TO_VENDOR" | "READY_TO_SHIP" | "CONFIRMED";

const SHIPMENT_STAGES: Array<{ key: ShipmentStageKey; label: string; statuses: string[] }> = [
  { key: "ORDER_PENDING", label: "주문", statuses: ["ORDER_PENDING"] },
  { key: "SENT_TO_VENDOR", label: "공장발주", statuses: ["SENT_TO_VENDOR"] },
  { key: "READY_TO_SHIP", label: "출고대기", statuses: ["READY_TO_SHIP", "WAITING_INBOUND"] },
  { key: "CONFIRMED", label: "출고확정", statuses: ["CONFIRMED"] },
];

export function ShipmentsMobileScreen() {
  const schemaClient = getSchemaClient();
  const [selectedStage, setSelectedStage] = useState<ShipmentStageKey>("ORDER_PENDING");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");

  const unshippedQuery = useQuery({
    queryKey: ["cms", "unshipped_order_lines", "mobile"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.unshippedOrderLines)
        .select("*")
        .order("status_sort_order", { ascending: true })
        .order("queue_sort_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as UnshippedRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const confirmedQuery = useQuery({
    queryKey: ["cms", "shipments_history_mobile", "confirmed"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, ship_date, status, customer:cms_party(name)")
        .eq("status", "CONFIRMED")
        .order("ship_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ConfirmedShipmentRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const selectedStageConfig = useMemo(
    () => SHIPMENT_STAGES.find((stage) => stage.key === selectedStage) ?? SHIPMENT_STAGES[0],
    [selectedStage]
  );

  const stageRows = useMemo(() => {
    if (selectedStage === "CONFIRMED") {
      return (confirmedQuery.data ?? []).filter((row) => {
        const q = search.trim().toLowerCase();
        const customer = String(row.customer?.name ?? "").toLowerCase();
        const shipmentId = String(row.shipment_id ?? "").toLowerCase();
        return q ? customer.includes(q) || shipmentId.includes(q) : true;
      });
    }

    const source = (unshippedQuery.data ?? []).filter((row) =>
      selectedStageConfig.statuses.includes(String(row.status ?? ""))
    );
    const q = search.trim().toLowerCase();
    return source.filter((row) => {
      if (customerId && row.customer_party_id !== customerId) return false;
      if (!q) return true;
      const haystacks = [
        row.model_name,
        row.customer_name,
        row.memo,
        row.color,
        row.size,
        row.order_line_id,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join("\n");
      return haystacks.includes(q);
    });
  }, [selectedStage, selectedStageConfig.statuses, unshippedQuery.data, confirmedQuery.data, customerId, search]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    (unshippedQuery.data ?? []).forEach((row) => {
      if (!row.customer_party_id) return;
      map.set(row.customer_party_id, row.customer_name ?? row.customer_party_id);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [unshippedQuery.data]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const selectedDetailRow = useMemo(() => {
    if (!selectedOrderLineId) return null;
    return (unshippedQuery.data ?? []).find((row) => row.order_line_id === selectedOrderLineId) ?? null;
  }, [selectedOrderLineId, unshippedQuery.data]);

  const loading = selectedStage === "CONFIRMED" ? confirmedQuery.isLoading : unshippedQuery.isLoading;
  const emptyText = loading
    ? "불러오는 중..."
    : selectedStage === "CONFIRMED"
      ? "출고확정 이력이 없습니다."
      : "조건에 맞는 출고 항목이 없습니다.";

  return (
    <MobilePage
      title="출고"
      subtitle="주문 · 공장발주 · 출고대기 · 출고확정"
      actions={
        <div className="flex items-center gap-1">
          {selectedStage !== "CONFIRMED" ? (
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
              선택해제
            </Button>
          ) : null}
          <Link href="/m/shipments/history">
            <Button size="sm" variant="secondary">기존이력</Button>
          </Link>
        </div>
      }
    >
      <div className="sticky top-[72px] z-20 -mx-1 space-y-2 bg-[var(--background)]/95 px-1 pb-2 backdrop-blur">
        <div className="grid grid-cols-4 gap-1 rounded-[10px] border border-[var(--panel-border)] bg-[var(--chip)] p-1">
          {SHIPMENT_STAGES.map((stage) => {
            const active = selectedStage === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => {
                  setSelectedStage(stage.key);
                  setSelected(new Set());
                }}
                className={cn(
                  "rounded-[8px] px-2 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)]"
                )}
              >
                {stage.label}
              </button>
            );
          })}
        </div>

        <Input
          placeholder="모델명/거래처/비고 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFormat={false}
        />

        {selectedStage !== "CONFIRMED" ? (
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">전체 거래처</option>
            {customerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {selectedStage === "CONFIRMED" ? (
        <MobileDataList
          items={stageRows as ConfirmedShipmentRow[]}
          getKey={(row) => row.shipment_id}
          emptyText={emptyText}
          renderItem={(row) => (
            <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-semibold">{row.customer?.name ?? "거래처 미지정"}</div>
                <Badge tone="active">출고확정</Badge>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">출고일: {(row.ship_date ?? "").slice(0, 10) || "-"}</div>
              <div className="text-xs text-[var(--muted)]">Shipment ID: {row.shipment_id}</div>
            </div>
          )}
        />
      ) : (
        <MobileDataList
          items={stageRows as UnshippedRow[]}
          getKey={(row) => row.order_line_id}
          emptyText={emptyText}
          renderItem={(row) => {
            const checked = selected.has(row.order_line_id);
            return (
              <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{row.model_name ?? "-"}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{row.customer_name ?? row.customer_party_id}</div>
                  </div>
                  <Badge tone={checked ? "primary" : "neutral"}>{checked ? "선택" : row.display_status ?? row.status ?? "-"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span>수량: {Number(row.qty ?? 0)}</span>
                  <span>색상: {row.color ?? "-"}</span>
                  <span>사이즈: {row.size ?? "-"}</span>
                  <span>입고일: {(row.inbound_at ?? "-").slice(0, 10)}</span>
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">비고: {row.memo?.trim() ? row.memo : "-"}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={checked ? "primary" : "secondary"}
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.order_line_id)) next.delete(row.order_line_id);
                        else next.add(row.order_line_id);
                        return next;
                      });
                    }}
                  >
                    {checked ? "선택 해제" : "선택"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedOrderLineId(row.order_line_id)}>
                    상세
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}

      {selectedStage !== "CONFIRMED" && selectedIds.length > 0 ? (
        <MobileStickyActions>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-[var(--muted)]">선택 {selectedIds.length}건</div>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>선택 해제</Button>
            <Link href={`/shipments?order_line_ids=${selectedIds.join(",")}`}>
              <Button size="sm">출고 생성</Button>
            </Link>
          </div>
        </MobileStickyActions>
      ) : null}

      <Sheet
        open={Boolean(selectedDetailRow)}
        onOpenChange={(open) => !open && setSelectedOrderLineId(null)}
        title="출고 상세"
      >
        <div className="flex h-full flex-col p-4">
          {selectedDetailRow ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-[var(--muted)]">모델</div>
                <div className="font-semibold">{selectedDetailRow.model_name ?? "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[10px] border border-[var(--panel-border)] p-2">거래처: {selectedDetailRow.customer_name ?? selectedDetailRow.customer_party_id}</div>
                <div className="rounded-[10px] border border-[var(--panel-border)] p-2">수량: {Number(selectedDetailRow.qty ?? 0)}</div>
                <div className="rounded-[10px] border border-[var(--panel-border)] p-2">색상: {selectedDetailRow.color ?? "-"}</div>
                <div className="rounded-[10px] border border-[var(--panel-border)] p-2">사이즈: {selectedDetailRow.size ?? "-"}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--panel-border)] p-3">
                <div className="mb-1 text-xs text-[var(--muted)]">비고</div>
                <div className="whitespace-pre-wrap text-sm">{selectedDetailRow.memo?.trim() ? selectedDetailRow.memo : "-"}</div>
              </div>
            </div>
          ) : null}
        </div>
      </Sheet>
    </MobilePage>
  );
}
