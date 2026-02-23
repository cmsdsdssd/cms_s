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

type ArPositionRow = {
  party_id: string;
  name?: string | null;
  receivable_krw?: number | null;
  credit_krw?: number | null;
  balance_krw?: number | null;
};

type ArInvoiceRow = {
  ar_id?: string;
  occurred_at?: string | null;
  model_name?: string | null;
  total_cash_outstanding_krw?: number | null;
};

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function ArMobileScreen() {
  const schemaClient = getSchemaClient();
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionKind, setActionKind] = useState<"payment" | "offset" | "adjust_down">("payment");
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [confirmRisk, setConfirmRisk] = useState(false);

  const positionsQuery = useQuery({
    queryKey: ["cms", "ar_position_mobile"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPositionByParty)
        .select("party_id,name,receivable_krw,credit_krw,balance_krw")
        .eq("party_type", "customer")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ArPositionRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const effectivePartyId = selectedPartyId ?? positionsQuery.data?.[0]?.party_id ?? null;
  const selectedParty = useMemo(
    () => positionsQuery.data?.find((row) => row.party_id === effectivePartyId) ?? null,
    [positionsQuery.data, effectivePartyId]
  );

  const invoiceQuery = useQuery({
    queryKey: ["cms", "ar_invoice_mobile", effectivePartyId],
    queryFn: async () => {
      if (!schemaClient || !effectivePartyId) return [] as ArInvoiceRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select("ar_id,occurred_at,model_name,total_cash_outstanding_krw")
        .eq("party_id", effectivePartyId)
        .order("occurred_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as ArInvoiceRow[];
    },
    enabled: Boolean(schemaClient && effectivePartyId),
  });

  const paymentMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.arApplyPaymentFifo,
    successMessage: "수금 등록 완료",
    onSuccess: () => {
      void positionsQuery.refetch();
      void invoiceQuery.refetch();
      setActionOpen(false);
      setCash("");
      setNote("");
    },
  });

  const offsetMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.arApplyOffsetFromUnallocatedCash,
    successMessage: "상계 완료",
    onSuccess: () => {
      void positionsQuery.refetch();
      void invoiceQuery.refetch();
      setActionOpen(false);
      setCash("");
      setNote("");
      setConfirmRisk(false);
    },
  });

  const adjustDownMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.arApplyAdjustmentDownFifo,
    successMessage: "차감 조정 완료",
    onSuccess: () => {
      void positionsQuery.refetch();
      void invoiceQuery.refetch();
      setActionOpen(false);
      setCash("");
      setNote("");
      setConfirmRisk(false);
    },
  });

  const submitAction = async () => {
    if (!effectivePartyId) return;
    const amount = Number(cash.replace(/,/g, "")) || 0;
    if (amount <= 0) return;

    if (actionKind === "payment") {
      await paymentMutation.mutateAsync({
        p_party_id: effectivePartyId,
        p_paid_at: new Date().toISOString(),
        p_cash_krw: amount,
        p_gold_g: 0,
        p_silver_g: 0,
        p_allow_cash_for_material: false,
        p_idempotency_key: crypto.randomUUID(),
        p_note: note || null,
      });
      return;
    }

    if (!confirmRisk) return;

    if (actionKind === "offset") {
      await offsetMutation.mutateAsync({
        p_party_id: effectivePartyId,
        p_idempotency_key: crypto.randomUUID(),
        p_offset_cash_krw: amount,
        p_occurred_at: new Date().toISOString(),
        p_reason_code: "OFFSET",
        p_reason_detail: note || "mobile offset",
      });
      return;
    }

    await adjustDownMutation.mutateAsync({
      p_party_id: effectivePartyId,
      p_idempotency_key: crypto.randomUUID(),
      p_adjust_cash_krw: amount,
      p_occurred_at: new Date().toISOString(),
      p_reason_code: "ADJUST_DOWN",
      p_reason_detail: note || "mobile adjust down",
    });
  };

  return (
    <MobilePage
      title="거래처 미수"
      subtitle="선택 > 상세 > 액션 흐름"
      actions={
        <Link href="/m/receivables/ap">
          <Button size="sm" variant="secondary">공장미수</Button>
        </Link>
      }
    >
      <MobileDataList
        items={positionsQuery.data ?? []}
        getKey={(row) => row.party_id}
        emptyText={positionsQuery.isLoading ? "불러오는 중..." : "거래처가 없습니다."}
        renderItem={(row) => {
          const active = row.party_id === effectivePartyId;
          return (
            <button
              type="button"
              className={`w-full rounded-[14px] border p-3 text-left ${
                active
                  ? "border-[var(--primary)] bg-[var(--active-bg)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]"
              }`}
              onClick={() => setSelectedPartyId(row.party_id)}
            >
              <div className="text-sm font-semibold">{row.name ?? row.party_id}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">미수 {formatKrw(Number(row.receivable_krw ?? 0))}원</div>
            </button>
          );
        }}
      />

      {selectedParty ? (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
          <div className="mb-2 text-sm font-semibold">상세 원장</div>
          <MobileDataList
            items={invoiceQuery.data ?? []}
            getKey={(row, idx) => row.ar_id ?? `${idx}`}
            emptyText="미수 인보이스가 없습니다."
            renderItem={(row) => (
              <div className="rounded border border-[var(--panel-border)] bg-[var(--chip)] px-2 py-1.5 text-xs">
                <div>{row.model_name ?? "-"}</div>
                <div className="text-[var(--muted)]">
                  {(row.occurred_at ?? "").slice(0, 10)} · {formatKrw(Number(row.total_cash_outstanding_krw ?? 0))}원
                </div>
              </div>
            )}
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button size="sm" onClick={() => { setActionKind("payment"); setActionOpen(true); }}>수금</Button>
            <Button size="sm" variant="secondary" onClick={() => { setActionKind("offset"); setActionOpen(true); }}>상계</Button>
            <Button size="sm" variant="secondary" onClick={() => { setActionKind("adjust_down"); setActionOpen(true); }}>차감조정</Button>
          </div>
        </div>
      ) : null}

      <Sheet open={actionOpen} onOpenChange={setActionOpen} title="미수 액션">
        <div className="flex h-full flex-col p-4">
          <div className="mb-2 text-sm font-semibold">
            {actionKind === "payment" ? "수금 등록" : actionKind === "offset" ? "상계 실행" : "차감 조정"}
          </div>
          <div className="space-y-3">
            <Input inputMode="numeric" value={cash} onChange={(event) => setCash(event.target.value)} placeholder="금액 (KRW)" />
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="메모/사유" className="min-h-[96px]" />
            {actionKind !== "payment" ? (
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={confirmRisk} onChange={(event) => setConfirmRisk(event.target.checked)} />
                위험 액션임을 확인했습니다.
              </label>
            ) : null}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button variant="secondary" onClick={() => setActionOpen(false)}>취소</Button>
            <Button onClick={submitAction} disabled={actionKind !== "payment" && !confirmRisk}>실행</Button>
          </div>
        </div>
      </Sheet>
    </MobilePage>
  );
}
