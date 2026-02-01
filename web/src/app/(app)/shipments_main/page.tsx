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

  // Summary calculations
  const totalCount = shipmentsQuery.data?.length ?? 0;
  const filteredCount = applyFilters.length;
  const confirmedCount = useMemo(
    () => (shipmentsQuery.data ?? []).filter((shipment) => shipment.status === "CONFIRMED").length,
    [shipmentsQuery.data]
  );
  const draftCount = useMemo(
    () => (shipmentsQuery.data ?? []).filter((shipment) => shipment.status === "DRAFT").length,
    [shipmentsQuery.data]
  );
  const isLoading = shipmentsQuery.isLoading || shipmentLinesQuery.isLoading || customersQuery.isLoading;

  return (
    <div className="space-y-6" id="shipments_main.root">
      {/* Header Panel */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-4 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--panel-border)] shadow-sm lg:-mx-8 lg:px-8 transition-all">
        <ActionBar
          title="출고 내역"
          subtitle="출고 조회 및 필터"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/shipments">
                <Button className="bg-[var(--primary)] text-white shadow-md hover:shadow-lg transition-all">출고 입력</Button>
              </Link>
            </div>
          }
          id="shipments_main.actionBar"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 px-1">
        <Card className="p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">전체 출고</span>
          <span className="text-2xl font-bold text-[var(--foreground)]">{totalCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">필터 결과</span>
          <span className="text-2xl font-bold text-[var(--primary)]">{filteredCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">확정됨</span>
          <span className="text-2xl font-bold text-green-600">{confirmedCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">작성 중</span>
          <span className="text-2xl font-bold text-orange-500">{draftCount}</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_4fr]">
        {/* Filters Panel */}
        <Card className="shadow-sm h-fit border-[var(--panel-border)]" id="shipments_main.filters">
          <CardHeader className="flex items-center justify-between pb-4 border-b border-[var(--panel-border)]">
            <div>
              <h3 className="text-sm font-semibold">필터</h3>
              <p className="text-xs text-[var(--muted)]">조건 검색</p>
            </div>
            <div className="flex items-center gap-2">
              <Select 
                className="h-8 text-xs w-auto min-w-[100px]" 
                onChange={(event) => addFilter(event.target.value as FilterType)}
                value=""
              >
                <option value="" disabled>+ 추가</option>
                <option value="customer">고객</option>
                <option value="status">상태</option>
                <option value="date">날짜</option>
                <option value="memo">메모</option>
              </Select>
            </div>
          </CardHeader>
          <CardBody className="grid gap-3 pt-4">
            {filters.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--muted)] bg-[var(--panel)] rounded-lg border border-dashed border-[var(--panel-border)]">
                필터가 없습니다
              </div>
            ) : null}
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-3 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">{filter.type}</Badge>
                  <button 
                    onClick={() => removeFilter(filter.id)}
                    className="text-[var(--muted)] hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
                  </button>
                </div>
                
                {filter.type === "customer" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">고객 선택</option>
                    {customerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "status" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">상태 선택</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                  </Select>
                ) : null}
                {filter.type === "memo" ? (
                  <Input
                    className="h-9 text-sm bg-[var(--input-bg)]"
                    placeholder="메모 검색"
                    value={filter.value}
                    onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                  />
                ) : null}
                {filter.type === "date" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">날짜 선택</option>
                    {dateOptions.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* List Panel */}
        <Card className="shadow-sm border-[var(--panel-border)] flex flex-col min-h-[500px]" id="shipments_main.list">
          <CardHeader className="flex items-center justify-between border-b border-[var(--panel-border)] pb-4">
            <div>
              <h3 className="text-sm font-semibold">출고 리스트</h3>
              <p className="text-xs text-[var(--muted)]">총 {applyFilters.length}건 조회됨</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 pt-4 flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--muted)]">
                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">데이터를 불러오는 중입니다...</p>
              </div>
            ) : applyFilters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-[var(--muted)] border-2 border-dashed border-[var(--panel-border)] rounded-xl m-4">
                <p className="text-sm font-medium">조건에 맞는 출고가 없습니다.</p>
                <p className="text-xs">필터를 변경하거나 새로운 출고를 등록하세요.</p>
              </div>
            ) : (
              applyFilters.map((shipment) => {
                const line = shipment.shipment_id ? lineInfoByShipment.get(shipment.shipment_id) : null;
                return (
                  <div
                    key={shipment.shipment_id}
                    className={cn(
                      "group relative rounded-[14px] border border-[var(--panel-border)] px-5 py-4 bg-[var(--panel)] shadow-sm",
                      "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--primary)]/20 cursor-default"
                    )}
                  >
                    <div className="grid grid-cols-1 gap-3 text-sm lg:grid-cols-[1fr_1.2fr_1.5fr_0.8fr_0.8fr_1fr_1.2fr] items-center">
                      <div className="font-semibold text-[var(--foreground)] flex flex-col">
                        <span>{shipment.ship_date ?? shipment.created_at?.slice(0, 10) ?? "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">날짜</span>
                      </div>
                      <div className="font-medium text-[var(--foreground)] flex flex-col">
                        <span>{shipment.customer_party_id
                          ? customerNameById.get(shipment.customer_party_id) ?? "-"
                          : "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">고객</span>
                      </div>
                      <div className="font-medium text-[var(--foreground)] flex flex-col">
                        <span>{line?.model_name ?? "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">모델</span>
                      </div>
                      <div className="text-[var(--muted)] flex flex-col">
                        <span>{line?.color ?? "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">색상</span>
                      </div>
                      <div className="text-[var(--muted)] flex flex-col">
                        <span>{line?.measured_weight_g ? `${line.measured_weight_g}g` : "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">중량</span>
                      </div>
                      <div className="text-[var(--muted)] flex flex-col">
                        <span>{line?.manual_labor_krw ? `${line.manual_labor_krw.toLocaleString()}원` : "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">공임</span>
                      </div>
                      <div className="text-[var(--muted)] text-xs truncate flex flex-col">
                        <span>{shipment.memo ?? "-"}</span>
                        <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">메모</span>
                      </div>
                    </div>
                    {/* Status Indicator */}
                    <div className={cn(
                      "absolute right-0 top-0 h-full w-1 rounded-r-[14px]",
                      shipment.status === "CONFIRMED" ? "bg-green-500/50" : "bg-orange-500/50"
                    )} />
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
