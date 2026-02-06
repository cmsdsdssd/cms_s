"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InlineShipmentPanel } from "@/components/shipment/inline-shipment-panel";
import { TimelineEmpty } from "@/components/timeline/timeline-view";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type ArPositionRow = {
  receivable_krw?: number | null;
  credit_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
  last_activity_at?: string | null;
};

type ArBalanceRow = {
  open_invoices_count?: number | null;
};

type OrderRow = {
  order_line_id: string;
  model_name: string;
  suffix?: string | null;
  color: string;
  size?: string | null;
  qty: number;
  status: string;
  created_at: string;
  customer_party_id?: string | null;
};

type StorePickupRow = {
  shipment_id: string;
  status: string;
  created_at?: string | null;
  memo?: string | null;
  cms_shipment_line?: Array<{
    model_name?: string | null;
    qty?: number | null;
    total_amount_sell_krw?: number | null;
  }> | null;
};

type ReturnRow = {
  return_line_id: string;
  occurred_at?: string | null;
  final_return_amount_krw?: number | null;
  reason?: string | null;
  return_qty?: number | null;
  cms_shipment_line?: {
    model_name?: string | null;
    qty?: number | null;
  } | null;
};

type RepairRow = {
  repair_line_id: string;
  received_at?: string | null;
  model_name?: string | null;
  status?: string | null;
  repair_fee_krw?: number | null;
  issue_desc?: string | null;
};

type InvoiceRow = {
  ar_id?: string | null;
  occurred_at?: string | null;
  model_name?: string | null;
  qty?: number | null;
  total_cash_outstanding_krw?: number | null;
};

type PaymentRow = {
  payment_id: string;
  paid_at: string;
  total_amount_krw: number;
  memo?: string | null;
};

type ShipmentRow = {
  shipment_id: string;
  status: string;
  confirmed_at?: string | null;
  created_at?: string | null;
  ship_date?: string | null;
  cms_shipment_line?: Array<{
    shipment_line_id?: string | null;
    model_name?: string | null;
    qty?: number | null;
    total_amount_sell_krw?: number | null;
  }> | null;
};

const toDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (value?: string | null) => {
  const date = toDate(value);
  if (!date) return "-";
  return format(date, "MM/dd", { locale: ko });
};

const formatGram = (value?: number | null) => {
  if (value === null || value === undefined) return "0";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(numeric);
};

const statusBadge = (status?: string | null) => {
  const normalized = (status ?? "").trim();
  const map: Record<string, { label: string; tone: "neutral" | "active" | "warning" | "danger" }> = {
    RECEIVED: { label: "접수", tone: "warning" },
    IN_PROGRESS: { label: "진행", tone: "active" },
    READY_TO_SHIP: { label: "출고대기", tone: "active" },
    SHIPPED: { label: "출고완료", tone: "neutral" },
    CANCELLED: { label: "취소", tone: "danger" },
  };
  return map[normalized] ?? { label: normalized || "-", tone: "neutral" };
};

export function WorkbenchOverview({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<Set<string>>(
    new Set(["order", "shipment", "payment", "return", "repair"])
  );

  const since30 = useMemo(() => {
    const since = new Date(Date.now() - 30 * 86400000);
    return since.toISOString();
  }, []);

  const positionQuery = useQuery({
    queryKey: ["workbench-overview-position", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPositionByParty)
        .select("receivable_krw, credit_krw, gold_outstanding_g, silver_outstanding_g, last_activity_at")
        .eq("party_id", partyId)
        .single();
      if (error) return null;
      return data as ArPositionRow;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const balanceQuery = useQuery({
    queryKey: ["workbench-overview-balance", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arBalanceByParty)
        .select("open_invoices_count")
        .eq("party_id", partyId)
        .single();
      if (error) return null;
      return data as ArBalanceRow;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const readyOrdersQuery = useQuery({
    queryKey: ["workbench-overview-ready-orders", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as OrderRow[];
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select("order_line_id, model_name, suffix, color, size, qty, status, created_at, customer_party_id")
        .eq("customer_party_id", partyId)
        .in("status", ["ORDER_CONFIRMED", "IN_PRODUCTION", "READY_TO_SHIP"])
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const storePickupQuery = useQuery({
    queryKey: ["workbench-overview-store-pickup", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as StorePickupRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, status, created_at, memo, cms_shipment_line(model_name, qty, total_amount_sell_krw)")
        .eq("customer_party_id", partyId)
        .eq("is_store_pickup", true)
        .neq("status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as StorePickupRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const returnsQuery = useQuery({
    queryKey: ["workbench-overview-returns", partyId, since30],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as ReturnRow[];
      const { data, error } = await schemaClient
        .from("cms_return_line")
        .select(
          "return_line_id, occurred_at, final_return_amount_krw, reason, return_qty, cms_shipment_line!inner(model_name, qty, shipment_header:cms_shipment_header(customer_party_id))"
        )
        .eq("cms_shipment_line.shipment_header.customer_party_id", partyId)
        .gte("occurred_at", since30)
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ReturnRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const repairsQuery = useQuery({
    queryKey: ["workbench-overview-repairs", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as RepairRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.repairLineEnriched)
        .select("repair_line_id, received_at, model_name, status, repair_fee_krw, issue_desc")
        .eq("customer_party_id", partyId)
        .in("status", ["IN_PROGRESS", "READY_TO_SHIP"])
        .order("received_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RepairRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const invoicesQuery = useQuery({
    queryKey: ["workbench-overview-invoices", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as InvoiceRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select("ar_id, occurred_at, model_name, qty, total_cash_outstanding_krw")
        .eq("party_id", partyId)
        .gt("total_cash_outstanding_krw", 0)
        .order("total_cash_outstanding_krw", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const paymentsQuery = useQuery({
    queryKey: ["workbench-overview-payments", partyId, since30],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as PaymentRow[];
      const { data, error } = await schemaClient
        .from("cms_payment_header")
        .select("payment_id, paid_at, total_amount_krw, memo")
        .eq("party_id", partyId)
        .gte("paid_at", since30)
        .order("paid_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const ordersRecentQuery = useQuery({
    queryKey: ["workbench-overview-orders-recent", partyId, since30],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as OrderRow[];
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select("order_line_id, model_name, color, qty, created_at, status")
        .eq("customer_party_id", partyId)
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const shipmentsRecentQuery = useQuery({
    queryKey: ["workbench-overview-shipments-recent", partyId, since30],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as ShipmentRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, status, confirmed_at, created_at, ship_date, cms_shipment_line!inner(shipment_line_id, model_name, qty, total_amount_sell_krw)"
        )
        .eq("customer_party_id", partyId)
        .or(`confirmed_at.gte.${since30},created_at.gte.${since30},ship_date.gte.${since30}`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const repairsRecentQuery = useQuery({
    queryKey: ["workbench-overview-repairs-recent", partyId, since30],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as RepairRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.repairLineEnriched)
        .select("repair_line_id, received_at, model_name, status, repair_fee_krw, issue_desc")
        .eq("customer_party_id", partyId)
        .gte("received_at", since30)
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as RepairRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const readyOrders = readyOrdersQuery.data ?? [];
  const storePickups = storePickupQuery.data ?? [];
  const returns = returnsQuery.data ?? [];
  const repairs = repairsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];

  const readyToShipCount = readyOrders.filter((row) => ["IN_PRODUCTION", "READY_TO_SHIP"].includes(row.status)).length;
  const storePickupCount = storePickups.length;
  const returnsCount = returns.length;
  const returnsAmount = returns.reduce((sum, row) => sum + Number(row.final_return_amount_krw ?? 0), 0);
  const repairsCount = repairs.length;

  const recentActivity = useMemo(() => {
    const items: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      date: Date;
      amount?: number;
    }> = [];

    (ordersRecentQuery.data ?? []).forEach((row) => {
      const date = toDate(row.created_at);
      if (!date) return;
      items.push({
        id: row.order_line_id,
        type: "order",
        title: "ORDER",
        subtitle: `${row.model_name} · ${row.qty}개`,
        date,
      });
    });

    (shipmentsRecentQuery.data ?? []).forEach((row) => {
      const date = toDate(row.confirmed_at || row.created_at || row.ship_date);
      if (!date) return;
      (row.cms_shipment_line ?? []).forEach((line) => {
        items.push({
          id: line.shipment_line_id ?? row.shipment_id,
          type: "shipment",
          title: "SHIPMENT",
          subtitle: `${line.model_name ?? "-"} · ${line.qty ?? 0}개`,
          date,
          amount: Number(line.total_amount_sell_krw ?? 0),
        });
      });
    });

    (paymentsQuery.data ?? []).forEach((row) => {
      const date = toDate(row.paid_at);
      if (!date) return;
      items.push({
        id: row.payment_id,
        type: "payment",
        title: "PAYMENT",
        subtitle: row.memo ?? "수금",
        date,
        amount: row.total_amount_krw,
      });
    });

    (returnsQuery.data ?? []).forEach((row) => {
      const date = toDate(row.occurred_at);
      if (!date) return;
      items.push({
        id: row.return_line_id,
        type: "return",
        title: "RETURN",
        subtitle: `${row.cms_shipment_line?.model_name ?? "-"} · ${row.return_qty ?? 0}개`,
        date,
        amount: Number(row.final_return_amount_krw ?? 0),
      });
    });

    (repairsRecentQuery.data ?? []).forEach((row) => {
      const date = toDate(row.received_at);
      if (!date) return;
      items.push({
        id: row.repair_line_id,
        type: "repair",
        title: "REPAIR",
        subtitle: `${row.model_name ?? "-"} · ${row.issue_desc ?? ""}`,
        date,
        amount: Number(row.repair_fee_krw ?? 0),
      });
    });

    return items
      .filter((item) => activityTypes.has(item.type))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 12);
  }, [
    activityTypes,
    ordersRecentQuery.data,
    shipmentsRecentQuery.data,
    paymentsQuery.data,
    returnsQuery.data,
    repairsRecentQuery.data,
  ]);

  const toggleActivityType = (type: string) => {
    setActivityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next.size === 0 ? new Set(["order", "shipment", "payment", "return", "repair"]) : next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href={`/ar?party_id=${partyId}`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">미수 / 선수</div>
              <div className="mt-2 font-semibold">
                ₩{Number(positionQuery.data?.receivable_krw ?? 0).toLocaleString()} / ₩
                {Number(positionQuery.data?.credit_krw ?? 0).toLocaleString()}
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href={`/ar?party_id=${partyId}`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">현물 미수</div>
              <div className="mt-2 font-semibold">
                금 {formatGram(positionQuery.data?.gold_outstanding_g)}g · 은 {formatGram(positionQuery.data?.silver_outstanding_g)}g
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href={`/ar?party_id=${partyId}`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">오픈 미수건</div>
              <div className="mt-2 font-semibold">{balanceQuery.data?.open_invoices_count ?? 0}건</div>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody className="p-4">
            <div className="text-xs text-muted-foreground">마지막 활동</div>
            <div className="mt-2 font-semibold">{formatDate(positionQuery.data?.last_activity_at)}</div>
          </CardBody>
        </Card>
        <Link href={`/workbench/${partyId}?view=orders`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">출고대기 주문</div>
              <div className="mt-2 font-semibold">{readyToShipCount}건</div>
            </CardBody>
          </Card>
        </Link>
        <Link href={`/workbench/${partyId}?view=store_pickup`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">당일출고 대기</div>
              <div className="mt-2 font-semibold">{storePickupCount}건</div>
            </CardBody>
          </Card>
        </Link>
        <Link href={`/workbench/${partyId}?view=returns`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">반품 (30일)</div>
              <div className="mt-2 font-semibold">
                {returnsCount}건 · ₩{returnsAmount.toLocaleString()}
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href={`/workbench/${partyId}?view=repairs`} className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardBody className="p-4">
              <div className="text-xs text-muted-foreground">수리 진행</div>
              <div className="mt-2 font-semibold">{repairsCount}건</div>
            </CardBody>
          </Card>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">출고대기 주문</div>
            <Link href={`/workbench/${partyId}?view=orders`} className="text-xs text-primary hover:underline">
              더보기
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {readyOrders.length === 0 ? (
              <TimelineEmpty message="출고대기 주문이 없습니다" />
            ) : (
              readyOrders.map((order) => {
                const isExpanded = expandedOrderId === order.order_line_id;
                return (
                  <div key={order.order_line_id} className="rounded-lg border border-border/60">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.order_line_id)}
                    >
                      <div>
                        <div className="font-medium">{order.model_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.color} · {order.qty}개 · {formatDate(order.created_at)}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary">
                        <PackageCheck className="w-4 h-4 mr-1" />
                        출고
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border/60">
                        <InlineShipmentPanel
                          orderLineId={order.order_line_id}
                          orderData={{
                            modelName: order.model_name,
                            color: order.color,
                            qty: order.qty,
                            customerPartyId: partyId,
                            suffix: order.suffix ?? undefined,
                            size: order.size ?? undefined,
                          }}
                          onComplete={() => setExpandedOrderId(null)}
                          onCancel={() => setExpandedOrderId(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">미수 회수 필요</div>
            <div className="flex items-center gap-2">
              <Link href={`/ar?party_id=${partyId}`} className="text-xs text-primary hover:underline">
                AR 보기
              </Link>
              <Link href={`/ar?party_id=${partyId}`} className="text-xs text-primary hover:underline">
                수금등록
              </Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {invoices.length === 0 ? (
              <TimelineEmpty message="오픈 미수 내역이 없습니다" />
            ) : (
              invoices.map((row) => (
                <div key={row.ar_id ?? row.model_name} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{row.model_name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.qty ?? 0}개 · {formatDate(row.occurred_at)}
                    </div>
                  </div>
                  <div className="font-semibold">
                    ₩{Number(row.total_cash_outstanding_krw ?? 0).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">당일출고 확정 대기</div>
            <Link href={`/workbench/${partyId}?view=store_pickup`} className="text-xs text-primary hover:underline">
              확정하러 가기
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {storePickups.length === 0 ? (
              <TimelineEmpty message="당일출고 대기 건이 없습니다" />
            ) : (
              storePickups.map((shipment) => {
                const lines = shipment.cms_shipment_line ?? [];
                const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
                const totalAmount = lines.reduce((sum, line) => sum + Number(line.total_amount_sell_krw ?? 0), 0);
                const modelNames = lines
                  .map((line) => (line.model_name ?? "-").trim())
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(", ");
                return (
                  <div key={shipment.shipment_id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{modelNames || "모델 없음"}</div>
                      <div className="text-xs text-muted-foreground">
                        {totalQty}개 · {formatDate(shipment.created_at)}
                      </div>
                    </div>
                    <div className="font-semibold">₩{totalAmount.toLocaleString()}</div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">최근 반품 (30일)</div>
            <Link href={`/workbench/${partyId}?view=returns`} className="text-xs text-primary hover:underline">
              더보기
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {returns.length === 0 ? (
              <TimelineEmpty message="최근 반품이 없습니다" />
            ) : (
              returns.map((row) => (
                <div key={row.return_line_id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{row.cms_shipment_line?.model_name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.return_qty ?? 0}개 · {row.reason ?? "-"}
                    </div>
                  </div>
                  <div className="font-semibold">₩{Number(row.final_return_amount_krw ?? 0).toLocaleString()}</div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">수리 진행</div>
            <Link href={`/workbench/${partyId}?view=repairs`} className="text-xs text-primary hover:underline">
              더보기
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {repairs.length === 0 ? (
              <TimelineEmpty message="진행 중인 수리가 없습니다" />
            ) : (
              repairs.map((row) => {
                const badge = statusBadge(row.status);
                return (
                  <div key={row.repair_line_id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{row.model_name ?? "-"}</div>
                        <Badge tone={badge.tone} className="text-[10px]">
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{row.issue_desc ?? ""}</div>
                    </div>
                    <div className="font-semibold">₩{Number(row.repair_fee_krw ?? 0).toLocaleString()}</div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">최근 활동 (30일)</div>
            <Link href={`/workbench/${partyId}?view=activity`} className="text-xs text-primary hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { type: "order", label: "ORDER" },
              { type: "shipment", label: "SHIPMENT" },
              { type: "payment", label: "PAYMENT" },
              { type: "return", label: "RETURN" },
              { type: "repair", label: "REPAIR" },
            ] as const).map((item) => (
              <button
                key={item.type}
                onClick={() => toggleActivityType(item.type)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold tracking-wide",
                  activityTypes.has(item.type)
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {recentActivity.length === 0 ? (
            <TimelineEmpty message="최근 활동이 없습니다" />
          ) : (
            recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {item.title}
                  </span>
                  <div>
                    <div className="font-medium">{item.subtitle}</div>
                    <div className="text-xs text-muted-foreground">{format(item.date, "MM/dd HH:mm", { locale: ko })}</div>
                  </div>
                </div>
                {item.amount !== undefined && item.amount > 0 ? (
                  <div className="font-semibold">₩{item.amount.toLocaleString()}</div>
                ) : null}
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
