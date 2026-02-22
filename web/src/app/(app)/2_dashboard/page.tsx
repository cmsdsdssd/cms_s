"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  ClipboardList,
  PackageCheck,
  CreditCard,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Save,
  Send,
  X,
  Building2,
  Package,
  Scale,
  Hammer,
  Banknote,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionBar } from "@/components/layout/action-bar";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES (기존 시스템과 호환)
// ============================================================================

type PartyRow = {
  party_id: string;
  party_type: "customer" | "vendor";
  name: string;
  phone: string | null;
  balance_krw?: number | null;
  receivable_krw?: number | null;
  credit_krw?: number | null;
  last_activity_at?: string | null;
};

type OrderLine = {
  order_line_id: string;
  customer_party_id: string;
  model_name: string | null;
  suffix: string | null;
  color: string | null;
  size: string | null;
  qty: number | null;
  status: string;
  center_stone_name: string | null;
  center_stone_qty: number | null;
  sub1_stone_name: string | null;
  sub1_stone_qty: number | null;
  sub2_stone_name: string | null;
  sub2_stone_qty: number | null;
  is_plated: boolean | null;
  plating_color_code: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type ShipmentLine = {
  shipment_line_id: string;
  shipment_id: string;
  order_line_id: string | null;
  model_name: string | null;
  qty: number | null;
  measured_weight_g: number | null;
  deduction_weight_g: number | null;
  labor_total_sell_krw: number | null;
  material_amount_sell_krw: number | null;
  total_amount_sell_krw: number | null;
  created_at: string;
  shipment_header?: {
    ship_date: string | null;
    status: string | null;
    customer_party_id: string | null;
  } | null;
};

type LedgerRow = {
  ar_ledger_id: string;
  party_id: string;
  occurred_at: string | null;
  entry_type: string;
  amount_krw: number | null;
  memo: string | null;
  shipment_id: string | null;
  shipment_line_id: string | null;
  payment_id: string | null;
  created_at: string;
};

type TimelineItem =
  | { type: "order"; data: OrderLine }
  | { type: "shipment"; data: ShipmentLine }
  | { type: "ledger"; data: LedgerRow };

// ============================================================================
// UTILS
// ============================================================================

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const formatDateKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const toKstInputValue = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 16);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Dashboard2Page() {
  const queryClient = useQueryClient();
  const schemaClient = getSchemaClient();

  // Global state - selected party
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [partySearchOpen, setPartySearchOpen] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const partySearchRef = useRef<HTMLDivElement>(null);

  // Timeline filter
  const [filterType, setFilterType] = useState<"all" | "order" | "shipment" | "payment">("all");

  // Expanded work items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Click outside to close party search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (partySearchRef.current && !partySearchRef.current.contains(event.target as Node)) {
        setPartySearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ============================================================================
  // DATA FETCHING (기존 시스템의 views/functions 활용)
  // ============================================================================

  // Parties with AR info (cmsParty.ts 패턴 재사용)
  const partiesQuery = useQuery({
    queryKey: ["dashboard2", "parties"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("No client");
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, party_type, name, phone")
        .eq("party_type", "customer")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const parties = (data ?? []) as PartyRow[];
      if (parties.length === 0) return parties;

      // Fetch AR info
      const partyIds = parties.map((p) => p.party_id);
      const { data: arData, error: arError } = await schemaClient
        .from(CONTRACTS.views.arPositionByParty)
        .select("party_id, balance_krw, receivable_krw, credit_krw, last_activity_at")
        .in("party_id", partyIds);
      if (arError) throw arError;

      const arMap = new Map((arData ?? []).map((a: any) => [a.party_id, a]));
      return parties.map((p) => ({
        ...p,
        ...(arMap.get(p.party_id) ?? {}),
      })) as PartyRow[];
    },
  });

  // Orders (orders_main/page.tsx 패턴 재사용)
  const ordersQuery = useQuery({
    queryKey: ["dashboard2", "orders", selectedPartyId],
    queryFn: async () => {
      if (!schemaClient || !selectedPartyId) return [] as OrderLine[];
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select(
          "order_line_id, customer_party_id, model_name, suffix, color, size, qty, status, center_stone_name, center_stone_qty, sub1_stone_name, sub1_stone_qty, sub2_stone_name, sub2_stone_qty, is_plated, plating_color_code, memo, created_at, updated_at"
        )
        .eq("customer_party_id", selectedPartyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OrderLine[];
    },
    enabled: !!selectedPartyId,
  });

  // Shipments (ar/page.tsx 패턴 재사용)
  const shipmentsQuery = useQuery({
    queryKey: ["dashboard2", "shipments", selectedPartyId],
    queryFn: async () => {
      if (!schemaClient || !selectedPartyId) return [] as ShipmentLine[];
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, order_line_id, model_name, qty, measured_weight_g, deduction_weight_g, labor_total_sell_krw, material_amount_sell_krw, total_amount_sell_krw, created_at, shipment_header:cms_shipment_header(ship_date, status, customer_party_id)"
        )
        .eq("shipment_header.customer_party_id", selectedPartyId)
        .eq("shipment_header.status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ShipmentLine[];
    },
    enabled: !!selectedPartyId,
  });

  // AR Ledger (ar/page.tsx 패턴 재사용)
  const ledgerQuery = useQuery({
    queryKey: ["dashboard2", "ledger", selectedPartyId],
    queryFn: async () => {
      if (!schemaClient || !selectedPartyId) return [] as LedgerRow[];
      const { data, error } = await schemaClient
        .from("cms_ar_ledger")
        .select("ar_ledger_id, party_id, occurred_at, entry_type, amount_krw, memo, shipment_id, shipment_line_id, payment_id, created_at")
        .eq("party_id", selectedPartyId)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
    enabled: !!selectedPartyId,
  });

  // ============================================================================
  // TIMELINE CONSTRUCTION
  // ============================================================================

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    (ordersQuery.data ?? []).forEach((order) => {
      items.push({ type: "order", data: order });
    });

    (shipmentsQuery.data ?? []).forEach((shipment) => {
      items.push({ type: "shipment", data: shipment });
    });

    (ledgerQuery.data ?? []).forEach((ledger) => {
      if (ledger.entry_type === "PAYMENT" || ledger.entry_type === "RETURN") {
        items.push({ type: "ledger", data: ledger });
      }
    });

    // Sort by created_at desc
    items.sort((a, b) => {
      const dateA = new Date(
        a.type === "order"
          ? a.data.created_at
          : a.type === "shipment"
          ? a.data.created_at
          : a.data.created_at
      );
      const dateB = new Date(
        b.type === "order"
          ? b.data.created_at
          : b.type === "shipment"
          ? b.data.created_at
          : b.data.created_at
      );
      return dateB.getTime() - dateA.getTime();
    });

    // Apply filter
    if (filterType === "all") return items;
    return items.filter((item) => {
      if (filterType === "order") return item.type === "order";
      if (filterType === "shipment") return item.type === "shipment";
      if (filterType === "payment") return item.type === "ledger";
      return true;
    });
  }, [ordersQuery.data, shipmentsQuery.data, ledgerQuery.data, filterType]);

  // ============================================================================
  // PARTY SELECTION
  // ============================================================================

  const selectedParty = useMemo(() => {
    return (partiesQuery.data ?? []).find((p) => p.party_id === selectedPartyId) ?? null;
  }, [partiesQuery.data, selectedPartyId]);

  const filteredParties = useMemo(() => {
    if (!partySearchQuery.trim()) return partiesQuery.data ?? [];
    return (partiesQuery.data ?? []).filter((p) =>
      p.name.toLowerCase().includes(partySearchQuery.toLowerCase())
    );
  }, [partiesQuery.data, partySearchQuery]);

  // Auto-select first party on load
  useEffect(() => {
    if (!selectedPartyId && partiesQuery.data && partiesQuery.data.length > 0) {
      setSelectedPartyId(partiesQuery.data[0].party_id);
    }
  }, [partiesQuery.data, selectedPartyId]);

  // ============================================================================
  // EXPANSION HANDLERS
  // ============================================================================

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandOnly = (id: string) => {
    setExpandedItems(new Set([id]));
  };

  // ============================================================================
  // MUTATIONS (기존 useRpcMutation 사용)
  // ============================================================================

  // Order status update
  const orderStatusMutation = useRpcMutation<{ success: boolean }>({
    fn: CONTRACTS.functions.orderSetStatus,
    successMessage: "상태 변경 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard2", "orders"] });
    },
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20" id="dashboard2.root">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--panel-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ActionBar
            title="통합 업무 대시보드"
            subtitle="거래처 중심 통합 업무 흐름"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Party Selector */}
        <div className="relative" ref={partySearchRef} id="dashboard2.partySelector">
          <Card
            className={cn(
              "cursor-pointer transition-all hover:border-[var(--primary)]",
              partySearchOpen && "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
            )}
            onClick={() => setPartySearchOpen(!partySearchOpen)}
          >
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">현재 거래처</p>
                    <h2 className="text-xl font-bold text-[var(--foreground)]">
                      {selectedParty?.name ?? "거래처를 선택하세요"}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {selectedParty && (
                    <>
                      <div className="text-right">
                        <p className="text-sm text-[var(--muted)]">미수 잔액</p>
                        <p
                          className={cn(
                            "text-lg font-bold",
                            (selectedParty.receivable_krw ?? 0) > 0
                              ? "text-[var(--primary)]"
                              : "text-[var(--muted)]"
                          )}
                        >
                          {formatKrw(selectedParty.receivable_krw)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[var(--muted)]">전체 잔액</p>
                        <p
                          className={cn(
                            "text-lg font-bold",
                            (selectedParty.balance_krw ?? 0) > 0
                              ? "text-[var(--danger)]"
                              : (selectedParty.balance_krw ?? 0) < 0
                              ? "text-[var(--success)]"
                              : "text-[var(--muted)]"
                          )}
                        >
                          {formatKrw(selectedParty.balance_krw)}
                        </p>
                      </div>
                    </>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-[var(--muted)] transition-transform",
                      partySearchOpen && "rotate-180"
                    )}
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Party Search Dropdown */}
          {partySearchOpen && (
            <Card className="absolute top-full left-0 right-0 mt-2 z-40 shadow-xl">
              <CardBody className="p-4 space-y-4">
                <Input
                  placeholder="거래처 검색..."
                  value={partySearchQuery}
                  onChange={(e) => setPartySearchQuery(e.target.value)}
                  autoFocus
                />

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {partiesQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))
                  ) : filteredParties.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted)]">
                      검색 결과가 없습니다
                    </div>
                  ) : (
                    filteredParties.map((party) => (
                      <button
                        key={party.party_id}
                        onClick={() => {
                          setSelectedPartyId(party.party_id);
                          setPartySearchOpen(false);
                          setPartySearchQuery("");
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                          selectedPartyId === party.party_id
                            ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                            : "hover:bg-[var(--panel-hover)]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-[var(--muted)]" />
                          <span className="font-medium">{party.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatKrw(party.balance_krw)}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {formatDateTimeKst(party.last_activity_at)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Stats Summary */}
        {selectedParty && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="p-4">
                <p className="text-sm text-[var(--muted)]">진행중인 주문</p>
                <p className="text-2xl font-bold">
                  {(ordersQuery.data ?? []).filter((o) => o.status !== "SHIPPED" && o.status !== "CANCELLED").length}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-sm text-[var(--muted)]">오늘 출고</p>
                <p className="text-2xl font-bold text-[var(--success)]">
                  {(shipmentsQuery.data ?? []).filter((s) => {
                    const today = new Date().toISOString().slice(0, 10);
                    return s.shipment_header?.ship_date?.slice(0, 10) === today;
                  }).length}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-sm text-[var(--muted)]">총 출고액(월간)</p>
                <p className="text-2xl font-bold text-[var(--primary)]">
                  {formatKrw(
                    (shipmentsQuery.data ?? []).reduce((sum, s) => sum + (s.total_amount_sell_krw ?? 0), 0)
                  )}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-sm text-[var(--muted)]">미수금</p>
                <p className="text-2xl font-bold text-[var(--danger)]">
                  {formatKrw(selectedParty.receivable_krw)}
                </p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--panel-border)]">
          {([
            { key: "all", label: "전체", icon: Clock },
            { key: "order", label: "주문", icon: ClipboardList },
            { key: "shipment", label: "출고", icon: PackageCheck },
            { key: "payment", label: "수금/반품", icon: CreditCard },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                filterType === tab.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-4" id="dashboard2.timeline">
          {selectedParty ? (
            timeline.length === 0 ? (
              <Card>
                <CardBody className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--panel)] flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-[var(--muted)]" />
                  </div>
                  <p className="text-[var(--muted)]">해당하는 업무 내역이 없습니다</p>
                </CardBody>
              </Card>
            ) : (
              timeline.map((item, index) => {
                const itemId =
                  item.type === "order"
                    ? `order-${item.data.order_line_id}`
                    : item.type === "shipment"
                    ? `shipment-${item.data.shipment_line_id}`
                    : `ledger-${item.data.ar_ledger_id}`;

                const isExpanded = expandedItems.has(itemId);

                return (
                  <TimelineCard
                    key={itemId}
                    item={item}
                    itemId={itemId}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(itemId)}
                    onExpandOnly={() => expandOnly(itemId)}
                    queryClient={queryClient}
                  />
                );
              })
            )
          ) : (
            <Card>
              <CardBody className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--panel)] flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-[var(--muted)]" />
                </div>
                <p className="text-[var(--muted)]">거래처를 선택하세요</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TIMELINE CARD COMPONENT
// ============================================================================

function TimelineCard({
  item,
  itemId,
  isExpanded,
  onToggle,
  onExpandOnly,
  queryClient,
}: {
  item: TimelineItem;
  itemId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onExpandOnly: () => void;
  queryClient: any;
}) {
  // Order status mutation
  const orderStatusMutation = useRpcMutation<{ success: boolean }>({
    fn: CONTRACTS.functions.orderSetStatus,
    successMessage: "상태 변경 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard2", "orders"] });
    },
  });

  // Shipment prefill query for expansion
  const prefillQuery = useQuery({
    queryKey: ["dashboard2", "shipment-prefill", item.type === "order" ? item.data.order_line_id : null],
    queryFn: async () => {
      if (item.type !== "order" || !item.data.order_line_id) return null;
      const schemaClient = getSchemaClient();
      if (!schemaClient) throw new Error("No client");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.shipmentPrefill)
        .select("*")
        .eq("order_line_id", item.data.order_line_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isExpanded && item.type === "order" && item.data.status === "READY_TO_SHIP",
  });

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { tone: string; label: string }> = {
      ORDER_PENDING: { tone: "warning", label: "주문대기" },
      SENT_TO_VENDOR: { tone: "neutral", label: "공장발주" },
      WAITING_INBOUND: { tone: "primary", label: "입고대기" },
      READY_TO_SHIP: { tone: "active", label: "출고대기" },
      SHIPPED: { tone: "success", label: "출고완료" },
      CANCELLED: { tone: "danger", label: "취소" },
    };
    const config = configs[status] ?? { tone: "neutral", label: status };
    return <Badge tone={config.tone as any}>{config.label}</Badge>;
  };

  if (item.type === "order") {
    const order = item.data;
    return (
      <Card
        className={cn(
          "transition-all",
          isExpanded && "ring-2 ring-[var(--primary)]/20 border-[var(--primary)]"
        )}
      >
        <CardBody className="p-0">
          {/* Header - Always visible */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--panel-hover)] transition-colors"
            onClick={onToggle}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">주문</span>
                  <span className="text-sm text-[var(--muted)]">#{order.order_line_id.slice(0, 8)}</span>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  {order.model_name} × {order.qty}개
                  {order.color && ` | ${order.color}`}
                  {order.suffix && ` | ${order.suffix}`}
                </p>
                <p className="text-xs text-[var(--muted)]">{formatDateTimeKst(order.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {order.status === "READY_TO_SHIP" && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpandOnly();
                  }}
                >
                  <PackageCheck className="h-4 w-4 mr-1" />
                  출고처리
                </Button>
              )}
              <ChevronDown
                className={cn("h-5 w-5 text-[var(--muted)] transition-transform", isExpanded && "rotate-180")}
              />
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="border-t border-[var(--panel-border)] p-4 space-y-4">
              {/* Order Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[var(--muted)]">모델</p>
                  <p className="font-medium">{order.model_name}</p>
                </div>
                <div>
                  <p className="text-[var](muted)]">수량</p>
                  <p className="font-medium">{order.qty}개</p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">색상</p>
                  <p className="font-medium">{order.color ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">분류</p>
                  <p className="font-medium">{order.suffix ?? "-"}</p>
                </div>
              </div>

              {/* Stones */}
              {(order.center_stone_name || order.sub1_stone_name || order.sub2_stone_name) && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {order.center_stone_name && (
                    <div className="p-3 bg-[var(--panel)] rounded-lg">
                      <p className="text-[var(--muted)] text-xs">중심석</p>
                      <p className="font-medium">{order.center_stone_name}</p>
                      <p className="text-sm">{order.center_stone_qty}개</p>
                    </div>
                  )}
                  {order.sub1_stone_name && (
                    <div className="p-3 bg-[var(--panel)] rounded-lg">
                      <p className="text-[var(--muted)] text-xs">보조석1</p>
                      <p className="font-medium">{order.sub1_stone_name}</p>
                      <p className="text-sm">{order.sub1_stone_qty}개</p>
                    </div>
                  )}
                  {order.sub2_stone_name && (
                    <div className="p-3 bg-[var(--panel)] rounded-lg">
                      <p className="text-[var(--muted)] text-xs">보조석2</p>
                      <p className="font-medium">{order.sub2_stone_name}</p>
                      <p className="text-sm">{order.sub2_stone_qty}개</p>
                    </div>
                  )}
                </div>
              )}

              {/* Shipment Form - Only for READY_TO_SHIP */}
              {order.status === "READY_TO_SHIP" && (
                <div className="border-t border-[var(--panel-border)] pt-4">
                  <p className="font-semibold mb-3 flex items-center gap-2">
                    <PackageCheck className="h-4 w-4" />
                    출고 처리
                  </p>
                  {prefillQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <ShipmentForm
                      orderLineId={order.order_line_id}
                      prefill={prefillQuery.data}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["dashboard2"] });
                      }}
                    />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--panel-border)]">
                <Link href={`/orders?edit_order_line_id=${order.order_line_id}`}>
                  <Button variant="secondary" size="sm">
                    상세보기/수정
                  </Button>
                </Link>
                {order.status !== "CANCELLED" && order.status !== "SHIPPED" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm("주문을 취소하시겠습니까?")) {
                        orderStatusMutation.mutate({
                          p_order_line_id: order.order_line_id,
                          p_status: "CANCELLED",
                          p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null,
                        });
                      }
                    }}
                  >
                    주문취소
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  if (item.type === "shipment") {
    const shipment = item.data;
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardBody className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <PackageCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">출고</span>
                  <span className="text-sm text-[var(--muted)]">#{shipment.shipment_id.slice(0, 8)}</span>
                  <Badge tone="active">완료</Badge>
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  {shipment.model_name} × {shipment.qty}개
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDateKst(shipment.shipment_header?.ship_date)} | 중량: {shipment.measured_weight_g}g
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold text-[var(--primary)]">{formatKrw(shipment.total_amount_sell_krw)}</p>
              <p className="text-xs text-[var(--muted)]">
                소재: {formatKrw(shipment.material_amount_sell_krw)} | 공임: {formatKrw(shipment.labor_total_sell_krw)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Ledger item (payment/return)
  const ledger = item.data;
  const isPayment = ledger.entry_type === "PAYMENT";

  return (
    <Card className={cn("border-l-4", isPayment ? "border-l-purple-500" : "border-l-red-500")}>
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                isPayment ? "bg-purple-100" : "bg-red-100"
              )}
            >
              {isPayment ? (
                <Banknote className="h-5 w-5 text-purple-600" />
              ) : (
                <RotateCcw className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{isPayment ? "수금" : "반품"}</span>
                <Badge tone={isPayment ? "active" : "danger"}>{ledger.entry_type}</Badge>
              </div>
              <p className="text-sm text-[var(--foreground)]">{ledger.memo ?? "-"}</p>
              <p className="text-xs text-[var(--muted)]">{formatDateTimeKst(ledger.occurred_at)}</p>
            </div>
          </div>

          <div className="text-right">
            <p className={cn("font-bold", isPayment ? "text-[var(--success)]" : "text-[var(--danger)]")}>
              {isPayment ? "+" : "-"}
              {formatKrw(Math.abs(ledger.amount_krw ?? 0))}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================================
// SHIPMENT FORM COMPONENT
// ============================================================================

function ShipmentForm({
  orderLineId,
  prefill,
  onSuccess,
}: {
  orderLineId: string;
  prefill: any;
  onSuccess: () => void;
}) {
  const [weightG, setWeightG] = useState("");
  const [deductionG, setDeductionG] = useState("");
  const [labor, setLabor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shipmentMutation = useRpcMutation<{ shipment_id: string; shipment_line_id: string }>({
    fn: CONTRACTS.functions.shipmentUpsertFromOrder,
    successMessage: "출고 저장 완료",
    onSuccess: (data) => {
      // Auto confirm after save
      confirmMutation.mutate({
        p_shipment_id: data.shipment_id,
        p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null,
        p_note: "확정 from dashboard2",
        p_emit_inventory: true,
        p_cost_mode: "PROVISIONAL",
        p_receipt_id: null,
        p_cost_lines: [],
        p_force: false,
      });
    },
  });

  const confirmMutation = useRpcMutation({
    fn: CONTRACTS.functions.shipmentConfirm,
    successMessage: "출고 확정 완료",
    onSuccess: () => {
      onSuccess();
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async () => {
    if (!weightG || !labor) {
      toast.error("중량과 공임을 입력하세요");
      return;
    }

    setIsSubmitting(true);

    await shipmentMutation.mutateAsync({
      p_order_line_id: orderLineId,
      p_weight_g: Number(weightG),
      p_total_labor: Number(labor),
      p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null,
      p_idempotency_key: crypto.randomUUID(),
    });
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="text-sm text-[var(--muted)]">중량 (g)</label>
        <Input
          type="number"
          step="0.01"
          value={weightG}
          onChange={(e) => setWeightG(e.target.value)}
          placeholder="10.5"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm text-[var(--muted)]">차감 (g)</label>
        <Input
          type="number"
          step="0.01"
          value={deductionG}
          onChange={(e) => setDeductionG(e.target.value)}
          placeholder="0.5"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm text-[var(--muted)]">공임 (₩)</label>
        <Input
          type="number"
          value={labor}
          onChange={(e) => setLabor(e.target.value)}
          placeholder="150000"
          className="mt-1"
        />
      </div>
      <div className="col-span-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-1" />
          임시저장
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          <Send className="h-4 w-4 mr-1" />
          {isSubmitting ? "처리중..." : "출고확정"}
        </Button>
      </div>
    </div>
  );
}
