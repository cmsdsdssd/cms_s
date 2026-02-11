"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CreditCard, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlobalPartySelector } from "@/components/party/global-party-selector";
import { TimelineEmpty } from "@/components/timeline/timeline-view";
import { InlineShipmentPanel } from "@/components/shipment/inline-shipment-panel";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { CONTRACTS } from "@/lib/contracts";
import Link from "next/link";
import { PartyInfoCard } from "./_components/party-info-card";
import { WorkbenchOverview } from "./_components/workbench-overview";
import { WorkbenchActivity } from "./_components/workbench-activity";
import { WorkbenchReturnsTab } from "./_components/workbench-returns-tab";
import { WorkbenchRepairsTab } from "./_components/workbench-repairs-tab";

// Types
interface OrderItem {
  order_line_id: string;
  model_name: string;
  model_name_raw?: string;
  suffix?: string;
  color: string;
  size?: string;
  qty: number;
  status: string;
  created_at: string;
  memo?: string;
  is_plated?: boolean;
  plating_color_code?: string;
  customer_party_id?: string;
}

interface ShipmentItem {
  shipment_id: string;
  shipment_line_id?: string;
  order_line_id?: string;
  model_name: string;
  qty: number;
  total_amount_sell_krw: number;
  status: string;
  confirmed_at?: string;
  created_at?: string;
  ship_date?: string;
  purchase_cost_status?: string | null;
  purchase_receipt_id?: string | null;
  repair_line_id?: string | null;
}

interface PaymentItem {
  payment_id: string;
  paid_at: string;
  total_amount_krw: number;
  memo?: string;
}

interface StorePickupShipment {
  shipment_id: string;
  status: string;
  created_at?: string;
  ship_date?: string;
  confirmed_at?: string;
  memo?: string;
  cms_shipment_line?: Array<{
    model_name?: string | null;
    qty?: number | null;
    total_amount_sell_krw?: number | null;
  }> | null;
}

type ViewType =
  | "overview"
  | "activity"
  | "orders"
  | "shipments"
  | "returns"
  | "payments"
  | "repairs"
  | "store_pickup";
type OrderFilterType = "all" | "pending" | "ready" | "completed";

// Loading component
function WorkbenchLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">로딩 중...</span>
      </div>
    </div>
  );
}

const formatOptionalDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "MM/dd HH:mm", { locale: ko });
};

const getKstPrintTimestamp = () => {
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
  }).format(now).replace(" ", "-");
};

// Order Line with Inline Shipment
function OrderLineItem({ order, partyId, onExpand, isExpanded }: { 
  order: OrderItem; 
  partyId: string;
  onExpand: (id: string | null) => void;
  isExpanded: boolean;
}) {
  const statusConfig: Record<string, { label: string; tone: "neutral" | "active" | "danger" | "warning"; color: string }> = {
    ORDER_PENDING: { label: "접수", tone: "neutral", color: "text-blue-600" },
    ORDER_CONFIRMED: { label: "확정", tone: "active", color: "text-green-600" },
    IN_PRODUCTION: { label: "생산중", tone: "warning", color: "text-amber-600" },
    READY_TO_SHIP: { label: "출고대기", tone: "warning", color: "text-orange-600" },
    SHIPPED: { label: "출고완료", tone: "active", color: "text-green-600" },
    CANCELLED: { label: "취소", tone: "danger", color: "text-red-600" },
  };

  const status = statusConfig[order.status] || { label: order.status, tone: "neutral", color: "" };
  const canShip = ["ORDER_CONFIRMED", "IN_PRODUCTION", "READY_TO_SHIP"].includes(order.status);

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200",
      isExpanded ? "border-primary shadow-md" : "border-border hover:border-primary/30"
    )}>
      {/* Order Summary */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onExpand(isExpanded ? null : order.order_line_id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-blue-600">{order.qty}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{order.model_name}</span>
                <Badge tone={status.tone} className="text-xs">
                  {status.label}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {order.color} {order.size && `· ${order.size}`} {order.suffix && `· ${order.suffix}`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(order.created_at), "MM/dd HH:mm", { locale: ko })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canShip && !isExpanded && (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand(order.order_line_id);
                }}
              >
                <PackageCheck className="w-4 h-4 mr-1" />
                출고
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Shipment Panel */}
      {isExpanded && canShip && (
        <div className="border-t border-border">
          <InlineShipmentPanel
            orderLineId={order.order_line_id}
            orderData={{
              modelName: order.model_name,
              color: order.color,
              qty: order.qty,
              customerPartyId: partyId,
              suffix: order.suffix,
              size: order.size,
            }}
            onComplete={() => onExpand(null)}
            onCancel={() => onExpand(null)}
          />
        </div>
      )}
    </div>
  );
}

// Main Workbench Content
function WorkbenchContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const schemaClient = getSchemaClient();
  
  const partyId = params.partyId as string;
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();
  const rawView = searchParams.get("view");
  const normalizedView = rawView === "timeline" ? "activity" : rawView;
  const [activeTab, setActiveTab] = useState<ViewType>((normalizedView as ViewType) || "overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilterType>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedStorePickups, setSelectedStorePickups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!normalizedView) return;
    const nextView = normalizedView as ViewType;
    setActiveTab(nextView);
  }, [normalizedView]);

  const handleTabChange = (next: ViewType) => {
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`/workbench/${partyId}?${params.toString()}`);
  };

  // Fetch orders
  const { data: orders } = useQuery({
    queryKey: ["workbench-orders", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [];
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select("order_line_id, model_name, model_name_raw, suffix, color, size, qty, status, created_at, memo, is_plated, plating_color_code, customer_party_id")
        .eq("customer_party_id", partyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  // Fetch shipments
  const { data: shipments } = useQuery({
    queryKey: ["workbench-shipments", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, status, confirmed_at, created_at, ship_date, cms_shipment_line!inner(shipment_line_id, order_line_id, model_name, qty, total_amount_sell_krw, purchase_cost_status, purchase_receipt_id, repair_line_id)"
        )
        .eq("customer_party_id", partyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Flatten the data
      const flattened: ShipmentItem[] = [];
      data?.forEach((header: any) => {
        header.cms_shipment_line?.forEach((line: any) => {
          flattened.push({
            shipment_id: header.shipment_id,
            shipment_line_id: line.shipment_line_id,
            order_line_id: line.order_line_id,
            model_name: line.model_name,
            qty: line.qty,
            total_amount_sell_krw: line.total_amount_sell_krw,
            status: header.status,
            confirmed_at: header.confirmed_at,
            ship_date: header.ship_date,
            purchase_cost_status: line.purchase_cost_status ?? null,
            purchase_receipt_id: line.purchase_receipt_id ?? null,
            repair_line_id: line.repair_line_id ?? null,
          });
        });
      });
      return flattened;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const { data: storePickupShipments, isLoading: storePickupLoading } = useQuery({
    queryKey: ["workbench-store-pickup", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, status, created_at, ship_date, confirmed_at, memo, cms_shipment_line(model_name, qty, total_amount_sell_krw)")
        .eq("customer_party_id", partyId)
        .eq("is_store_pickup", true)
        .neq("status", "CONFIRMED")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StorePickupShipment[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ["workbench-payments", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [];
      const { data, error } = await schemaClient
        .from("cms_payment_header")
        .select("payment_id, paid_at, total_amount_krw, memo")
        .eq("party_id", partyId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as PaymentItem[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    if (orderFilter === "all") return true;
    if (orderFilter === "pending") return ["ORDER_PENDING", "ORDER_CONFIRMED"].includes(order.status);
    if (orderFilter === "ready") return ["IN_PRODUCTION", "READY_TO_SHIP"].includes(order.status);
    if (orderFilter === "completed") return order.status === "SHIPPED";
    return true;
  });

  // Tab counts
  const tabCounts = {
    orders: orders?.length || 0,
    shipments: shipments?.length || 0,
    payments: payments?.length || 0,
    store_pickup: storePickupShipments?.length || 0,
  };

  const confirmStorePickupMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      return callRpc(CONTRACTS.functions.shipmentConfirmStorePickup, {
        p_shipment_id: shipmentId,
        p_actor_person_id: actorId || null,
        p_note: "confirm store pickup from workbench",
        p_emit_inventory: true,
        p_cost_mode: "PROVISIONAL",
        p_receipt_id: null,
        p_cost_lines: [],
        p_force: false,
      });
    },
    onSuccess: () => {
      toast.success("당일출고 확정 완료");
      queryClient.invalidateQueries({ queryKey: ["workbench-store-pickup", partyId] });
      queryClient.invalidateQueries({ queryKey: ["workbench-shipments", partyId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "확정 실패";
      toast.error("당일출고 확정 실패", { description: message });
    },
  });

  const getStorePickupPrintUrl = () => {
    const dateParam = format(new Date(), "yyyy-MM-dd");
    const printedAt = getKstPrintTimestamp();
    return `/shipments_print?party_id=${encodeURIComponent(
      partyId
    )}&date=${encodeURIComponent(dateParam)}&printed_at=${encodeURIComponent(printedAt)}`;
  };

  const handleConfirmStorePickup = async (shipmentId: string) => {
    await confirmStorePickupMutation.mutateAsync(shipmentId);
    window.open(getStorePickupPrintUrl(), "_blank", "noopener,noreferrer");
  };

  const handleToggleStorePickup = (shipmentId: string) => {
    setSelectedStorePickups((prev) => {
      const next = new Set(prev);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  };

  const handleToggleAllStorePickups = (checked: boolean) => {
    if (!storePickupShipments) return;
    if (checked) {
      setSelectedStorePickups(new Set(storePickupShipments.map((row) => row.shipment_id)));
    } else {
      setSelectedStorePickups(new Set());
    }
  };

  const handleConfirmSelectedStorePickups = async () => {
    const targets = Array.from(selectedStorePickups);
    if (targets.length === 0) return;
    const succeeded: string[] = [];
    const failed: Array<{ shipmentId: string; message: string }> = [];
    for (const shipmentId of targets) {
      try {
        await confirmStorePickupMutation.mutateAsync(shipmentId);
        succeeded.push(shipmentId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "확정 실패";
        failed.push({ shipmentId, message });
      }
    }

    if (failed.length > 0) {
      const first = failed[0];
      toast.error("일부 확정 실패", {
        description: `${succeeded.length}건 완료, ${failed.length}건 실패 · ${first.shipmentId}: ${first.message}`,
      });
    }

    if (succeeded.length > 0) {
      window.open(getStorePickupPrintUrl(), "_blank", "noopener,noreferrer");
    }

    setSelectedStorePickups(new Set(failed.map((row) => row.shipmentId)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <GlobalPartySelector
          currentPartyId={partyId}
          onPartySelect={(party) => {
            if (party.party_id !== partyId) {
              router.push(`/workbench/${party.party_id}`);
            }
          }}
          className="w-full lg:w-auto min-w-[400px]"
        />
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = getStorePickupPrintUrl();
            }}
          >
            <PackageCheck className="w-4 h-4 mr-2" />
            당일영수증
          </Button>
          <Link href={`/orders?party_id=${partyId}`}>
            <Button variant="secondary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              주문추가
            </Button>
          </Link>
          <Link href={`/ar?party_id=${partyId}`}>
            <Button variant="secondary" size="sm">
              <CreditCard className="w-4 h-4 mr-2" />
              수금등록
            </Button>
          </Link>
        </div>
      </div>

      {/* Party Info */}
      <PartyInfoCard partyId={partyId} />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
        {[
          { id: "overview" as const, label: "Overview" },
          { id: "activity" as const, label: "Activity" },
          { id: "orders" as const, label: "주문", count: tabCounts.orders },
          { id: "shipments" as const, label: "출고", count: tabCounts.shipments },
          { id: "returns" as const, label: "반품" },
          { id: "payments" as const, label: "수금", count: tabCounts.payments },
          { id: "repairs" as const, label: "수리" },
          { id: "store_pickup" as const, label: "당일출고", count: tabCounts.store_pickup },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                activeTab === id ? "bg-primary/10 text-primary" : "bg-muted-foreground/20"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && <WorkbenchOverview partyId={partyId} />}

        {activeTab === "activity" && <WorkbenchActivity partyId={partyId} />}

        {activeTab === "orders" && (
          <div className="space-y-4">
            {/* Order Filter */}
            <div className="flex items-center gap-2">
              {[
                { id: "all" as const, label: "전체" },
                { id: "pending" as const, label: "접수/확정" },
                { id: "ready" as const, label: "출고대기" },
                { id: "completed" as const, label: "완료" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setOrderFilter(id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    orderFilter === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Order List */}
            <div className="space-y-3">
              {filteredOrders?.map(order => (
                <OrderLineItem
                  key={order.order_line_id}
                  order={order}
                  partyId={partyId}
                  onExpand={setExpandedOrderId}
                  isExpanded={expandedOrderId === order.order_line_id}
                />
              ))}
              {filteredOrders?.length === 0 && (
                <TimelineEmpty message="해당 조건의 주문이 없습니다" />
              )}
            </div>
          </div>
        )}

        {activeTab === "shipments" && (
          <div className="space-y-3">
            {shipments?.map((shipment, idx) => (
              <Card
                key={`${shipment.shipment_id}-${shipment.shipment_line_id ?? shipment.order_line_id ?? "line"}-${idx}`}
                className="hover:border-primary/30 transition-colors"
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                        <PackageCheck className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold">{shipment.model_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {shipment.qty}개 · {formatOptionalDateTime(shipment.confirmed_at || shipment.ship_date || shipment.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        ₩{shipment.total_amount_sell_krw.toLocaleString()}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={shipment.status === "CONFIRMED" ? "active" : "neutral"} className="text-xs">
                          {shipment.status === "CONFIRMED" ? "확정" : "임시"}
                        </Badge>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {shipment.repair_line_id ? (
                            <Badge tone="primary" className="text-[10px]">
                              수리
                            </Badge>
                          ) : null}
                          <Badge
                            tone={shipment.purchase_cost_status === "ACTUAL" ? "active" : "warning"}
                            className="text-[10px]"
                          >
                            {shipment.purchase_cost_status === "ACTUAL" ? "원가확정" : "원가미확정"}
                          </Badge>
                          {shipment.purchase_receipt_id ? (
                            <Link
                              href={`/purchase_cost_worklist?receipt_id=${encodeURIComponent(
                                shipment.purchase_receipt_id
                              )}`}
                              className="text-[10px] text-[var(--primary)] hover:underline"
                            >
                              영수증
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {shipments?.length === 0 && (
              <TimelineEmpty message="출고 내역이 없습니다" />
            )}
          </div>
        )}

        {activeTab === "store_pickup" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={
                    (storePickupShipments?.length ?? 0) > 0 &&
                    selectedStorePickups.size === (storePickupShipments?.length ?? 0)
                  }
                  onChange={(event) => handleToggleAllStorePickups(event.target.checked)}
                />
                전체 선택
              </label>
              <Button
                size="sm"
                variant="primary"
                onClick={handleConfirmSelectedStorePickups}
                disabled={confirmStorePickupMutation.isPending || selectedStorePickups.size === 0}
              >
                선택 영수증 확정 ({selectedStorePickups.size})
              </Button>
            </div>
            {storePickupShipments?.map((shipment) => {
              const lines = shipment.cms_shipment_line ?? [];
              const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
              const totalAmount = lines.reduce((sum, line) => sum + Number(line.total_amount_sell_krw ?? 0), 0);
              const modelNames = lines
                .map((line) => (line.model_name ?? "-").trim())
                .filter(Boolean)
                .slice(0, 3)
                .join(", ");
              const moreCount = Math.max(lines.length - 3, 0);

              return (
                <Card
                  key={shipment.shipment_id}
                  className="hover:border-primary/30 transition-colors"
                >
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedStorePickups.has(shipment.shipment_id)}
                          onChange={() => handleToggleStorePickup(shipment.shipment_id)}
                        />
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <PackageCheck className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="font-semibold">{modelNames || "모델 없음"}{moreCount > 0 ? ` 외 ${moreCount}건` : ""}</div>
                          <div className="text-sm text-muted-foreground">
                            {totalQty}개 · {formatOptionalDateTime(shipment.created_at)}
                          </div>
                          {shipment.memo && (
                            <div className="text-xs text-muted-foreground">{shipment.memo}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="font-semibold text-lg">
                          ₩{totalAmount.toLocaleString()}
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleConfirmStorePickup(shipment.shipment_id)}
                          disabled={confirmStorePickupMutation.isPending}
                        >
                          영수증 확정
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
            {!storePickupLoading && (storePickupShipments?.length ?? 0) === 0 && (
              <TimelineEmpty message="당일 출고 내역이 없습니다" />
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-3">
            {payments?.map(payment => (
              <Card key={payment.payment_id} className="hover:border-primary/30 transition-colors">
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-semibold">수금</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.paid_at), "MM/dd HH:mm", { locale: ko })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg text-green-600">
                        +₩{payment.total_amount_krw.toLocaleString()}
                      </div>
                      {payment.memo && (
                        <div className="text-xs text-muted-foreground">{payment.memo}</div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {payments?.length === 0 && (
              <TimelineEmpty message="수금 내역이 없습니다" />
            )}
          </div>
        )}
        {activeTab === "returns" && (
          <WorkbenchReturnsTab partyId={partyId} />
        )}

        {activeTab === "repairs" && (
          <WorkbenchRepairsTab partyId={partyId} />
        )}
      </div>
    </div>
  );
}

// Main Page Component
export default function WorkbenchPage() {
  return (
    <div className="mx-auto max-w-[1800px] py-6 px-4 md:px-6">
      <Suspense fallback={<WorkbenchLoading />}>
        <WorkbenchContent />
      </Suspense>
    </div>
  );
}
