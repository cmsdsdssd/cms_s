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
import { NumberText } from "@/components/ui/number-text";

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

type ConfirmedDetailLineRow = {
  shipment_line_id: string;
  shipment_id: string;
  model_name?: string | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  memo?: string | null;
  net_weight_g?: number | null;
  measured_weight_g?: number | null;
  deduction_weight_g?: number | null;
  base_labor_krw?: number | null;
  labor_total_sell_krw?: number | null;
  extra_labor_krw?: number | null;
  extra_labor_items?: unknown;
  image_url?: string | null;
  vendor_name?: string | null;
};

type ShipmentStageKey = "ORDER_PENDING" | "SENT_TO_VENDOR" | "READY_TO_SHIP" | "CONFIRMED";

type DecorItem = { id: string; label: string; amount: number; isStone: boolean };

const SHIPMENT_STAGES: Array<{ key: ShipmentStageKey; label: string; statuses: string[] }> = [
  { key: "ORDER_PENDING", label: "주문", statuses: ["ORDER_PENDING"] },
  { key: "SENT_TO_VENDOR", label: "공장발주", statuses: ["SENT_TO_VENDOR"] },
  { key: "READY_TO_SHIP", label: "출고대기", statuses: ["READY_TO_SHIP", "WAITING_INBOUND"] },
  { key: "CONFIRMED", label: "출고확정", statuses: ["CONFIRMED"] },
];

function parseDecorItems(value: unknown): DecorItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const type = String(row.type ?? "").toUpperCase();
      const meta = row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : null;
      const amountRaw = Number(row.amount ?? meta?.sell_krw ?? 0);
      if (!Number.isFinite(amountRaw) || amountRaw === 0) return null;
      const label = String(row.label ?? meta?.item_label ?? meta?.reason_note ?? "기타공임").trim() || "기타공임";
      const isStone = type.includes("STONE");
      return {
        id: String(row.id ?? `${type || "item"}-${index}`),
        label,
        amount: amountRaw,
        isStone,
      } satisfies DecorItem;
    })
    .filter((item): item is DecorItem => Boolean(item));
}

export function ShipmentsMobileScreen() {
  const schemaClient = getSchemaClient();
  const [selectedStage, setSelectedStage] = useState<ShipmentStageKey>("ORDER_PENDING");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [selectedConfirmedShipmentId, setSelectedConfirmedShipmentId] = useState<string | null>(null);
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

  const confirmedDetailQuery = useQuery({
    queryKey: ["cms", "shipments_history_mobile", "confirmed_detail", selectedConfirmedShipmentId ?? ""],
    enabled: Boolean(selectedConfirmedShipmentId),
    staleTime: 300_000,
    queryFn: async () => {
      if (!selectedConfirmedShipmentId) return [] as ConfirmedDetailLineRow[];
      const response = await fetch(`/api/mobile-shipments-confirmed?shipment_id=${encodeURIComponent(selectedConfirmedShipmentId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { lines?: ConfirmedDetailLineRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "출고확정 상세 조회 실패");
      return json.lines ?? [];
    },
  });

  const confirmedCardPreviewQuery = useQuery({
    queryKey: ["cms", "shipments_history_mobile", "confirmed_card_preview", selectedStage, (confirmedQuery.data ?? []).map((row) => row.shipment_id).slice(0, 120).join(",")],
    enabled: selectedStage === "CONFIRMED" && (confirmedQuery.data ?? []).length > 0,
    staleTime: 120_000,
    queryFn: async () => {
      const shipmentIds = (confirmedQuery.data ?? []).map((row) => row.shipment_id).filter(Boolean).slice(0, 120);
      if (shipmentIds.length === 0) return new Map<string, { model_name?: string | null; material_code?: string | null; color?: string | null; size?: string | null; memo?: string | null }>();

      const response = await fetch(`/api/mobile-shipments-confirmed?shipment_ids=${encodeURIComponent(shipmentIds.join(","))}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as {
        preview?: Record<string, { model_name?: string | null; material_code?: string | null; color?: string | null; size?: string | null; memo?: string | null }>;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "출고확정 미리보기 조회 실패");

      const map = new Map<string, { model_name?: string | null; material_code?: string | null; color?: string | null; size?: string | null; memo?: string | null }>();
      for (const [shipmentId, preview] of Object.entries(json.preview ?? {})) {
        map.set(shipmentId, preview ?? {});
      }
      return map;
    },
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

  const selectedConfirmedHeader = useMemo(
    () => (confirmedQuery.data ?? []).find((row) => row.shipment_id === selectedConfirmedShipmentId) ?? null,
    [confirmedQuery.data, selectedConfirmedShipmentId]
  );

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
      <div className="sticky top-[calc(88px+env(safe-area-inset-top,0px))] z-20 -mx-1 space-y-2 bg-[var(--background)]/95 px-1 pb-2 backdrop-blur">
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
              {(() => {
                const preview = confirmedCardPreviewQuery.data?.get(row.shipment_id);
                return (
                  <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-semibold">{row.customer?.name ?? "거래처 미지정"}</div>
                <Badge tone="active">출고확정</Badge>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">{(row.ship_date ?? "").slice(0, 10) || "-"} | {preview?.model_name ?? "-"}</div>
              <div className="text-xs text-[var(--muted)]">{preview?.material_code ?? "-"} | {preview?.color ?? "-"} | {preview?.size ?? "-"}</div>
              <div className="line-clamp-1 text-xs text-[var(--muted)]">{preview?.memo?.trim() ? preview.memo : "-"}</div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setSelectedConfirmedShipmentId(row.shipment_id)}>상세보기</Button>
              </div>
                  </>
                );
              })()}
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

      <Sheet
        open={Boolean(selectedConfirmedShipmentId)}
        onOpenChange={(open) => !open && setSelectedConfirmedShipmentId(null)}
        title="출고확정 상세"
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-3 text-xs text-[var(--muted)]">
            Shipment ID: {selectedConfirmedShipmentId ?? "-"} · 고객: {selectedConfirmedHeader?.customer?.name ?? "-"}
          </div>
          <MobileDataList
            items={confirmedDetailQuery.data ?? []}
            getKey={(row) => row.shipment_line_id}
            emptyText={confirmedDetailQuery.isLoading ? "불러오는 중..." : "출고 라인이 없습니다."}
            renderItem={(line) => {
              const decorItems = parseDecorItems(line.extra_labor_items);
              const stoneLaborSell = decorItems
                .filter((item) => item.isStone)
                .reduce((sum, item) => sum + item.amount, 0);
              const totalExtraSell = decorItems.length > 0
                ? decorItems.reduce((sum, item) => sum + item.amount, 0)
                : Number(line.extra_labor_krw ?? 0);
              const etcLaborSell = totalExtraSell - stoneLaborSell;
              const etcDetails = decorItems.filter((item) => !item.isStone);

              return (
                <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                  <div className="flex gap-2">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border border-[var(--panel-border)] bg-[var(--chip)]">
                      {line.image_url ? (
                        <img src={line.image_url} alt={line.model_name ?? "shipment-line"} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{selectedConfirmedHeader?.customer?.name ?? "거래처 미지정"}</div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-md bg-[var(--chip)] px-2 py-1.5 text-[var(--foreground)]">{line.model_name ?? "-"}</div>

                  <div className="mt-1 rounded-md bg-[var(--chip)] px-2 py-1.5">
                    <div className="grid grid-cols-[76px_1fr_76px_1fr_76px_1fr] gap-x-1 gap-y-1">
                      <span className="text-[var(--muted)]">소재</span>
                      <span className="font-semibold">{line.material_code ?? "-"}</span>
                      <span className="text-[var(--muted)]">사이즈</span>
                      <span className="font-semibold">{line.size ?? "-"}</span>
                      <span className="text-[var(--muted)]">공장명</span>
                      <span className="truncate font-semibold">{line.vendor_name ?? "-"}</span>
                    </div>
                  </div>

                  <div className="mt-1 rounded-md bg-[var(--chip)] px-2 py-1.5">
                    <div className="grid grid-cols-[76px_1fr_76px_1fr] gap-x-1 gap-y-1">
                      <span className="text-[var(--muted)]">총공임</span>
                      <span className="font-semibold"><NumberText value={Number(line.labor_total_sell_krw ?? 0)} />원</span>
                      <span className="text-[var(--muted)]">총중량</span>
                      <span className="font-semibold"><NumberText value={Number(line.net_weight_g ?? 0)} />g</span>
                    </div>
                  </div>

                  <div className="mt-1 rounded-md bg-[var(--chip)] px-2 py-1.5">
                    <div className="grid grid-cols-[76px_1fr_76px_1fr_96px_1fr] gap-x-1 gap-y-1">
                      <span className="text-[var(--muted)]">중량</span>
                      <span className="font-semibold"><NumberText value={Number(line.measured_weight_g ?? 0)} />g</span>
                      <span className="text-[var(--muted)]">차감중량</span>
                      <span className="font-semibold"><NumberText value={Number(line.deduction_weight_g ?? 0)} />g</span>
                      <span className="text-[var(--muted)]">기본공임(판매)</span>
                      <span className="font-semibold"><NumberText value={Number(line.base_labor_krw ?? 0)} />원</span>
                    </div>
                  </div>

                  <div className="mt-1 rounded-md bg-[var(--chip)] px-2 py-1.5">
                    <div className="grid grid-cols-[96px_1fr_88px_1fr] gap-x-1 gap-y-1">
                      <span className="text-[var(--muted)]">기타공임(판매)</span>
                      <span className="font-semibold"><NumberText value={etcLaborSell} />원</span>
                      <span className="text-[var(--muted)]">알공임(판매)</span>
                      <span className="font-semibold"><NumberText value={stoneLaborSell} />원</span>
                    </div>
                  </div>

                  <div className="mt-1 rounded-md bg-[var(--chip)] px-2 py-1.5">
                    <div className="mb-1 text-[10px] text-[var(--muted)]">기타공임 내역</div>
                    {etcDetails.length === 0 ? (
                      <div className="text-[var(--muted)]">-</div>
                    ) : (
                      <div className="space-y-1">
                        {etcDetails.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span className="truncate">{item.label}</span>
                            <span className="font-semibold"><NumberText value={item.amount} />원</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </Sheet>
    </MobilePage>
  );
}
