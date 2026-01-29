"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { readView } from "@/lib/supabase/read";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ShipReadyRow = {
  shipment_id?: string;
  shipment_header_id?: string;
  customer_name?: string;
  line_count?: number;
  status?: string;
  ship_date?: string;
  created_at?: string;
};

type OrderLookupRow = {
  order_id?: string;
  order_line_id?: string;
  order_no?: string;
  order_date?: string;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  color?: string;
  status?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
};

type ShipmentPrefill = {
  order_line_id?: string;
  order_id?: string;
  order_no?: string;
  order_date?: string;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  color?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
  category?: string | null;
  size?: string | null;
  note?: string | null;
  photo_url?: string | null;
};

type MasterSummary = {
  model_name?: string | null;
  image_url?: string | null;
  vendor_name?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  symbol?: string | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  labor_basic?: number | null;
  labor_center?: number | null;
  labor_side1?: number | null;
  labor_side2?: number | null;
  labor_base_cost?: number | null;
  labor_center_cost?: number | null;
  labor_sub1_cost?: number | null;
  labor_sub2_cost?: number | null;
};

type ShipmentHistoryRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  order_line_id?: string | null;
  ship_date?: string | null;
  shipment_status?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  qty?: number | null;
  is_plated?: boolean | null;
  plating_variant_id?: string | null;
  manual_total_amount_krw?: number | null;
  created_at?: string | null;
};

type ShipmentLineSummary = {
  shipment_id?: string;
  model_name?: string | null;
  color?: string | null;
  measured_weight_g?: number | null;
  manual_labor_krw?: number | null;
};

const debounceMs = 250;

export default function ShipmentsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [weightG, setWeightG] = useState("");
  const [totalLabor, setTotalLabor] = useState("");
  const [prefill, setPrefill] = useState<ShipmentPrefill | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [orderLookupCache, setOrderLookupCache] = useState<Record<string, OrderLookupRow[]>>({});
  const [masterInfo, setMasterInfo] = useState<MasterSummary | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const actorId = process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? "";
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())),
    []
  );

  const readyQuery = useQuery({
    queryKey: ["cms", "shipment_header"],
    queryFn: () => readView<ShipReadyRow>("cms_shipment_header", 50),
  });

  const lineSummaryQuery = useQuery({
    queryKey: ["cms", "shipment_line", "summary"],
    queryFn: () =>
      readView<ShipmentLineSummary>(
        "cms_shipment_line",
        200,
        undefined,
        undefined
      ),
  });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery.trim()), debounceMs);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const lookupQuery = useQuery({
    queryKey: ["order-lookup", debouncedQuery],
    queryFn: async () => {
      if (orderLookupCache[debouncedQuery]) return orderLookupCache[debouncedQuery];
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("limit", "20");
      const res = await fetch(`/api/order-lookup?${params.toString()}`);
      const json = (await res.json()) as { data?: OrderLookupRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "조회 실패");
      const rows = json.data ?? [];
      setOrderLookupCache((prev) => ({ ...prev, [debouncedQuery]: rows }));
      return rows;
    },
    enabled: searchOpen,
  });

  const lookupRows = useMemo(() => {
    const rows = lookupQuery.data ?? [];
    return rows.filter((row) => {
      const status = String(row.status ?? "").toUpperCase();
      return status !== "SHIPPED" && status !== "CLOSED" && status !== "CANCELLED";
    });
  }, [lookupQuery.data]);

  const masterQuery = useQuery({
    queryKey: ["cms", "master_summary", prefill?.model_no],
    queryFn: async () => {
      if (!prefill?.model_no) return null;
      const res = await fetch(`/api/master-items?model=${encodeURIComponent(prefill.model_no)}`);
      const json = (await res.json()) as { data?: MasterSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "마스터 조회 실패");
      return (json.data ?? [])[0] ?? null;
    },
    enabled: Boolean(prefill?.model_no),
  });

  const historyQuery = useQuery({
    queryKey: ["cms", "shipment_history", prefill?.model_no],
    queryFn: () => {
      if (!prefill?.model_no) return [] as ShipmentHistoryRow[];
      return readView<ShipmentHistoryRow>(
        "v_cms_shipment_history_by_model",
        50,
        "model_name",
        prefill.model_no
      );
    },
    enabled: Boolean(prefill?.model_no),
  });

  useEffect(() => {
    if (masterQuery.data) {
      setMasterInfo(masterQuery.data as MasterSummary);
    } else {
      setMasterInfo(null);
    }
  }, [masterQuery.data]);

  const shipments = (readyQuery.data ?? []).map((row, index) => ({
    title: row.shipment_id ? String(row.shipment_id).slice(0, 10) : `S-${index + 1}`,
    subtitle: `${row.customer_name ?? "-"} · ${row.line_count ?? 0}라인`,
    meta: row.ship_date ?? row.created_at ?? "-",
    badge: { label: row.status ?? "DRAFT", tone: "warning" as const },
  }));

  const handleSelectOrder = async (row: OrderLookupRow) => {
    if (!row.order_line_id) return;
    setSelectedOrderLineId(row.order_line_id);
    setSearchOpen(false);
    setWeightG("");
    setTotalLabor("");
    const res = await fetch(`/api/shipment-prefill?order_line_id=${row.order_line_id}`);
    const json = (await res.json()) as { data?: ShipmentPrefill; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "프리필 조회 실패");
    }
    setPrefill(json.data ?? null);
  };

  const upsertFn = CONTRACTS.functions.shipmentUpsertFromOrder;
  const confirmFn = CONTRACTS.functions.shipmentConfirm;

  const saveMutation = useRpcMutation<{ shipment_id: string; shipment_line_id: string }>({
    fn: upsertFn,
  });

  const confirmMutation = useRpcMutation<{ ok: boolean }>({
    fn: confirmFn,
    successMessage: "출고 확정 완료",
  });

  const canConfirm =
    Boolean(selectedOrderLineId) &&
    Boolean(actorId) &&
    Boolean(weightG) &&
    Boolean(totalLabor) &&
    isFnConfigured(upsertFn) &&
    isFnConfigured(confirmFn);

  const handleConfirm = async () => {
    if (!selectedOrderLineId) return;
    const weightValue = Number(weightG);
    const laborValue = Number(totalLabor);
    if (Number.isNaN(weightValue) || weightValue <= 0) return;
    if (Number.isNaN(laborValue) || laborValue <= 0) return;
    if (!actorId) return;

    setConfirming(true);
    try {
      const saved = await saveMutation.mutateAsync({
        p_order_line_id: selectedOrderLineId,
        p_weight_g: weightValue,
        p_total_labor: laborValue,
        p_actor_person_id: actorId,
        p_idempotency_key: idempotencyKey,
      });
      const shipmentId = saved?.shipment_id;
      if (!shipmentId) return;
      await confirmMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_actor_person_id: actorId,
        p_note: "confirm from order lookup",
      });
      readyQuery.refetch();
      lineSummaryQuery.refetch();
      historyQuery.refetch();
      setSelectedOrderLineId(null);
      setPrefill(null);
      setWeightG("");
      setTotalLabor("");
      setSearchQuery("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("출고 확정 실패", { description: message });
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current || !inputRef.current) return;
      if (popoverRef.current.contains(event.target as Node)) return;
      if (inputRef.current.contains(event.target as Node)) return;
      setSearchOpen(false);
    };
    if (searchOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  return (
    <div className="space-y-6" id="shipments.root">
      <ActionBar
        title="출고"
        subtitle="출고 문서 관리"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/shipments_main">
              <Button variant="secondary">출고 조회</Button>
            </Link>
            <Button disabled={!canConfirm || confirming} onClick={handleConfirm}>
              출고 확정
            </Button>
          </div>
        }
        id="shipments.actionBar"
      />
      <FilterBar id="shipments.filterBar">
        <div className="relative w-full">
          <Input
            ref={inputRef}
            placeholder="출고검색"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchOpen ? (
            <div
              ref={popoverRef}
              className="absolute left-0 right-0 mt-2 rounded-[12px] border border-[var(--panel-border)] bg-white shadow-lg z-20"
            >
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#f8f9fc]">
                    <tr>
                      <th className="px-3 py-2">ORDER NO</th>
                      <th className="px-3 py-2">DATE</th>
                      <th className="px-3 py-2">CUSTOMER</th>
                      <th className="px-3 py-2">MODEL</th>
                      <th className="px-3 py-2">COLOR</th>
                      <th className="px-3 py-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {lookupRows.map((row) => (
                      <tr
                        key={row.order_line_id}
                        className="cursor-pointer hover:bg-blue-50/40"
                        onClick={() => handleSelectOrder(row)}
                      >
                        <td className="px-3 py-2">{row.order_no ?? "-"}</td>
                        <td className="px-3 py-2">{row.order_date ?? "-"}</td>
                        <td className="px-3 py-2">{row.client_name ?? "-"}</td>
                        <td className="px-3 py-2">{row.model_no ?? "-"}</td>
                        <td className="px-3 py-2">{row.color ?? "-"}</td>
                        <td className="px-3 py-2">
                          <Badge tone={row.status === "READY" ? "active" : "neutral"}>
                            {row.status ?? "READY"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {lookupQuery.isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-[var(--muted)]">
                          조회 중...
                        </td>
                      </tr>
                    ) : null}
                    {!lookupQuery.isLoading && lookupRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-[var(--muted)]">
                          검색 결과 없음
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </FilterBar>
      <div id="shipments.body">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_7fr]">
          <div className="space-y-3" id="shipments.listPanel">
            <Card id="shipments.masterCard">
              <CardHeader>
                <ActionBar title="마스터 정보" subtitle={prefill?.model_no ?? "모델 선택"} />
              </CardHeader>
              <CardBody className="grid gap-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
                  <div className="aspect-square rounded-[12px] border border-dashed border-[var(--panel-border)] flex items-center justify-center w-full max-w-[194px] overflow-hidden">
                    {masterInfo?.image_url ? (
                      <img
                        src={masterInfo.image_url}
                        alt={masterInfo.model_name ?? "master"}
                        className="w-full h-full object-cover rounded-[10px]"
                      />
                    ) : (
                      <span className="text-xs text-[var(--muted)]">이미지 없음</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <label className="text-[var(--muted)]">CREATED AT</label>
                      <div className="mt-1 text-sm">{masterInfo?.created_at ?? "-"}</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">UPDATED AT</label>
                      <div className="mt-1 text-sm">{masterInfo?.updated_at ?? "-"}</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">MODEL NAME</label>
                      <div className="mt-1 text-sm">{masterInfo?.model_name ?? "-"}</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">MATERIAL</label>
                      <div className="mt-1 text-sm">{masterInfo?.material_code_default ?? "-"}</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">CATEGORY</label>
                      <div className="mt-1 text-sm">{masterInfo?.symbol ?? masterInfo?.category_code ?? "-"}</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">COLOR</label>
                      <div className="mt-1 text-sm">{masterInfo?.color ?? "-"}</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">공급처</span>
                      <span>{masterInfo?.vendor_name ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">예상중량</span>
                      <span>
                        {masterInfo?.weight_default_g !== undefined && masterInfo?.deduction_weight_default_g !== undefined
                          ? Number(masterInfo.weight_default_g) - Number(masterInfo.deduction_weight_default_g)
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">기본중량</span>
                      <span>{masterInfo?.weight_default_g ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">차감중량</span>
                      <span>{masterInfo?.deduction_weight_default_g ?? "-"}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] items-center gap-2 text-[var(--muted)]">
                    <span className="">항목</span>
                    <span className="text-right">구매</span>
                    <span className="text-center">수량</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">판매</span>
                  </div>
                  <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] items-center gap-2">
                    <span className="text-[var(--muted)]">기본공임</span>
                    <span className="text-right text-[var(--muted)]">{masterInfo?.labor_base_cost ?? "-"}</span>
                    <span className="text-center">-</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">{masterInfo?.labor_basic ?? "-"}</span>
                  </div>
                  <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] items-center gap-2">
                    <span className="text-[var(--muted)]">센터공임</span>
                    <span className="text-right text-[var(--muted)]">{masterInfo?.labor_center_cost ?? "-"}</span>
                    <span className="text-center">{masterInfo?.center_qty_default ?? "-"}</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">{masterInfo?.labor_center ?? "-"}</span>
                  </div>
                  <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] items-center gap-2">
                    <span className="text-[var(--muted)]">보조1공임</span>
                    <span className="text-right text-[var(--muted)]">{masterInfo?.labor_sub1_cost ?? "-"}</span>
                    <span className="text-center">{masterInfo?.sub1_qty_default ?? "-"}</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">{masterInfo?.labor_side1 ?? "-"}</span>
                  </div>
                  <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] items-center gap-2">
                    <span className="text-[var(--muted)]">보조2공임</span>
                    <span className="text-right text-[var(--muted)]">{masterInfo?.labor_sub2_cost ?? "-"}</span>
                    <span className="text-center">{masterInfo?.sub2_qty_default ?? "-"}</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">{masterInfo?.labor_side2 ?? "-"}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card id="shipments.confirmed">
              <CardHeader>
                <ActionBar title="출고 완료" subtitle="최근 확정" />
              </CardHeader>
              <CardBody className="space-y-2 text-xs">
                {(readyQuery.data ?? [])
                  .filter((row) => row.status === "CONFIRMED")
                  .slice(0, 8)
                  .map((row) => {
                    const line = (lineSummaryQuery.data ?? []).find(
                      (item) => item.shipment_id === row.shipment_id
                    );
                    return (
                      <div
                        key={row.shipment_id}
                        className="rounded-[12px] border border-[var(--panel-border)] px-3 py-2"
                      >
                        <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1.4fr]">
                          <div className="font-semibold text-[var(--foreground)]">
                            {row.ship_date ?? row.created_at ?? "-"}
                          </div>
                          <div className="font-semibold text-[var(--foreground)]">
                            {row.customer_name ?? "-"}
                          </div>
                          <div className="font-semibold text-[var(--foreground)]">
                            {line?.model_name ?? "-"}
                          </div>
                          <div className="text-[var(--muted)]">{line?.color ?? "-"}</div>
                          <div className="text-[var(--muted)]">{line?.measured_weight_g ?? "-"}</div>
                          <div className="text-[var(--muted)]">
                            {line?.manual_labor_krw ?? "-"}
                          </div>
                          <div className="text-[var(--muted)]">{row.created_at ?? "-"}</div>
                        </div>
                      </div>
                    );
                  })}
                {(readyQuery.data ?? []).filter((row) => row.status === "CONFIRMED").length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">출고 완료 내역 없음</p>
                ) : null}
              </CardBody>
            </Card>
          </div>
          <div className="space-y-4" id="shipments.detailPanel">
            {!selectedOrderLineId ? (
              <Card id="shipments.detail.header">
                <CardHeader>
                  <ActionBar title="출고 헤더" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <Input placeholder="거래처" disabled />
                  <Input placeholder="출고일" type="date" disabled />
                  <Input placeholder="배송지" disabled />
                  <Input placeholder="메모" disabled />
                </CardBody>
              </Card>
            ) : (
              <Card id="shipments.detail.form">
                <CardHeader className="flex items-center justify-between">
                  <ActionBar title="출고입력 상세" />
                  <Button variant="secondary" onClick={() => setSelectedOrderLineId(null)}>
                    선택 해제
                  </Button>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                    <div className="aspect-square rounded-[12px] border border-dashed border-[var(--panel-border)] flex items-center justify-center w-full max-w-[220px] overflow-hidden">
                      {prefill?.photo_url ? (
                        <img src={prefill.photo_url} alt="preview" className="w-full h-full object-cover rounded-[10px]" />
                      ) : (
                        <span className="text-xs text-[var(--muted)]">이미지 없음</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[var(--muted)]">ORDER DATE</label>
                        <div className="mt-1 text-sm">{prefill?.order_date ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">CUSTOMER</label>
                        <div className="mt-1 text-sm">{prefill?.client_name ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">MODEL NAME</label>
                        <div className="mt-1 text-sm">{prefill?.model_no ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">COLOR</label>
                        <div className="mt-1 text-sm">{prefill?.color ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">PLATING STATUS</label>
                        <div className="mt-1 text-sm">{prefill?.plating_status ? "YES" : "NO"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">PLATING COLOR</label>
                        <div className="mt-1 text-sm">{prefill?.plating_color ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">CATEGORY</label>
                        <div className="mt-1 text-sm">{prefill?.category ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">SIZE</label>
                        <div className="mt-1 text-sm">{prefill?.size ?? "-"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[var(--muted)]">NOTE</label>
                        <div className="mt-1 text-sm">{prefill?.note ?? "-"}</div>
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">WEIGHT (G)</label>
                        <Input value={weightG} onChange={(event) => setWeightG(event.target.value)} />
                      </div>
                      <div>
                        <label className="text-[var(--muted)]">TOTAL LABOR</label>
                        <Input value={totalLabor} onChange={(event) => setTotalLabor(event.target.value)} />
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
            <Card id="shipments.history">
              <CardHeader>
                <ActionBar title="이전 출고 내역" subtitle="모델 기준" />
              </CardHeader>
              <CardBody className="space-y-2 text-xs">
                {(historyQuery.data ?? [])
                  .filter((row) => {
                    if (!prefill?.model_no) return false;
                    return (row.model_name ?? "").toLowerCase() === prefill.model_no.toLowerCase();
                  })
                  .sort((a, b) => {
                    const dateA = a.ship_date ?? a.created_at ?? "";
                    const dateB = b.ship_date ?? b.created_at ?? "";
                    return dateA < dateB ? 1 : -1;
                  })
                  .map((row) => (
                    <div
                      key={row.shipment_line_id}
                      className="rounded-[12px] border border-[var(--panel-border)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {row.model_name ?? "-"} {row.suffix ?? ""}
                        </span>
                        <span className="text-[var(--muted)]">{row.ship_date ?? row.created_at ?? "-"}</span>
                      </div>
                      <div className="mt-1 text-[var(--muted)]">
                        색상 {row.color ?? "-"} · 수량 {row.qty ?? 0} · 상태 {row.shipment_status ?? "-"}
                      </div>
                    </div>
                  ))}
                {(historyQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">이전 출고 내역 없음</p>
                ) : null}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
