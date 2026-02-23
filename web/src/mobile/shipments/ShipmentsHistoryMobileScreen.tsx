"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getSchemaClient } from "@/lib/supabase/client";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileDataList } from "@/mobile/shared/MobileDataList";

type ShipmentHeaderRow = {
  shipment_id: string;
  ship_date?: string | null;
  status?: string;
  customer?: { name?: string | null } | null;
};

export function ShipmentsHistoryMobileScreen() {
  const schemaClient = getSchemaClient();
  const query = useQuery({
    queryKey: ["cms", "shipments_history_mobile"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, ship_date, status, customer:cms_party(name)")
        .order("ship_date", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as ShipmentHeaderRow[];
    },
    enabled: Boolean(schemaClient),
  });

  return (
    <MobilePage
      title="출고완료"
      subtitle="최근 출고 이력"
      actions={
        <Link href="/m/shipments">
          <Button size="sm" variant="secondary">출고대기</Button>
        </Link>
      }
    >
      <MobileDataList
        items={query.data ?? []}
        getKey={(row) => row.shipment_id}
        emptyText={query.isLoading ? "불러오는 중..." : "출고 이력이 없습니다."}
        renderItem={(row) => (
          <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold">{row.customer?.name ?? "거래처 미지정"}</div>
              <span className="text-xs text-[var(--muted)]">{row.status ?? "-"}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">출고일: {(row.ship_date ?? "").slice(0, 10) || "-"}</div>
            <div className="text-xs text-[var(--muted)]">Shipment ID: {row.shipment_id}</div>
          </div>
        )}
      />
    </MobilePage>
  );
}
