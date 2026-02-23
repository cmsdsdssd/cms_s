"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileDataList } from "@/mobile/shared/MobileDataList";
import { MobileStickyActions } from "@/mobile/shared/MobileStickyActions";

type UnshippedRow = {
  order_line_id: string;
  customer_party_id: string;
  customer_name?: string;
  model_name?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  status?: string;
  display_status?: string;
  queue_sort_date?: string;
  sent_to_vendor_at?: string | null;
  inbound_at?: string | null;
};

const PENDING_STATUSES = new Set(["READY_TO_SHIP", "SENT_TO_VENDOR", "WAITING_INBOUND", "ORDER_PENDING"]);

export function ShipmentsMobileScreen() {
  const schemaClient = getSchemaClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["cms", "unshipped_order_lines"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.unshippedOrderLines)
        .select("*")
        .order("status_sort_order", { ascending: true })
        .order("queue_sort_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as UnshippedRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const rows = useMemo(() => {
    const source = (query.data ?? []).filter((row) => PENDING_STATUSES.has(String(row.status ?? "")));
    return source.filter((row) => {
      if (customerId && row.customer_party_id !== customerId) return false;
      if (status && row.status !== status) return false;
      return true;
    });
  }, [query.data, customerId, status]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    (query.data ?? []).forEach((row) => {
      if (!row.customer_party_id) return;
      map.set(row.customer_party_id, row.customer_name ?? row.customer_party_id);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [query.data]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <MobilePage
      title="출고"
      subtitle="출고대기 카드 목록"
      actions={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => setFilterOpen(true)}>
            필터
          </Button>
          <Link href="/m/shipments/history">
            <Button size="sm" variant="secondary">출고완료</Button>
          </Link>
        </div>
      }
    >
      <MobileDataList
        items={rows}
        getKey={(row) => row.order_line_id}
        emptyText={query.isLoading ? "불러오는 중..." : "출고대기 항목이 없습니다."}
        renderItem={(row) => {
          const checked = selected.has(row.order_line_id);
          return (
            <button
              type="button"
              className="w-full rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-left"
              onClick={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.order_line_id)) next.delete(row.order_line_id);
                  else next.add(row.order_line_id);
                  return next;
                });
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{row.model_name ?? "-"}</div>
                  <div className="truncate text-xs text-[var(--muted)]">{row.customer_name ?? row.customer_party_id}</div>
                </div>
                <Badge tone={checked ? "primary" : "neutral"}>{checked ? "선택" : row.display_status ?? row.status ?? "-"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span>수량: {Number(row.qty ?? 0)}</span>
                <span>색상: {row.color ?? "-"}</span>
                <span>사이즈: {row.size ?? "-"}</span>
                <span>발주/입고: {(row.sent_to_vendor_at ?? "-").slice(0, 10)} / {(row.inbound_at ?? "-").slice(0, 10)}</span>
              </div>
            </button>
          );
        }}
      />

      {selectedIds.length > 0 ? (
        <MobileStickyActions>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-[var(--muted)]">선택 {selectedIds.length}건</div>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>선택 해제</Button>
            <Link href={`/shipments?order_line_ids=${selectedIds.join(",")}`}>
              <Button size="sm">출고 생성</Button>
            </Link>
          </div>
        </MobileStickyActions>
      ) : null}

      <Sheet open={filterOpen} onOpenChange={setFilterOpen} title="고급 필터">
        <div className="flex h-full flex-col p-4">
          <div className="space-y-3">
            <label className="block text-xs text-[var(--muted)]">고객</label>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">전체</option>
              {customerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <label className="block text-xs text-[var(--muted)]">상태</label>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">전체</option>
              <option value="READY_TO_SHIP">출고대기</option>
              <option value="SENT_TO_VENDOR">공장발주완료</option>
              <option value="WAITING_INBOUND">입고대기</option>
              <option value="ORDER_PENDING">주문대기</option>
            </Select>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setCustomerId("");
                setStatus("");
              }}
            >
              초기화
            </Button>
            <Button onClick={() => setFilterOpen(false)}>적용</Button>
          </div>
        </div>
      </Sheet>
    </MobilePage>
  );
}
