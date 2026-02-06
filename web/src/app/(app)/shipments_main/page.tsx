"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Truck, Package, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type UnshippedRow = {
  order_line_id: string;
  customer_party_id: string;
  customer_name?: string;
  model_name?: string;
  suffix?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  status?: string;
  display_status?: string;
  status_sort_order?: number;
  has_inbound_receipt?: boolean;
  queue_sort_date?: string;
  sent_to_vendor_at?: string | null;
  inbound_at?: string | null;
  created_at?: string | null;
  memo?: string | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  vendor_name?: string;
  factory_po_id?: string | null;
};

type StorePickupLineRow = {
  order_line_id?: string | null;
  shipment_header?: {
    is_store_pickup?: boolean | null;
  } | null;
};

type FilterType = "customer" | "status" | "date";

type FilterRow = {
  id: string;
  type: FilterType;
  value: string;
};

type SortField = "order_date" | "factory_po" | "sent_date" | "inbound_date" | "queue_date";
type SortOrder = "asc" | "desc";

type FilterOperator = "and" | "or";

const createFilter = (type: FilterType): FilterRow => ({
  id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  value: "",
});

const createPresetFilter = (type: FilterType, value: string): FilterRow => ({
  id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  value,
});

const getKstPrintTimestamp = () => {
  const now = new Date();
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return text.replace(" ", "-").replace(/\//g, "-").replace(/:/g, ":");
};

const STATUS_PRIORITY: Record<string, number> = {
  READY_TO_SHIP: 1,
  SENT_TO_VENDOR: 2,
  ORDER_PENDING: 3,
  WAITING_INBOUND: 4,
};

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

// Color chip helper
function ColorChip({ color }: { color: string }) {
  const colors: Record<string, string> = {
    'P': 'bg-rose-400',
    'G': 'bg-amber-400',
    'W': 'bg-slate-300',
    'B': 'bg-gray-800',
  };

  return (
    <span className={cn(
      "inline-block w-3 h-3 rounded-sm border border-black/20",
      colors[color] || "bg-gray-400"
    )} />
  );
}

// Parse color string into array
function parseColors(colorStr: string | null | undefined): string[] {
  if (!colorStr) return [];
  return colorStr.split('+').filter(Boolean);
}

// Status badge component
function StatusBadge({ status, displayStatus }: { status: string; displayStatus?: string }) {
  const configs: Record<string, { color: string; icon: React.ReactNode }> = {
    'SENT_TO_VENDOR': {
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: <Clock className="w-3 h-3" />
    },
    'ORDER_PENDING': {
      color: 'bg-amber-100 text-amber-700 border-amber-300',
      icon: <Clock className="w-3 h-3" />
    },
    'WAITING_INBOUND': {
      color: 'bg-amber-100 text-amber-700 border-amber-300',
      icon: <Package className="w-3 h-3" />
    },
    'READY_TO_SHIP': {
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: <Truck className="w-3 h-3" />
    },
  };

  const config = configs[status] || { color: 'bg-gray-100 text-gray-700', icon: null };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
      config.color
    )}>
      {config.icon}
      {displayStatus || status}
    </span>
  );
}

export default function ShipmentsMainPage() {
  const schemaClient = getSchemaClient();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterRow[]>(() => [
    createPresetFilter("status", "READY_TO_SHIP"),
    createPresetFilter("status", "SENT_TO_VENDOR"),
  ]);
  const [filterOperator, setFilterOperator] = useState<FilterOperator>("or");
  const [includeStorePickup, setIncludeStorePickup] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("order_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [receiptDate, setReceiptDate] = useState(() => getKstYmd());
  const pageSize = 50; // 페이지당 50개씩

  // Fetch unshipped order lines - OPTIMIZED with caching
  const unshippedQuery = useQuery({
    queryKey: ["cms", "unshipped_order_lines"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase 클라이언트가 초기화되지 않았습니다");
      
      try {
        const startTime = performance.now();
        const { data, error } = await schemaClient
          .from("cms_v_unshipped_order_lines")
          .select("*")
          .order("status_sort_order", { ascending: true })  // 공장발주완료(1) → 입고대기(2) → 출고대기(3)
          .order("queue_sort_date", { ascending: true })    // 같은 status 내에서는 오래된 순
          .limit(500);
        
        const endTime = performance.now();
        
        if (error) {
          console.error('Supabase error:', error);
          // 친화적인 에러 메시지
          if (error.code === '42P01') {
            throw new Error("뷰 'cms_v_unshipped_order_lines'가 존재하지 않습니다. DB 마이그레이션을 실행해주세요.");
          } else if (error.code === '42501') {
            throw new Error("뷰 접근 권한이 없습니다.");
          } else {
            throw new Error(`데이터베이스 오류: ${error.message}`);
          }
        }
        
        return (data ?? []) as UnshippedRow[];
      } catch (err) {
        console.error('Fetch exception:', err);
        throw err;
      }
    },
    // 캐싱 설정으로 로딩 속도 개선
    staleTime: 1000 * 60 * 5, // 5분 캐시
    gcTime: 1000 * 60 * 30, // 30분 캐시 유지
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always", // 마운트시 항상 리패치
    retry: 2, // 실패시 2번 재시도
    retryDelay: 1000, // 1초 후 재시도
  });

  useEffect(() => {
    if (unshippedQuery.error) {
      console.error('Query error:', unshippedQuery.error);
    }
  }, [unshippedQuery.error]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        unshippedQuery.refetch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [unshippedQuery]);

  const orderLineIds = useMemo(
    () => (unshippedQuery.data ?? []).map((row) => row.order_line_id).filter(Boolean),
    [unshippedQuery.data]
  );

  const storePickupOrderLinesQuery = useQuery({
    queryKey: ["cms", "store_pickup_order_lines", orderLineIds],
    enabled: Boolean(schemaClient) && orderLineIds.length > 0,
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase 클라이언트가 초기화되지 않았습니다");
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select("order_line_id, shipment_header:cms_shipment_header!inner(is_store_pickup)")
        .in("order_line_id", orderLineIds)
        .eq("shipment_header.is_store_pickup", true);
      if (error) throw error;
      return (data ?? []) as StorePickupLineRow[];
    },
  });

  const storePickupOrderLineIds = useMemo(() => {
    const rows = storePickupOrderLinesQuery.data ?? [];
    return new Set(
      rows
        .map((row) => row.order_line_id ?? "")
        .filter((value) => Boolean(value))
    );
  }, [storePickupOrderLinesQuery.data]);

  // Apply filters and sorting
  const applyFilters = useMemo(() => {
    if (!unshippedQuery.data) return [];

    let result = unshippedQuery.data;
    console.log("[shipments_main DEBUG] unshippedQuery.data:", result.length, "rows");
    console.log("[shipments_main DEBUG] order_line_ids:", result.map(r => r.order_line_id));
    console.log("[shipments_main DEBUG] includeStorePickup:", includeStorePickup);
    console.log("[shipments_main DEBUG] storePickupOrderLinesQuery.isLoading:", storePickupOrderLinesQuery.isLoading);
    console.log("[shipments_main DEBUG] storePickupOrderLineIds:", Array.from(storePickupOrderLineIds));
    
    if (!includeStorePickup) {
      const beforeCount = result.length;
      const removedIds = result.filter((row) => storePickupOrderLineIds.has(row.order_line_id)).map(r => r.order_line_id);
      console.log("[shipments_main DEBUG] Removed order_line_ids (store pickup):", removedIds);
      result = result.filter((row) => !storePickupOrderLineIds.has(row.order_line_id));
      console.log("[shipments_main DEBUG] After store pickup filter:", result.length, "/", beforeCount);
    }
    
    const activeFilters = filters.filter((filter) => filter.value);

    const matchesFilter = (row: UnshippedRow, filter: FilterRow) => {
      if (filter.type === "customer") {
        return row.customer_party_id === filter.value;
      }
      if (filter.type === "status") {
        return row.status === filter.value;
      }
      if (filter.type === "date") {
        const dates = [
          row.queue_sort_date,
          row.sent_to_vendor_at,
          row.inbound_at,
        ].filter(Boolean);
        return dates.some(d => d?.slice(0, 10) === filter.value);
      }
      return true;
    };

    result = result.filter((row) => {
      if (activeFilters.length === 0) return true;
      if (filterOperator === "or") {
        return activeFilters.some((filter) => matchesFilter(row, filter));
      }
      return activeFilters.every((filter) => matchesFilter(row, filter));
    });

    // Apply sorting
    // 항상 1순위: status_sort_order (공장발주완료=1, 입고대기=2, 출고대기=3)
    // 2순위: 사용자가 선택한 sortField
    result.sort((a, b) => {
      const rowA = a as UnshippedRow & { status_sort_order?: number };
      const rowB = b as UnshippedRow & { status_sort_order?: number };
      
      // 1st priority: status_sort_order (DB에서 가져온 값)
      const sortOrderA = STATUS_PRIORITY[rowA.status ?? ""] ?? rowA.status_sort_order ?? 99;
      const sortOrderB = STATUS_PRIORITY[rowB.status ?? ""] ?? rowB.status_sort_order ?? 99;
      
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      
      // 같은 status 내에서: 선택한 sortField로 정렬
      let valA: string | null | undefined;
      let valB: string | null | undefined;
      
      switch (sortField) {
        case "order_date":
          valA = a.created_at ?? null;
          valB = b.created_at ?? null;
          break;
        case "factory_po":
          valA = a.factory_po_id;
          valB = b.factory_po_id;
          break;
        case "sent_date":
          valA = a.sent_to_vendor_at;
          valB = b.sent_to_vendor_at;
          break;
        case "inbound_date":
          valA = a.inbound_at;
          valB = b.inbound_at;
          break;
        case "queue_date":
        default:
          valA = a.queue_sort_date;
          valB = b.queue_sort_date;
          break;
      }
      
      // Handle null values
      if (!valA && !valB) return 0;
      if (!valA) return sortOrder === "asc" ? -1 : 1;
      if (!valB) return sortOrder === "asc" ? 1 : -1;
      
      if (sortField === "order_date") {
        const now = Date.now();
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        const distA = Math.abs(now - timeA);
        const distB = Math.abs(now - timeB);
        const comparison = distA - distB;
        return sortOrder === "asc" ? comparison : -comparison;
      }

      const comparison = valA.localeCompare(valB);
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [unshippedQuery.data, storePickupOrderLineIds, includeStorePickup, filters, filterOperator, sortField, sortOrder]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return applyFilters.slice(start, start + pageSize);
  }, [applyFilters, page]);

  const totalPages = Math.ceil(applyFilters.length / pageSize);

  // Calculate summary counts
  const summary = useMemo(() => {
    const data = unshippedQuery.data ?? [];
    return {
      total: data.length,
      sentToVendor: data.filter(r => r.status === 'SENT_TO_VENDOR').length,
      waitingInbound: data.filter(r => r.status === 'WAITING_INBOUND').length,
      readyToShip: data.filter(r => r.status === 'READY_TO_SHIP').length,
    };
  }, [unshippedQuery.data]);

  const addFilter = (type: FilterType) => {
    setFilters((prev) => [...prev, createFilter(type)]);
  };

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["cms", "unshipped_order_lines"] });
    await unshippedQuery.refetch();
  }, [queryClient, unshippedQuery]);

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  // Toggle line selection
  const toggleSelection = useCallback((orderLineId: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(orderLineId)) {
        next.delete(orderLineId);
      } else {
        next.add(orderLineId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedLines(new Set(paginatedData.map(r => r.order_line_id)));
  }, [paginatedData]);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  // Create shipment from selected
  const handleCreateShipment = useCallback(() => {
    if (selectedLines.size === 0) {
      toast.error("선택된 주문이 없습니다");
      return;
    }
    const ids = Array.from(selectedLines);
    window.location.href = `/shipments?order_line_ids=${ids.join(',')}`;
  }, [selectedLines]);

  // Customer options from data (not separate query)
  const customerOptions = useMemo(() => {
    const customers = new Map();
    (unshippedQuery.data ?? []).forEach(row => {
      if (row.customer_party_id && row.customer_name) {
        customers.set(row.customer_party_id, row.customer_name);
      }
    });
    return Array.from(customers.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [unshippedQuery.data]);

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

  const isLoading = unshippedQuery.isLoading;
  const error = unshippedQuery.error;

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isMigrationError = errorMessage.includes('마이그레이션') || errorMessage.includes('존재하지 않습니다');
    
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 px-4">
        <div className="text-red-500 font-semibold text-lg">⚠️ 데이터 로딩 실패</div>
        <div className="text-sm text-gray-600 max-w-md text-center">
          {errorMessage}
        </div>
        {isMigrationError && (
          <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg max-w-md">
            <strong>해결 방법:</strong><br/>
            1. 터미널에서 <code className="bg-gray-200 px-1">npx supabase db reset</code> 실행<br/>
            2. 페이지 새로고침 (F5)
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={() => unshippedQuery.refetch()} variant="secondary">재시도</Button>
          <Button onClick={() => window.location.reload()}>페이지 새로고침</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" id="shipments_main.root">
      {/* Unified Toolbar */}
      <UnifiedToolbar
        title="출고관리"
        actions={
          <div className="flex items-center gap-2">
            {selectedLines.size > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <Badge tone="neutral" className="text-xs">
                  {selectedLines.size}개 선택
                </Badge>
                  <Button
                    variant="primary"
                  size="sm"
                  onClick={handleCreateShipment}
                  className="text-xs"
                >
                  <ArrowRight className="w-3 h-3 mr-1" />
                  출고 생성
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs"
                >
                  취소
                </Button>
              </div>
            )}
            <Input
              type="date"
              value={receiptDate}
              onChange={(event) => {
                const next = event.target.value.trim();
                if (!isValidYmd(next)) return;
                setReceiptDate(next);
              }}
              className="h-8 w-[140px]"
            />
            <Link href="/shipments">
              <ToolbarButton variant="primary">
                + 출고 입력
              </ToolbarButton>
            </Link>
            <ToolbarButton
              variant="secondary"
              onClick={() => {
                const printedAt = getKstPrintTimestamp();
                window.location.href = `/shipments_print?date=${encodeURIComponent(receiptDate)}&printed_at=${encodeURIComponent(printedAt)}`;
              }}
            >
              오늘 출고 영수증
            </ToolbarButton>
            <ToolbarButton variant="secondary" onClick={handleRefresh}>
              새로고침
            </ToolbarButton>
          </div>
        }
      >
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
          value={filters.find(f => f.type === "status")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "status");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("status");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "status");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-32"
        >
          <option value="">(상태)</option>
          <option value="ORDER_PENDING">주문대기</option>
          <option value="SENT_TO_VENDOR">공장발주완료</option>
          <option value="WAITING_INBOUND">입고대기</option>
          <option value="READY_TO_SHIP">출고대기</option>
        </ToolbarSelect>

        <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

        {filters.length > 0 && (
          <Badge tone="primary" className="text-xs px-2 py-0.5">
            {filters.length}
          </Badge>
        )}
      </UnifiedToolbar>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 px-4">
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">전체 미출고</span>
          <span className="text-xl font-bold text-[var(--foreground)]">{summary.total}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">공장발주완료</span>
          <span className="text-xl font-bold text-blue-600">{summary.sentToVendor}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">출고대기</span>
          <span className="text-xl font-bold text-green-600">{summary.readyToShip + summary.waitingInbound}</span>
        </Card>
        <Card className="p-3 flex flex-col gap-1 shadow-sm border-[var(--panel-border)]">
          <span className="text-xs font-medium text-[var(--muted)]">필터 결과</span>
          <span className="text-xl font-bold text-[var(--primary)]">{applyFilters.length}</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr] px-4">
        {/* Filters Panel */}
        <Card className="shadow-sm h-fit border-[var(--panel-border)]" id="shipments_main.filters">
          <CardHeader className="flex items-center justify-between py-2 px-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">활성 필터</h3>
              {filters.length > 0 && (
                <Badge tone="neutral" className="text-xs px-1.5 py-0">
                  {filters.length}
                </Badge>
              )}
              <button
                onClick={() => setFilterOperator(prev => prev === "and" ? "or" : "and")}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  filterOperator === "or"
                    ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--panel-border)] text-[var(--muted)]"
                )}
              >
                {filterOperator.toUpperCase()}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Select
                className="h-8 text-xs w-28 px-2 py-0.5"
                onChange={(event) => addFilter(event.target.value as FilterType)}
                value=""
              >
                <option value="" disabled>+ 추가</option>
                <option value="customer">고객</option>
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
          <CardBody className="grid gap-3 pt-4">
            {filters.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--muted)] bg-[var(--panel)] rounded-lg border border-dashed border-[var(--panel-border)]">
                필터가 없습니다
              </div>
            ) : null}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3 shadow-sm",
                includeStorePickup ? "bg-emerald-500/10" : "bg-red-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">status</Badge>
                <span className="text-xs text-[var(--muted)]">매장출고</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeStorePickup((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  includeStorePickup
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border-red-500/20 bg-red-500/5 text-red-300"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    includeStorePickup ? "bg-emerald-400" : "bg-red-300"
                  )}
                />
                {includeStorePickup ? "ON" : "OFF"}
              </button>
            </div>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
                    <option value="ORDER_PENDING">주문대기</option>
                    <option value="SENT_TO_VENDOR">공장발주완료</option>
                    <option value="WAITING_INBOUND">입고대기</option>
                    <option value="READY_TO_SHIP">출고대기</option>
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
        <Card className="shadow-sm border-[var(--panel-border)] flex flex-col min-h-[500px]" id="shipments_main.list">
          <CardHeader className="flex items-center justify-between border-b border-[var(--panel-border)] py-2 px-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">미출고 내역</h3>
              <span className="text-xs text-[var(--muted)]">{applyFilters.length}건 중 {paginatedData.length}건 표시</span>
              {selectedLines.size > 0 && (
                <>
                  <span className="text-xs text-[var(--muted)]">|</span>
                  <Badge tone="neutral" className="text-[10px]">
                    {selectedLines.size}개 선택
                  </Badge>
                  <button
                    onClick={selectAllVisible}
                    className="text-[10px] text-primary hover:underline"
                  >
                    현재 페이지 전체 선택
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-[10px] text-muted hover:text-foreground"
                  >
                    해제
                  </button>
                </>
              )}
            </div>
            
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="h-7 text-xs px-2 rounded border border-[var(--panel-border)] bg-[var(--input-bg)]"
              >
                <option value="queue_date">정렬대기일</option>
                <option value="order_date">주문일</option>
                <option value="factory_po">공장발주</option>
                <option value="sent_date">발주일</option>
                <option value="inbound_date">입고일</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="h-7 px-2 text-xs border border-[var(--panel-border)] rounded hover:bg-[var(--panel-hover)]"
              >
                {sortOrder === "asc" ? "↑ 오름차순" : "↓ 내림차순"}
              </button>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {page} / {totalPages}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </CardHeader>
          
          <CardBody className="space-y-1 p-3 flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--muted)]">
                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">데이터를 불러오는 중입니다...</p>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-[var(--muted)] border-2 border-dashed border-[var(--panel-border)] rounded-xl m-4">
                <p className="text-sm font-medium">조건에 맞는 미출고 내역이 없습니다.</p>
                <p className="text-xs">필터를 변경하거나 새로운 출고를 등록하세요.</p>
                {unshippedQuery.data?.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">
                    (전체 데이터도 0건 - cms_v_unshipped_order_lines 뷰 확인 필요)
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 grid grid-cols-[90px_90px_140px_1.2fr_80px_100px_80px_70px_1fr_70px] gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">
                  <span>발주일</span>
                  <span>입고일</span>
                  <span>거래처명</span>
                  <span>모델명</span>
                  <span>소재</span>
                  <span>색상</span>
                  <span>사이즈</span>
                  <span>중량</span>
                  <span>비고</span>
                  <span>석여부</span>
                </div>
                {paginatedData.map((row) => {
                  const isSelected = selectedLines.has(row.order_line_id);
                  return (
                    <div
                      key={row.order_line_id}
                      className={cn(
                        "group relative rounded-[14px] border px-3 py-2 bg-[var(--panel)] shadow-sm",
                        "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--panel-border)] hover:border-[var(--primary)]/20"
                      )}
                      onClick={() => toggleSelection(row.order_line_id)}
                    >
                      <div className="grid grid-cols-[90px_90px_140px_1.2fr_80px_100px_80px_70px_1fr_70px] gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                              : "border-[var(--panel-border)] group-hover:border-[var(--primary)]/50"
                          )}>
                            {isSelected && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                          <span className="tabular-nums">
                            {row.sent_to_vendor_at ? new Date(row.sent_to_vendor_at).toLocaleDateString('ko-KR') : "-"}
                          </span>
                        </div>
                        <span className="tabular-nums">
                          {row.inbound_at ? new Date(row.inbound_at).toLocaleDateString('ko-KR') : "-"}
                        </span>
                        <span className="truncate font-medium">{row.customer_name || "-"}</span>
                        <span className="truncate">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={row.status || ""} displayStatus={row.display_status} />
                            <span className="truncate font-semibold">{row.model_name || "-"}</span>
                          </div>
                        </span>
                        <span>{"-"}</span>
                        <div className="flex items-center gap-1">
                          {parseColors(row.color).map((c, i) => (
                            <ColorChip key={i} color={c} />
                          ))}
                          <span className="truncate">{row.color || "-"}</span>
                        </div>
                        <span className="truncate">{row.size || "-"}</span>
                        <span>{"-"}</span>
                        <span className="truncate text-[var(--muted)]">{row.memo || "-"}</span>
                        <span>{row.is_plated ? "Y" : "N"}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
