"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  CreditCard, 
  PackageCheck,
  TrendingUp,
  TrendingDown,
  Building2,
  Phone,
  MapPin,
  Calendar,
  MoreHorizontal,
  RefreshCw,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { GlobalPartySelector } from "@/components/party/global-party-selector";
import { TimelineView, TimelineItem, TimelineFilter, TimelineEmpty } from "@/components/timeline/timeline-view";
import { InlineShipmentPanel } from "@/components/shipment/inline-shipment-panel";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { CONTRACTS } from "@/lib/contracts";
import Link from "next/link";

// Types
interface PartyDetail {
  party_id: string;
  name: string;
  party_type?: string;
  phone?: string;
  region?: string;
  note?: string;
}

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
  ship_date?: string;
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

interface ARItem {
  ar_ledger_id: string;
  entry_type: string;
  amount_krw: number;
  occurred_at: string;
  shipment_id?: string;
  payment_id?: string;
}

type ViewType = "timeline" | "orders" | "shipments" | "payments" | "store_pickup";
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

// Party Info Card
function PartyInfoCard({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();
  
  const { data: party } = useQuery({
    queryKey: ["party-detail", partyId],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, phone, region, note")
        .eq("party_id", partyId)
        .single();
      if (error) throw error;
      return data as PartyDetail;
    },
    enabled: !!schemaClient && !!partyId,
  });

  const { data: balance } = useQuery({
    queryKey: ["party-balance", partyId],
    queryFn: async () => {
      if (!schemaClient) return null;
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arBalanceByParty)
        .select("balance_krw, last_shipment_at, last_payment_at, open_invoices_count")
        .eq("party_id", partyId)
        .single();
      if (error) return null;
      return data as { 
        balance_krw: number; 
        last_shipment_at?: string; 
        last_payment_at?: string;
        open_invoices_count?: number;
      };
    },
    enabled: !!schemaClient && !!partyId,
  });

  if (!party) return null;

  const balanceAmount = balance?.balance_krw || 0;
  const hasReceivable = balanceAmount > 0;
  const hasPrepayment = balanceAmount < 0;

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{party.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {party.party_type && (
                  <Badge tone="neutral" className="text-xs">
                    {party.party_type}
                  </Badge>
                )}
                {party.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {party.phone}
                  </span>
                )}
                {party.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {party.region}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Balance Display */}
          <div className={cn(
            "text-right px-4 py-2 rounded-lg",
            hasReceivable ? "bg-orange-50" : hasPrepayment ? "bg-blue-50" : "bg-green-50"
          )}>
            <div className={cn(
              "text-2xl font-bold",
              hasReceivable ? "text-orange-600" : hasPrepayment ? "text-blue-600" : "text-green-600"
            )}>
              ₩{Math.abs(balanceAmount).toLocaleString()}
            </div>
            <div className={cn(
              "text-xs font-medium",
              hasReceivable ? "text-orange-500" : hasPrepayment ? "text-blue-500" : "text-green-500"
            )}>
              {hasReceivable ? "미수금" : hasPrepayment ? "선수금" : "정산완료"}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardBody>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">미수건수</div>
            <div className="font-semibold">{balance?.open_invoices_count || 0}건</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">최근출고</div>
            <div className="font-semibold">
              {balance?.last_shipment_at 
                ? format(new Date(balance.last_shipment_at), "MM/dd", { locale: ko })
                : "-"}
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-muted-foreground text-xs mb-1">최근수금</div>
            <div className="font-semibold">
              {balance?.last_payment_at 
                ? format(new Date(balance.last_payment_at), "MM/dd", { locale: ko })
                : "-"}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

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
  const [activeTab, setActiveTab] = useState<ViewType>((searchParams.get("view") as ViewType) || "timeline");
  const [orderFilter, setOrderFilter] = useState<OrderFilterType>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedStorePickups, setSelectedStorePickups] = useState<Set<string>>(new Set());

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
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
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ["workbench-shipments", partyId],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, status, confirmed_at, ship_date, cms_shipment_line!inner(order_line_id, model_name, qty, total_amount_sell_krw)")
        .eq("customer_party_id", partyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Flatten the data
      const flattened: ShipmentItem[] = [];
      data?.forEach((header: any) => {
        header.cms_shipment_line?.forEach((line: any) => {
          flattened.push({
            shipment_id: header.shipment_id,
            shipment_line_id: line.order_line_id,
            order_line_id: line.order_line_id,
            model_name: line.model_name,
            qty: line.qty,
            total_amount_sell_krw: line.total_amount_sell_krw,
            status: header.status,
            confirmed_at: header.confirmed_at,
            ship_date: header.ship_date,
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
  const { data: payments, isLoading: paymentsLoading } = useQuery({
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

  // Convert to timeline items
  const timelineItems: TimelineItem[] = [
    ...(orders?.map(order => ({
      id: order.order_line_id,
      type: "order" as const,
      status: order.status === "CANCELLED" ? "cancelled" as const : 
              order.status === "SHIPPED" ? "completed" as const : "pending" as const,
      title: `주문 ${order.model_name}`,
      subtitle: `${order.color} · ${order.qty}개`,
      date: new Date(order.created_at),
      qty: order.qty,
      modelName: order.model_name,
      color: order.color,
      expanded: expandedOrderId === order.order_line_id,
      actions: order.status !== "CANCELLED" && order.status !== "SHIPPED" ? [
        {
          label: "출고하기",
          onClick: () => setExpandedOrderId(order.order_line_id),
          variant: "default" as const,
        },
        {
          label: "상세보기",
          onClick: () => router.push(`/orders?edit_order_line_id=${order.order_line_id}`),
          variant: "outline" as const,
        },
      ] : [],
    })) || []),
    ...(shipments?.map(shipment => ({
      id: shipment.shipment_id,
      type: "shipment" as const,
      status: shipment.status === "CONFIRMED" ? "completed" as const : "pending" as const,
      title: `출고 ${shipment.model_name}`,
      subtitle: `${shipment.qty}개 · ₩${shipment.total_amount_sell_krw.toLocaleString()}`,
      date: new Date(shipment.confirmed_at || shipment.ship_date || new Date()),
      amount: shipment.total_amount_sell_krw,
      qty: shipment.qty,
      modelName: shipment.model_name,
      actions: [
        {
          label: "수금등록",
          onClick: () => router.push(`/ar?party_id=${partyId}`),
          variant: "default" as const,
        },
      ],
    })) || []),
    ...(payments?.map(payment => ({
      id: payment.payment_id,
      type: "payment" as const,
      status: "completed" as const,
      title: "수금",
      subtitle: payment.memo || "",
      date: new Date(payment.paid_at),
      amount: payment.total_amount_krw,
    })) || []),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

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
    timeline: timelineItems.length,
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

  const handleConfirmStorePickup = async (shipmentId: string) => {
    await confirmStorePickupMutation.mutateAsync(shipmentId);
    const url = `/shipments_print?mode=store_pickup&party_id=${encodeURIComponent(partyId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
    for (const shipmentId of targets) {
      await confirmStorePickupMutation.mutateAsync(shipmentId);
    }
    setSelectedStorePickups(new Set());
    const url = `/shipments_print?mode=store_pickup&party_id=${encodeURIComponent(partyId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
          { id: "timeline" as const, label: "전체 타임라인", count: tabCounts.timeline },
          { id: "orders" as const, label: "주문", count: tabCounts.orders },
          { id: "shipments" as const, label: "출고", count: tabCounts.shipments },
          { id: "store_pickup" as const, label: "당일출고", count: tabCounts.store_pickup },
          { id: "payments" as const, label: "수금", count: tabCounts.payments },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {count > 0 && (
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
        {activeTab === "timeline" && (
          <div>
            {timelineItems.length > 0 ? (
              <TimelineView 
                items={timelineItems}
                groupByDate={true}
                onItemExpand={(id) => setExpandedOrderId(id)}
                onItemCollapse={() => setExpandedOrderId(null)}
              />
            ) : (
              <TimelineEmpty message="해당 거래처의 업무 내역이 없습니다" />
            )}
          </div>
        )}

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
                          {shipment.qty}개 · {format(new Date(shipment.confirmed_at || new Date()), "MM/dd HH:mm", { locale: ko })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        ₩{shipment.total_amount_sell_krw.toLocaleString()}
                      </div>
                      <Badge tone={shipment.status === "CONFIRMED" ? "active" : "neutral"} className="text-xs">
                        {shipment.status === "CONFIRMED" ? "확정" : "임시"}
                      </Badge>
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
                            {totalQty}개 · {format(new Date(shipment.created_at ?? new Date()), "MM/dd HH:mm", { locale: ko })}
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
      </div>
    </div>
  );
}

// Main Page Component
export default function WorkbenchPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <Suspense fallback={<WorkbenchLoading />}>
        <WorkbenchContent />
      </Suspense>
    </div>
  );
}
