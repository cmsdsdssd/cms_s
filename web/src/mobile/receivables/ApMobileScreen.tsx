"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileDataList } from "@/mobile/shared/MobileDataList";

type ApPositionRow = {
  vendor_party_id: string;
  vendor_name?: string | null;
  amount_krw?: number | null;
};

type ApInvoiceRow = {
  ap_id?: string;
  occurred_at?: string | null;
  bill_no?: string | null;
  amount_krw?: number | null;
  outstanding_qty?: number | null;
};

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function ApMobileScreen() {
  const schemaClient = getSchemaClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [gold, setGold] = useState("");
  const [silver, setSilver] = useState("");
  const [labor, setLabor] = useState("");
  const [note, setNote] = useState("");

  const positionsQuery = useQuery({
    queryKey: ["cms", "ap_position_mobile"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPositionByVendorNamed)
        .select("vendor_party_id,vendor_name,amount_krw")
        .order("vendor_name");
      if (error) throw error;
      return (data ?? []) as ApPositionRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const effectiveVendorId = selectedVendorId ?? positionsQuery.data?.[0]?.vendor_party_id ?? null;
  const selectedVendor = useMemo(
    () => positionsQuery.data?.find((row) => row.vendor_party_id === effectiveVendorId) ?? null,
    [positionsQuery.data, effectiveVendorId]
  );

  const invoiceQuery = useQuery({
    queryKey: ["cms", "ap_invoice_mobile", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApInvoiceRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apInvoicePosition)
        .select("ap_id,occurred_at,bill_no,amount_krw,outstanding_qty")
        .eq("vendor_party_id", effectiveVendorId)
        .order("occurred_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as ApInvoiceRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const payMutation = useRpcMutation<{ payment_id?: string }>({
    fn: CONTRACTS.functions.apPayAndFifo,
    successMessage: "공장 결제 등록 완료",
    onSuccess: () => {
      void positionsQuery.refetch();
      void invoiceQuery.refetch();
      setActionOpen(false);
      setGold("");
      setSilver("");
      setLabor("");
      setNote("");
    },
  });

  const submitPayment = async () => {
    if (!effectiveVendorId) return;
    const g = Number(gold.replace(/,/g, "")) || 0;
    const s = Number(silver.replace(/,/g, "")) || 0;
    const l = Number(labor.replace(/,/g, "")) || 0;
    const legs = [
      g > 0 ? { asset_code: "XAU_G", qty: g } : null,
      s > 0 ? { asset_code: "XAG_G", qty: s } : null,
      l > 0 ? { asset_code: "KRW_LABOR", qty: l } : null,
    ].filter(Boolean);
    if (legs.length === 0) return;

    await payMutation.mutateAsync({
      p_vendor_party_id: effectiveVendorId,
      p_paid_at: new Date().toISOString(),
      p_legs: legs,
      p_note: note || null,
      p_idempotency_key: crypto.randomUUID(),
    });
  };

  return (
    <MobilePage
      title="공장 미수"
      subtitle="공장 선택 후 결제/정산"
      actions={
        <Link href="/m/receivables/ar">
          <Button size="sm" variant="secondary">거래처미수</Button>
        </Link>
      }
    >
      <MobileDataList
        items={positionsQuery.data ?? []}
        getKey={(row) => row.vendor_party_id}
        emptyText={positionsQuery.isLoading ? "불러오는 중..." : "공장 데이터가 없습니다."}
        renderItem={(row) => {
          const active = row.vendor_party_id === effectiveVendorId;
          return (
            <button
              type="button"
              className={`w-full rounded-[14px] border p-3 text-left ${
                active
                  ? "border-[var(--primary)] bg-[var(--active-bg)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]"
              }`}
              onClick={() => setSelectedVendorId(row.vendor_party_id)}
            >
              <div className="text-sm font-semibold">{row.vendor_name ?? row.vendor_party_id}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">잔액 {formatKrw(Number(row.amount_krw ?? 0))}원</div>
            </button>
          );
        }}
      />

      {selectedVendor ? (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
          <div className="mb-2 text-sm font-semibold">미지급 상세</div>
          <MobileDataList
            items={invoiceQuery.data ?? []}
            getKey={(row, idx) => row.ap_id ?? `${idx}`}
            emptyText="미지급 상세가 없습니다."
            renderItem={(row) => (
              <div className="rounded border border-[var(--panel-border)] bg-[var(--chip)] px-2 py-1.5 text-xs">
                <div>{row.bill_no ?? row.ap_id ?? "-"}</div>
                <div className="text-[var(--muted)]">{(row.occurred_at ?? "").slice(0, 10)} · {formatKrw(Number(row.amount_krw ?? 0))}원</div>
              </div>
            )}
          />
          <div className="mt-3">
            <Button className="w-full" onClick={() => setActionOpen(true)}>결제 등록</Button>
          </div>
        </div>
      ) : null}

      <Sheet open={actionOpen} onOpenChange={setActionOpen} title="공장 결제 등록">
        <div className="flex h-full flex-col p-4">
          <div className="space-y-3">
            <Input inputMode="decimal" value={gold} onChange={(event) => setGold(event.target.value)} placeholder="금 (g)" />
            <Input inputMode="decimal" value={silver} onChange={(event) => setSilver(event.target.value)} placeholder="은 (g)" />
            <Input inputMode="numeric" value={labor} onChange={(event) => setLabor(event.target.value)} placeholder="공임 (KRW)" />
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="메모" className="min-h-[96px]" />
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button variant="secondary" onClick={() => setActionOpen(false)}>취소</Button>
            <Button onClick={submitPayment}>저장</Button>
          </div>
        </div>
      </Sheet>
    </MobilePage>
  );
}
