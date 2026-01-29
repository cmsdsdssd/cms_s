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
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type OrderRow = {
  order_line_id?: string;
  customer_party_id?: string;
  customer_name?: string;
  model_name?: string;
  suffix?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  status?: string;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  memo?: string | null;
  created_at?: string | null;
};

type PartyRow = {
  party_id?: string;
  name?: string;
  party_type?: string;
  is_active?: boolean;
};

type VendorPrefixRow = {
  prefix?: string;
  vendor_party_id?: string;
};

type FilterType = "customer" | "factory" | "model" | "date";

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

export default function OrdersMainPage() {
  const schemaClient = getSchemaClient();
  const todayKey = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<FilterRow[]>([{
    id: `date-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "date",
    value: todayKey,
  }]);

  const ordersQuery = useQuery({
    queryKey: ["cms", "orders", "main"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select(
          "order_line_id, customer_party_id, model_name, suffix, color, size, qty, status, created_at, center_stone_name, center_stone_qty, sub1_stone_name, sub1_stone_qty, sub2_stone_name, sub2_stone_qty, is_plated, plating_color_code, memo"
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
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

  const vendorsQuery = useQuery({
    queryKey: ["cms", "vendors"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, is_active")
        .eq("party_type", "vendor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PartyRow[];
    },
  });

  const vendorPrefixQuery = useQuery({
    queryKey: ["cms", "vendor_prefix"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_vendor_prefix_map")
        .select("prefix, vendor_party_id");
      if (error) throw error;
      return (data ?? []) as VendorPrefixRow[];
    },
  });

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    (vendorsQuery.data ?? []).forEach((row) => {
      if (row.party_id && row.name) map.set(row.party_id, row.name);
    });
    return map;
  }, [vendorsQuery.data]);

  const vendorPrefixes = useMemo(() => {
    return (vendorPrefixQuery.data ?? [])
      .filter((row) => row.prefix && row.vendor_party_id)
      .map((row) => ({
        prefix: String(row.prefix ?? ""),
        vendorPartyId: String(row.vendor_party_id ?? ""),
      }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  }, [vendorPrefixQuery.data]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customersQuery.data ?? []).forEach((row) => {
      if (row.party_id && row.name) map.set(row.party_id, row.name);
    });
    return map;
  }, [customersQuery.data]);

  const ordersWithFactory = useMemo(() => {
    return (ordersQuery.data ?? []).map((order) => {
      const model = (order.model_name ?? "").toLowerCase();
      let vendorPartyId = "";
      for (const row of vendorPrefixes) {
        if (model.startsWith(row.prefix.toLowerCase())) {
          vendorPartyId = row.vendorPartyId;
          break;
        }
      }
      return {
        ...order,
        customer_name: order.customer_party_id
          ? customerNameById.get(order.customer_party_id) ?? "-"
          : "-",
        vendor_guess_id: vendorPartyId,
        vendor_guess: vendorPartyId ? vendorNameById.get(vendorPartyId) ?? vendorPartyId : "",
      } as OrderRow & { vendor_guess_id: string; vendor_guess: string };
    });
  }, [ordersQuery.data, vendorPrefixes, vendorNameById, customerNameById]);

  const applyFilters = useMemo(() => {
    return ordersWithFactory.filter((order) => {
      return filters.every((filter) => {
        if (filter.type === "customer") {
          return filter.value ? order.customer_party_id === filter.value : true;
        }
        if (filter.type === "factory") {
          return filter.value ? order.vendor_guess_id === filter.value : true;
        }
        if (filter.type === "model") {
          if (!filter.value) return true;
          const target = [order.model_name, order.suffix, order.color]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return target.includes(filter.value.toLowerCase());
        }
        if (filter.type === "date") {
          if (!filter.value) return true;
          const created = order.created_at ? new Date(order.created_at) : null;
          if (!created) return false;
          const target = filter.value;
          const createdKey = created.toISOString().slice(0, 10);
          return createdKey === target;
        }
        return true;
      });
    });
  }, [ordersWithFactory, filters]);

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

  const vendorOptions = (vendorsQuery.data ?? []).map((row) => ({
    value: row.party_id ?? "",
    label: row.name ?? "-",
  }));

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

  return (
    <div className="space-y-6" id="orders_main.root">
      <ActionBar
        title="주문 관리"
        subtitle="주문 조회 및 필터"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/orders">
              <Button className="bg-[var(--primary)] text-white shadow-md">주문 입력</Button>
            </Link>
          </div>
        }
        id="orders_main.actionBar"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_4fr]">
        <Card className="shadow-sm h-fit" id="orders_main.filters">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">필터</h3>
              <p className="text-xs text-[var(--muted)]">필터를 추가해 중첩 검색하세요</p>
            </div>
            <div className="flex items-center gap-2">
              <Select onChange={(event) => addFilter(event.target.value as FilterType)}>
                <option value="">+ 필터 추가</option>
                <option value="customer">고객</option>
                <option value="factory">공장</option>
                <option value="model">모델명</option>
                <option value="date">날짜</option>
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
                {filter.type === "factory" ? (
                  <Select value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">공장 선택</option>
                    {vendorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "model" ? (
                  <Input
                    placeholder="모델/색상"
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

        <Card className="shadow-sm" id="orders_main.list">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">주문 리스트</h3>
              <p className="text-xs text-[var(--muted)]">총 {applyFilters.length}건</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {applyFilters.map((order, idx) => (
              <div
                key={order.order_line_id}
                className={cn(
                  "rounded-[14px] border border-[var(--panel-border)] px-4 py-3 bg-white shadow-sm",
                  "transition hover:shadow-md"
                )}
              >
                <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-[0.35fr_1.3fr_1.3fr_1fr_1fr_0.7fr_0.9fr_0.7fr_0.9fr_0.7fr_0.9fr_0.7fr_0.6fr_0.9fr_1fr_0.6fr]">
                  <div className="text-[var(--muted)]">{idx + 1} |</div>
                  <div className="font-semibold text-[var(--foreground)]">{order.customer_name ?? "-"}</div>
                  <div className="font-semibold text-[var(--foreground)]">{order.model_name ?? "-"}</div>
                  <div className="font-semibold text-[var(--foreground)]">{order.suffix ?? "-"}</div>
                  <div className="font-semibold text-[var(--foreground)]">{order.color ?? "-"}</div>
                  <div className="font-semibold text-[var(--foreground)]">{order.qty ?? 0}</div>
                  <div className="text-[var(--muted)]">{order.center_stone_name ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.center_stone_qty ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.sub1_stone_name ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.sub1_stone_qty ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.sub2_stone_name ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.sub2_stone_qty ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.is_plated ? "Y" : "N"}</div>
                  <div className="text-[var(--muted)]">{order.plating_color_code ?? "-"}</div>
                  <div className="text-[var(--muted)]">{order.memo ?? "-"}</div>
                  <div className="flex justify-end">
                    <Link href={`/orders?edit_order_line_id=${order.order_line_id}`}>
                      <Button size="sm" variant="secondary">
                        수정
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {applyFilters.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">조건에 맞는 주문이 없습니다.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
