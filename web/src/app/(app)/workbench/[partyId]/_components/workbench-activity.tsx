"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { TimelineEmpty, TimelineView, TimelineItem } from "@/components/timeline/timeline-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type ActivityType = "order" | "shipment" | "payment" | "return" | "repair";
type RangeType = "7" | "30" | "90" | "all";

type OrderRow = {
  order_line_id: string;
  model_name: string;
  suffix?: string | null;
  color: string;
  size?: string | null;
  qty: number;
  status: string;
  created_at: string;
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

type PaymentRow = {
  payment_id: string;
  paid_at: string;
  total_amount_krw: number;
  memo?: string | null;
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
  memo?: string | null;
  issue_desc?: string | null;
};

const rangeToDays: Record<Exclude<RangeType, "all">, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
};

const toDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const orderStatusToTimeline = (status: string) => {
  if (status === "CANCELLED") return "cancelled" as const;
  if (status === "SHIPPED") return "completed" as const;
  return "pending" as const;
};

const repairStatusToTimeline = (status?: string | null) => {
  const normalized = (status ?? "").trim();
  if (normalized === "CANCELLED") return "cancelled" as const;
  if (normalized === "SHIPPED") return "completed" as const;
  if (normalized === "IN_PROGRESS") return "in_progress" as const;
  return "pending" as const;
};

export function WorkbenchActivity({ partyId }: { partyId: string }) {
  const schemaClient = getSchemaClient();
  const [range, setRange] = useState<RangeType>("30");
  const [limit, setLimit] = useState(200);
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType>>(
    new Set(["order", "shipment", "payment", "return", "repair"])
  );

  const sinceDate = useMemo(() => {
    if (range === "all") return null;
    const days = rangeToDays[range];
    const since = new Date(Date.now() - days * 86400000);
    return since.toISOString();
  }, [range]);

  const ordersQuery = useQuery({
    queryKey: ["workbench-activity-orders", partyId, sinceDate, limit],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as OrderRow[];
      let query = schemaClient
        .from("cms_order_line")
        .select("order_line_id, model_name, suffix, color, size, qty, status, created_at, memo")
        .eq("customer_party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (sinceDate) {
        query = query.gte("created_at", sinceDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["workbench-activity-shipments", partyId, sinceDate, limit],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as ShipmentRow[];
      let query = schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, status, confirmed_at, created_at, ship_date, cms_shipment_line!inner(shipment_line_id, model_name, qty, total_amount_sell_krw)"
        )
        .eq("customer_party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (sinceDate) {
        query = query.or(`confirmed_at.gte.${sinceDate},created_at.gte.${sinceDate},ship_date.gte.${sinceDate}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const paymentsQuery = useQuery({
    queryKey: ["workbench-activity-payments", partyId, sinceDate, limit],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as PaymentRow[];
      let query = schemaClient
        .from("cms_payment_header")
        .select("payment_id, paid_at, total_amount_krw, memo")
        .eq("party_id", partyId)
        .order("paid_at", { ascending: false })
        .limit(limit);
      if (sinceDate) {
        query = query.gte("paid_at", sinceDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const returnsQuery = useQuery({
    queryKey: ["workbench-activity-returns", partyId, sinceDate, limit],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as ReturnRow[];
      let query = schemaClient
        .from("cms_return_line")
        .select(
          "return_line_id, occurred_at, final_return_amount_krw, reason, return_qty, cms_shipment_line!inner(model_name, qty, shipment_header:cms_shipment_header(customer_party_id))"
        )
        .eq("cms_shipment_line.shipment_header.customer_party_id", partyId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (sinceDate) {
        query = query.gte("occurred_at", sinceDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReturnRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const repairsQuery = useQuery({
    queryKey: ["workbench-activity-repairs", partyId, sinceDate, limit],
    queryFn: async () => {
      if (!schemaClient || !partyId) return [] as RepairRow[];
      let query = schemaClient
        .from(CONTRACTS.views.repairLineEnriched)
        .select("repair_line_id, received_at, model_name, status, repair_fee_krw, memo, issue_desc")
        .eq("customer_party_id", partyId)
        .order("received_at", { ascending: false })
        .limit(limit);
      if (sinceDate) {
        query = query.gte("received_at", sinceDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RepairRow[];
    },
    enabled: !!schemaClient && !!partyId,
  });

  const timelineItems = useMemo(() => {
    const items: Array<TimelineItem & { type: ActivityType; searchText: string }> = [];

    (ordersQuery.data ?? []).forEach((order) => {
      const date = toDate(order.created_at);
      if (!date) return;
      items.push({
        id: order.order_line_id,
        type: "order",
        status: orderStatusToTimeline(order.status),
        title: `주문 ${order.model_name}`,
        subtitle: `${order.color} · ${order.qty}개`,
        date,
        qty: order.qty,
        modelName: order.model_name,
        color: order.color,
        searchText: [order.model_name, order.color, order.size, order.suffix, order.memo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    });

    (shipmentsQuery.data ?? []).forEach((shipment) => {
      const dateValue = shipment.confirmed_at || shipment.created_at || shipment.ship_date;
      const date = toDate(dateValue);
      if (!date) return;
      (shipment.cms_shipment_line ?? []).forEach((line) => {
        const modelName = (line.model_name ?? "").trim();
        items.push({
          id: line.shipment_line_id ?? shipment.shipment_id,
          type: "shipment",
          status: shipment.status === "CONFIRMED" ? "completed" : "pending",
          title: `출고 ${modelName || "모델"}`,
          subtitle: `${line.qty ?? 0}개 · ₩${Number(line.total_amount_sell_krw ?? 0).toLocaleString()}`,
          date,
          amount: Number(line.total_amount_sell_krw ?? 0),
          qty: Number(line.qty ?? 0),
          modelName: modelName || undefined,
          searchText: [modelName].filter(Boolean).join(" ").toLowerCase(),
        });
      });
    });

    (paymentsQuery.data ?? []).forEach((payment) => {
      const date = toDate(payment.paid_at);
      if (!date) return;
      items.push({
        id: payment.payment_id,
        type: "payment",
        status: "completed",
        title: "수금",
        subtitle: payment.memo ?? "",
        date,
        amount: payment.total_amount_krw,
        searchText: [payment.memo].filter(Boolean).join(" ").toLowerCase(),
      });
    });

    (returnsQuery.data ?? []).forEach((row) => {
      const date = toDate(row.occurred_at);
      if (!date) return;
      const modelName = (row.cms_shipment_line?.model_name ?? "").trim();
      items.push({
        id: row.return_line_id,
        type: "return",
        status: "completed",
        title: `반품 ${modelName || "모델"}`,
        subtitle: `${row.return_qty ?? 0}개 · ₩${Number(row.final_return_amount_krw ?? 0).toLocaleString()}`,
        date,
        amount: Number(row.final_return_amount_krw ?? 0),
        qty: Number(row.return_qty ?? 0),
        modelName: modelName || undefined,
        searchText: [modelName, row.reason].filter(Boolean).join(" ").toLowerCase(),
      });
    });

    (repairsQuery.data ?? []).forEach((row) => {
      const date = toDate(row.received_at);
      if (!date) return;
      const modelName = (row.model_name ?? "").trim();
      const memoText = row.memo ?? row.issue_desc ?? "";
      items.push({
        id: row.repair_line_id,
        type: "repair",
        status: repairStatusToTimeline(row.status),
        title: `수리 ${modelName || "모델"}`,
        subtitle: memoText,
        date,
        amount: Number(row.repair_fee_krw ?? 0),
        modelName: modelName || undefined,
        searchText: [modelName, memoText].filter(Boolean).join(" ").toLowerCase(),
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [ordersQuery.data, shipmentsQuery.data, paymentsQuery.data, returnsQuery.data, repairsQuery.data]);

  const filteredItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return timelineItems.filter((item) => {
      if (!selectedTypes.has(item.type)) return false;
      if (!searchValue) return true;
      return item.searchText.includes(searchValue);
    });
  }, [timelineItems, selectedTypes, search]);

  const canLoadMore = [
    ordersQuery.data?.length ?? 0,
    shipmentsQuery.data?.length ?? 0,
    paymentsQuery.data?.length ?? 0,
    returnsQuery.data?.length ?? 0,
    repairsQuery.data?.length ?? 0,
  ].some((count) => count >= limit);

  const toggleType = (type: ActivityType) => {
    setSelectedTypes((prev) => {
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
        <div className="flex flex-wrap gap-2">
          {(["7", "30", "90", "all"] as RangeType[]).map((value) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                range === value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              {value === "all" ? "전체" : `${value}일`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { type: "order", label: "ORDER" },
            { type: "shipment", label: "SHIPMENT" },
            { type: "payment", label: "PAYMENT" },
            { type: "return", label: "RETURN" },
            { type: "repair", label: "REPAIR" },
          ] as const).map((item) => {
            const active = selectedTypes.has(item.type);
            return (
              <button
                key={item.type}
                onClick={() => toggleType(item.type)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold tracking-wide",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="모델명/메모/사유 검색"
            className="pl-9"
          />
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <TimelineView items={filteredItems} groupByDate showTypeBadge />
      ) : (
        <TimelineEmpty message="해당 조건의 활동이 없습니다" />
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((prev) => prev + 200)}>
            더 보기
          </Button>
        </div>
      )}
    </div>
  );
}
