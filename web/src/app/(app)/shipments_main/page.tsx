"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentRow = {
  shipment_id?: string;
  customer_party_id?: string;
  ship_date?: string | null;
  status?: string;
  created_at?: string | null;
  confirmed_at?: string | null;
  memo?: string | null;
};

type ShipmentLineRow = {
  shipment_id?: string;
  total_amount_sell_krw?: number | null;
  model_name?: string | null;
  color?: string | null;
  measured_weight_g?: number | null;
  manual_labor_krw?: number | null;
};

type PartyRow = {
  party_id?: string;
  name?: string;
  party_type?: string;
  is_active?: boolean;
};

type FilterType = "customer" | "status" | "date" | "memo";

type FilterRow = {
  id: string;
  type: FilterType;
  value: string;
};

const createFilter = (type: FilterType): FilterRow => ({
  id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  value: "",
});

export default function ShipmentsMainPage() {
  const schemaClient = getSchemaClient();
  const [filters, setFilters] = useState<FilterRow[]>([]);

  const shipmentsQuery = useQuery({
    queryKey: ["cms", "shipment_header", "main"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, customer_party_id, ship_date, status, created_at, confirmed_at, memo")
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
  });

  const shipmentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_line", "main"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select("shipment_id, total_amount_sell_krw, model_name, color, measured_weight_g, manual_labor_krw")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
    },
  });

  const customersQuery = useQuery({
    queryKey: ["cms", "customers"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, is_active")
        .eq("party_type", "customer")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PartyRow[];
    },
  });

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customersQuery.data ?? []).forEach((row) => {
      if (row.party_id && row.name) map.set(row.party_id, row.name);
    });
    return map;
  }, [customersQuery.data]);

  const totalsByShipment = useMemo(() => {
    const map = new Map<string, { count: number; sum: number }>();
    (shipmentLinesQuery.data ?? []).forEach((line) => {
      if (!line.shipment_id) return;
      const current = map.get(line.shipment_id) ?? { count: 0, sum: 0 };
      current.count += 1;
      current.sum += Number(line.total_amount_sell_krw ?? 0);
      map.set(line.shipment_id, current);
    });
    return map;
  }, [shipmentLinesQuery.data]);

  const lineInfoByShipment = useMemo(() => {
    const map = new Map<string, ShipmentLineRow>();
    (shipmentLinesQuery.data ?? []).forEach((line) => {
      if (!line.shipment_id) return;
      if (!map.has(line.shipment_id)) {
        map.set(line.shipment_id, line);
      }
    });
    return map;
  }, [shipmentLinesQuery.data]);

  const dateOptions = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    for (let i = 0; i < 60; i += 1) {
      const current = new Date(today);
      current.setDate(today.getDate() - i);
      list.push(current.toISOString().slice(0, 10));
    }
    return list;
  }, []);

  const applyFilters = useMemo(() => {
    return (shipmentsQuery.data ?? []).filter((shipment) => {
      return filters.every((filter) => {
        if (filter.type === "customer") {
          return filter.value ? shipment.customer_party_id === filter.value : true;
        }
        if (filter.type === "status") {
          return filter.value ? shipment.status === filter.value : true;
        }
        if (filter.type === "memo") {
          return filter.value
            ? (shipment.memo ?? "").toLowerCase().includes(filter.value.toLowerCase())
            : true;
        }
        if (filter.type === "date") {
          if (!filter.value) return true;
          const created = shipment.created_at ? shipment.created_at.slice(0, 10) : "";
          return created === filter.value;
        }
        return true;
      });
    });
  }, [shipmentsQuery.data, filters]);

  const addFilter = (type: FilterType) => {
    setFilters((prev) => [...prev, createFilter(type)]);
  };

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const customerOptions = (customersQuery.data ?? []).map((row) => ({
    value: row.party_id ?? "",
    label: row.name ?? "-",
  }));

  return (
    <div className="space-y-6" id="shipments_main.root">
      <ActionBar
        title="출고 내역"
        subtitle="출고 조회 및 필터"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/shipments">
              <Button className="bg-[var(--primary)] text-white shadow-md">출고 입력</Button>
            </Link>
          </div>
        }
        id="shipments_main.actionBar"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_4fr]">
        <Card className="shadow-sm h-fit" id="shipments_main.filters">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">필터</h3>
              <p className="text-xs text-[var(--muted)]">필터를 추가해 중첩 검색하세요</p>
            </div>
            <div className="flex items-center gap-2">
              <Select onChange={(event) => addFilter(event.target.value as FilterType)}>
                <option value="">+ 필터 추가</option>
                <option value="customer">고객</option>
                <option value="status">상태</option>
                <option value="date">날짜</option>
                <option value="memo">메모</option>
              </Select>
            </div>
          </CardHeader>
          <CardBody className="grid gap-3">
            {filters.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">필터가 없습니다. 상단에서 추가하세요.</p>
            ) : null}
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              >
                <Badge tone="neutral">{filter.type}</Badge>
                {filter.type === "customer" ? (
                  <Select value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">고객 선택</option>
                    {customerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "status" ? (
                  <Select value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">상태 선택</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                  </Select>
                ) : null}
                {filter.type === "memo" ? (
                  <Input
                    placeholder="메모 검색"
                    value={filter.value}
                    onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                  />
                ) : null}
                {filter.type === "date" ? (
                  <Select value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">날짜 선택</option>
                    {dateOptions.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Button variant="secondary" onClick={() => removeFilter(filter.id)}>
                  제거
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="shadow-sm" id="shipments_main.list">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">출고 리스트</h3>
              <p className="text-xs text-[var(--muted)]">총 {applyFilters.length}건</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {applyFilters.map((shipment) => {
              const line = shipment.shipment_id ? lineInfoByShipment.get(shipment.shipment_id) : null;
              return (
                <div
                  key={shipment.shipment_id}
                  className={cn(
                    "rounded-[14px] border border-[var(--panel-border)] px-4 py-3 bg-white shadow-sm",
                    "transition hover:shadow-md"
                  )}
                >
                  <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-[1fr_1fr_1.2fr_0.8fr_0.8fr_0.9fr_1.2fr]">
                    <div className="font-semibold text-[var(--foreground)]">
                      {shipment.ship_date ?? shipment.created_at?.slice(0, 10) ?? "-"}
                    </div>
                    <div className="font-semibold text-[var(--foreground)]">
                      {shipment.customer_party_id
                        ? customerNameById.get(shipment.customer_party_id) ?? "-"
                        : "-"}
                    </div>
                    <div className="font-semibold text-[var(--foreground)]">{line?.model_name ?? "-"}</div>
                    <div className="text-[var(--muted)]">{line?.color ?? "-"}</div>
                    <div className="text-[var(--muted)]">{line?.measured_weight_g ?? "-"}</div>
                    <div className="text-[var(--muted)]">{line?.manual_labor_krw ?? "-"}</div>
                    <div className="text-[var(--muted)]">{shipment.memo ?? "-"}</div>
                  </div>
                </div>
              );
            })}
            {applyFilters.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">조건에 맞는 출고가 없습니다.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
