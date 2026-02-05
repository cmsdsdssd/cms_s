"use client";

import { useMemo, useState, lazy, Suspense } from "react";
import Link from "next/link";
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarInput,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

// Lazy load Factory Order Wizard
const FactoryOrderWizard = lazy(() => import("@/components/factory-order/factory-order-wizard"));

type OrderRow = {
  order_line_id?: string;
  customer_party_id?: string;
  customer_name?: string;
  customer_mask_code?: string | null;
  model_name?: string;
  suffix?: string;
  material_code?: string | null;
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
  factory_po_id?: string | null;
};

type FactoryOrderLine = Omit<OrderRow, "customer_mask_code"> & {
  customer_mask_code?: string;
  vendor_guess_id: string;
  vendor_guess: string;
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

type MasterImageRow = {
  model_name?: string | null;
  image_path?: string | null;
};

type FilterType = "customer" | "factory" | "model" | "date" | "status";

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

function normalizeImagePath(path: string, bucket: string) {
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  if (path.startsWith("storage/v1/object/public/")) {
    return path.replace("storage/v1/object/public/", "").split("/").slice(1).join("/");
  }
  return path;
}

function buildPublicImageUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "master_images";
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);
  return `${url}/storage/v1/object/public/${bucket}/${normalized}`;
}

const MATERIAL_LABELS: Record<string, string> = {
  "14": "14",
  "18": "18",
  "24": "24",
  "925": "925",
  "999": "999",
  "00": "00",
};

function getMaterialLabel(value?: string | null) {
  if (!value) return "-";
  return MATERIAL_LABELS[value] ?? value;
}

const CATEGORY_LABELS: Record<string, string> = {
  BRACELET: "팔찌",
  ANKLET: "발찌",
  NECKLACE: "목걸이",
  EARRING: "귀걸이",
  RING: "반지",
  PIERCING: "피어싱",
  PENDANT: "펜던트",
  WATCH: "시계",
  KEYRING: "키링",
  SYMBOL: "상징",
  ACCESSORY: "부속",
  ETC: "기타",
};

const STATUS_OPTIONS = [
  { value: "ORDER_PENDING", label: "주문대기" },
  { value: "SENT_TO_VENDOR", label: "공장전송" },
  { value: "READY_TO_SHIP", label: "출고준비" },
  { value: "SHIPPED", label: "출고완료" },
  { value: "CANCELLED", label: "주문취소" },
];

function getCategoryLabel(value?: string | null) {
  if (!value) return "-";
  return CATEGORY_LABELS[value] ?? value;
}

export default function OrdersMainPage() {
  const schemaClient = getSchemaClient();
  const todayKey = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<FilterRow[]>(() => [
    { id: `date-${todayKey}`, type: "date", value: todayKey },
  ]);
  const [showFactoryOrderWizard, setShowFactoryOrderWizard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["cms", "orders", "main"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select(
          "order_line_id, customer_party_id, customer_mask_code, model_name, suffix, material_code, color, size, qty, status, created_at, center_stone_name, center_stone_qty, sub1_stone_name, sub1_stone_qty, sub2_stone_name, sub2_stone_qty, is_plated, plating_color_code, memo, factory_po_id"
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    (ordersQuery.data ?? []).forEach((order) => {
      if (order.model_name) names.add(order.model_name);
    });
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [ordersQuery.data]);

  const masterImagesQuery = useQuery<MasterImageRow[]>({
    queryKey: ["cms", "master_images", modelNames],
    queryFn: async () => {
      if (!schemaClient || modelNames.length === 0) return [];
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("model_name, image_path")
        .in("model_name", modelNames);
      if (error) {
        console.error("Failed to load master images:", error);
        return [];
      }
      return (data ?? []) as MasterImageRow[];
    },
    enabled: !!schemaClient && modelNames.length > 0,
  });

  const masterImageMap = useMemo(() => {
    const map = new Map<string, string>();
    (masterImagesQuery.data ?? []).forEach((row) => {
      const name = row.model_name ? String(row.model_name) : "";
      const imageUrl = buildPublicImageUrl(row.image_path ? String(row.image_path) : null);
      if (name && imageUrl) {
        map.set(name, imageUrl);
      }
    });
    return map;
  }, [masterImagesQuery.data]);

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

  const ordersWithFactory = useMemo<FactoryOrderLine[]>(() => {
    return (ordersQuery.data ?? []).map((order) => {
      const model = (order.model_name ?? "").toLowerCase();
      let vendorPartyId = "";

      for (const row of vendorPrefixes) {
        const prefixLower = row.prefix.toLowerCase();
        if (model.startsWith(prefixLower)) {
          vendorPartyId = row.vendorPartyId;
          break;
        }
      }

      return {
        ...order,
        customer_mask_code: order.customer_mask_code ?? undefined,
        customer_name: order.customer_party_id
          ? customerNameById.get(order.customer_party_id) ?? "-"
          : "-",
        vendor_guess_id: vendorPartyId,
        vendor_guess: vendorPartyId ? vendorNameById.get(vendorPartyId) ?? vendorPartyId : "",
      };
    });
  }, [ordersQuery.data, vendorPrefixes, vendorNameById, customerNameById]);

  const applyFilters = useMemo(() => {
    return ordersWithFactory.filter((order) => {
      if (!includeCancelled && order.status === "CANCELLED") return false;
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
        if (filter.type === "status") {
          if (!filter.value) return true;
          return order.status === filter.value;
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
  }, [ordersWithFactory, filters, includeCancelled]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(applyFilters.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;

  const paginatedOrders = useMemo((): Array<OrderRow | null> => {
    const slice: Array<OrderRow | null> = applyFilters.slice(startIndex, startIndex + itemsPerPage);
    while (slice.length < itemsPerPage) {
      slice.push(null);
    }
    return slice;
  }, [applyFilters, itemsPerPage, startIndex]);

  const pendingFilteredOrders = useMemo(() => {
    return applyFilters.filter((order) => {
      const isPending = order.status === "ORDER_PENDING";
      const noPo = !order.factory_po_id;
      const hasVendor = !!order.vendor_guess_id;
      return isPending && noPo && hasVendor;
    });
  }, [applyFilters]);

  const editAllHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("edit_all", "1");
    params.set("include_cancelled", includeCancelled ? "1" : "0");
    filters.forEach((filter) => {
      if (!filter.value) return;
      if (filter.type === "customer") params.set("filter_customer", filter.value);
      if (filter.type === "factory") params.set("filter_factory", filter.value);
      if (filter.type === "model") params.set("filter_model", filter.value);
      if (filter.type === "status") params.set("filter_status", filter.value);
      if (filter.type === "date") params.set("filter_date", filter.value);
    });
    return `/orders?${params.toString()}`;
  }, [filters, includeCancelled]);

  const addFilter = (type: FilterType) => {
    setFilters((prev) => [...prev, createFilter(type)]);
    setCurrentPage(1);
  };

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
    setCurrentPage(1);
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
    setCurrentPage(1);
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

  const filteredCount = applyFilters.length;
  const isLoading = ordersQuery.isLoading || customersQuery.isLoading || vendorsQuery.isLoading || vendorPrefixQuery.isLoading;
  const todayOrderCount = useMemo(() => {
    return (ordersQuery.data ?? []).filter((order) => {
      if (order.status === "CANCELLED") return false;
      if (!order.created_at) return false;
      return new Date(order.created_at).toISOString().slice(0, 10) === todayKey;
    }).length;
  }, [ordersQuery.data, todayKey]);

  const todayCancelledCount = useMemo(() => {
    return (ordersQuery.data ?? []).filter((order) => {
      if (order.status !== "CANCELLED") return false;
      if (!order.created_at) return false;
      return new Date(order.created_at).toISOString().slice(0, 10) === todayKey;
    }).length;
  }, [ordersQuery.data, todayKey]);

  return (
    <div className="space-y-3 font-sans text-slate-600" id="orders_main.root">
      {/* Factory Order Wizard Modal */}
      {showFactoryOrderWizard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Suspense fallback={
            <div className="bg-card p-8 rounded-lg">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted mt-4">로딩중...</p>
            </div>
          }>
            <FactoryOrderWizard
              orderLines={pendingFilteredOrders}
              onClose={() => setShowFactoryOrderWizard(false)}
              onSuccess={() => {
                setShowFactoryOrderWizard(false);
                ordersQuery.refetch();
              }}
            />
          </Suspense>
        </div>
      )}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
            <img
              src={previewImageUrl}
              alt="model preview"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Unified Toolbar - Compact Header */}
      <UnifiedToolbar
        title="주문관리"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFactoryOrderWizard(true)}
              className="flex items-center gap-1"
            >
              <Building2 className="w-4 h-4" />
              공장발주
              <Badge tone="neutral" className="ml-1 text-[10px] h-4 px-1">
                {pendingFilteredOrders.length}
              </Badge>
            </Button>
            <Link href="/orders">
              <ToolbarButton variant="primary">
                + 주문 입력
              </ToolbarButton>
            </Link>
          </div>
        }
      >
        {/* Quick Filters */}
        <ToolbarSelect
          value={filters.find(f => f.type === "customer")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "customer");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("customer");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "customer");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-28"
        >
          <option value="">(고객)</option>
          {customerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          value={filters.find(f => f.type === "factory")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "factory");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("factory");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "factory");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-28"
        >
          <option value="">(공장)</option>
          {vendorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          value={filters.find(f => f.type === "date")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "date");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("date");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "date");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-28"
        >
          <option value="">(날짜)</option>
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </ToolbarSelect>

        <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

        <ToolbarInput
          value={filters.find(f => f.type === "model")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "model");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("model");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "model");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          placeholder="모델 검색"
          className="w-32 md:w-40"
        />

        {/* Filter Count Badge */}
        {filters.length > 0 && (
          <Badge tone="primary" className="text-xs px-2 py-0.5">
            {filters.length}
          </Badge>
        )}
      </UnifiedToolbar>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 px-4">
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">오늘 주문</span>
          <span className="text-xl font-bold text-blue-400">{todayOrderCount}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">오늘 취소</span>
          <span className="text-xl font-bold text-red-400">{todayCancelledCount}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">필터 결과</span>
          <span className="text-xl font-bold text-white">{filteredCount}</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr] px-4">
        {/* Filters Panel - Compact */}
        <Card className="shadow-sm h-fit border-[var(--panel-border)]" id="orders_main.filters">
          <CardHeader className="flex items-center justify-between py-3 px-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">활성 필터</h3>
              {filters.length > 0 && (
                <Badge tone="neutral" className="text-xs px-1.5 py-0">
                  {filters.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                className="h-8 text-sm w-24"
                onChange={(event) => addFilter(event.target.value as FilterType)}
                value=""
              >
                <option value="" disabled>+ 추가</option>
                <option value="customer">고객</option>
                <option value="factory">공장</option>
                <option value="model">모델명</option>
                <option value="status">상태</option>
                <option value="date">날짜</option>
              </Select>
              {filters.length > 0 && (
                <button
                  onClick={() => setFilters([])}
                  className="text-xs text-[var(--muted)] hover:text-red-500 px-2 py-1 rounded hover:bg-[var(--panel-hover)] transition-colors"
                >
                  모두 지우기
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="grid gap-2 p-3 min-h-[120px]">
            {filters.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--muted)] bg-[var(--panel)] rounded-md border border-dashed border-[var(--panel-border)]">
                필터가 없습니다
              </div>
            ) : null}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3 shadow-sm",
                includeCancelled ? "bg-emerald-500/10" : "bg-red-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">status</Badge>
                <span className="text-xs text-[var(--muted)]">주문취소 포함</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeCancelled((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  includeCancelled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border-red-500/20 bg-red-500/5 text-red-300"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    includeCancelled ? "bg-emerald-400" : "bg-red-300"
                  )}
                />
                {includeCancelled ? "ON" : "OFF"}
              </button>
            </div>
            {filters.map((filter) => (
              <div
                key={filter.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-3 shadow-sm transition-all hover:shadow-md",
                  filter.value ? "bg-emerald-500/10" : "bg-red-500/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">{filter.type}</Badge>
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="text-[var(--muted)] hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
                {filter.type === "factory" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
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
                    className="h-9 text-sm bg-[var(--input-bg)]"
                    placeholder="모델/색상"
                    value={filter.value}
                    onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                  />
                ) : null}
                {filter.type === "status" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">상태 선택</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
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
        <Card className="shadow-sm border-[var(--panel-border)] flex flex-col min-h-[500px]" id="orders_main.list">
          <CardHeader className="flex items-center justify-between border-b border-[var(--panel-border)] py-2 px-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">주문 리스트</h3>
              <span className="text-xs text-[var(--muted)]">{applyFilters.length}건</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--muted)]" />
                  주문취소
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--warning)]/70" />
                  주문대기
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500/70" />
                  공장전송
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]/70" />
                  출고준비
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-500/70" />
                  출고완료
                </span>
              </div>
              <Link href={editAllHref}>
                <Button size="sm" variant="secondary">
                  전체수정
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-3 flex-1 flex flex-col">
            <div className="space-y-1 flex-1">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border border-[var(--panel-border)] rounded-[14px]">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : applyFilters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-[var(--muted)] border-2 border-dashed border-[var(--panel-border)] rounded-xl m-4">
                  <p className="text-sm font-medium">조건에 맞는 주문이 없습니다.</p>
                  <p className="text-xs">필터를 변경하거나 새로운 주문을 등록하세요.</p>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-xs font-medium text-slate-500 border-b">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[0.35fr_64px_1.3fr_2.03fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.8fr_1fr] items-center">
                      <div className="text-center">#</div>
                      <div className="text-center">모델사진</div>
                      <div className="text-center">거래처</div>
                      <div className="text-center">모델명</div>
                      <div className="text-center">소재</div>
                      <div className="text-center">카테고리</div>
                      <div className="text-center">색상</div>
                      <div className="text-center">사이즈</div>
                      <div className="text-center">도금여부</div>
                      <div className="text-center">도금색</div>
                      <div className="text-center">석여부</div>
                      <div className="text-center">비고</div>
                    </div>
                  </div>
                  {paginatedOrders.map((order, idx) => {
                    const isEmpty = !order || !order.order_line_id;
                    const hasStone = order
                      ? Boolean(
                        (order.center_stone_name && String(order.center_stone_name).trim() !== "") ||
                        (order.sub1_stone_name && String(order.sub1_stone_name).trim() !== "") ||
                        (order.sub2_stone_name && String(order.sub2_stone_name).trim() !== "")
                      )
                      : false;
                    const materialLabel = order
                      ? getMaterialLabel(
                        order.material_code ??
                        (order.is_plated === null || order.is_plated === undefined
                          ? null
                          : order.is_plated
                            ? "14"
                            : "925")
                      )
                      : "-";
                    const platingLabel = order
                      ? order.is_plated === null || order.is_plated === undefined
                        ? "-"
                        : order.is_plated
                          ? "Y"
                          : "N"
                      : "-";
                    const rowKey = order?.order_line_id ?? `empty-${startIndex + idx}`;

                    return (
                      <div
                        key={rowKey}
                        className={cn(
                          "group relative rounded-[14px] border border-[var(--panel-border)] px-4 py-[0.13rem] bg-[var(--panel)] shadow-sm", // py 줄임
                          "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--primary)]/20",
                          isEmpty ? "opacity-40 min-h-[70.5px]" : "cursor-default",
                          order?.status === "CANCELLED" ? "line-through decoration-[2px] decoration-[var(--muted)] text-[var(--muted)]" : "",
                          order?.status === "ORDER_PENDING" ? "bg-[var(--warning)]/10" : ""
                        )}
                      >
                        <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-[0.35fr_64px_1.3fr_2.03fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.8fr_1fr] items-stretch">
                          {/* 1. 번호 */}
                          <div className="text-[var(--muted)] text-center text-base font-bold flex items-center justify-center">
                            {startIndex + idx + 1}
                          </div>

                          {/* 2. 모델사진 (absolute 유지하여 행 높이 영향 최소화 + 중앙 정렬) */}
                          <div className="font-semibold text-[var(--foreground)] flex flex-col items-center justify-center">
                            <div className="relative h-full w-full">
                              {order?.model_name && masterImageMap.get(order.model_name) ? (
                                <div
                                  className={cn(
                                    "absolute left-1/2 top-1/2 mt-5 h-15 w-15 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--panel)]",
                                    order?.status === "CANCELLED" ? "grayscale" : ""
                                  )}
                                >
                                  <img
                                    src={masterImageMap.get(order.model_name)}
                                    alt={order.model_name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onDoubleClick={() =>
                                      setPreviewImageUrl(order.model_name ? masterImageMap.get(order.model_name) ?? null : null)
                                    }
                                  />
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "absolute left-1/2 top-1/2 mt-5 h-15 w-15 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--panel)] flex items-center justify-center text-[10px] text-[var(--muted)]",
                                    order?.status === "CANCELLED" ? "grayscale" : ""
                                  )}
                                >
                                  {order ? "-" : ""}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">모델사진</span>
                          </div>

                          {/* 3. 거래처 - 중앙 정렬 적용 */}
                          <div className="font-semibold text-[var(--foreground)] flex flex-col justify-center items-center text-center">
                            <span
                              className={cn(
                                "text-sm font-semibold truncate px-2",
                                order?.status === "CANCELLED" ? "text-slate-400" : "text-slate-700"
                              )}
                            >
                              {order?.customer_name ?? ""}
                            </span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">거래처</span>
                          </div>

                          {/* 4. 모델명 - 중앙 정렬 적용 */}
                          <div className="font-semibold text-[var(--foreground)] flex flex-col h-full justify-center items-center text-center">
                            <span
                              className={cn(
                                "text-sm font-medium truncate px-2",
                                order?.status === "CANCELLED" ? "text-slate-400" : "text-slate-600"
                              )}
                            >
                              {order?.model_name ?? ""}
                            </span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">모델명</span>
                          </div>

                          {/* 5. 소재 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order ? materialLabel : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">소재</span>
                          </div>

                          {/* 6. 카테고리 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{getCategoryLabel(order?.suffix)}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">카테고리</span>
                          </div>

                          {/* 7. 색상 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order?.color ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">색상</span>
                          </div>

                          {/* 8. 사이즈 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order?.size ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">사이즈</span>
                          </div>

                          {/* 9. 도금여부 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order ? platingLabel : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">도금여부</span>
                          </div>

                          {/* 10. 도금색 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order?.plating_color_code ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">도금색</span>
                          </div>

                          {/* 11. 석여부 */}
                          <div className="text-slate-500 flex flex-col justify-center">
                            <span>{order ? (hasStone ? "✓" : "-") : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">석여부</span>
                          </div>

                          {/* 12. 비고 */}
                          <div className="text-[var(--muted)] truncate flex flex-col justify-center">
                            <span>{order?.memo ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">비고</span>
                          </div>

                          {!isEmpty ? (
                            <div className="flex justify-end items-center">
                              <Link href={`/orders?edit_order_line_id=${order.order_line_id}`}>
                                <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  수정
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <div />
                          )}
                        </div>
                        {!isEmpty && order?.status && (
                          <div
                            className={cn(
                              "absolute right-0 top-0 h-full w-2 rounded-r-[14px] pointer-events-none",
                              order.status === "ORDER_PENDING" ? "bg-[var(--warning)]/70" :
                                order.status === "SENT_TO_VENDOR" ? "bg-sky-500/70" :
                                  order.status === "READY_TO_SHIP" ? "bg-emerald-500/70" :
                                    order.status === "SHIPPED" ? "bg-indigo-500/70" :
                                      order.status === "CANCELLED" ? "bg-[var(--muted)]/70" :
                                        "bg-[var(--muted)]/40"
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-border)] pt-3">
              <span className="text-[11px] text-[var(--muted)]">
                페이지 {safePage} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                >
                  이전
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
