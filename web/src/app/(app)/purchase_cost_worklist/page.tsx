"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";

type LinkedShipment = {
  shipment_id: string;
  ship_date: string | null;
  shipment_status: string | null;
  customer_party_id: string | null;
  customer_name: string | null;
  basis_cost_krw: number | null;
  line_cnt: number | null;
};

type ReceiptWorklistRow = {
  receipt_id: string;
  received_at: string;
  source?: string | null;
  status: string;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  issued_at?: string | null;

  inbox_currency_code?: string | null;
  inbox_total_amount_krw?: number | null;

  file_bucket: string;
  file_path: string;
  file_sha256?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  memo?: string | null;

  pricing_currency_code?: string | null;
  pricing_total_amount?: number | null;
  weight_g?: number | null;
  labor_basic?: number | null;
  labor_other?: number | null;
  pricing_total_amount_krw?: number | null;
  fx_rate_krw_per_unit?: number | null;
  fx_tick_id?: string | null;
  applied_at?: string | null;

  linked_shipment_cnt: number;
  linked_basis_cost_krw: number;
  linked_shipments: LinkedShipment[];
};

type UpsertSnapshotResult = {
  ok: boolean;
  receipt_id: string;
  currency_code?: string;
  total_amount?: number;
  total_amount_krw?: number;
};

type ApplySnapshotResult = {
  ok: boolean;
  receipt_id: string;
  total_amount_krw: number;
  shipment_count: number;
};

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("ko-KR").format(Number(n));
}

function formatYmd(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR");
}

function shortPath(path: string) {
  const name = (path ?? "").split("/").pop() ?? "";
  return name || path;
}

function parseNumOrNull(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function calcAllocations(totalKrw: number | null, linked: LinkedShipment[]) {
  if (!totalKrw || totalKrw <= 0) return [] as Array<LinkedShipment & { alloc_krw: number }>;
  const basisTotal = linked.reduce((acc, s) => acc + (Number(s.basis_cost_krw) || 0), 0);
  if (basisTotal <= 0) return linked.map((s) => ({ ...s, alloc_krw: 0 }));

  // progressive remainder allocation to keep sum exact
  let remainingKrw = totalKrw;
  let remainingBasis = basisTotal;
  const sorted = [...linked].sort((a, b) => (a.shipment_id > b.shipment_id ? 1 : -1));
  const out: Array<LinkedShipment & { alloc_krw: number }> = [];

  for (const s of sorted) {
    const basis = Number(s.basis_cost_krw) || 0;
    const alloc = remainingBasis > 0 ? Math.round((remainingKrw * basis) / remainingBasis) : remainingKrw;
    remainingKrw -= alloc;
    remainingBasis -= basis;
    out.push({ ...s, alloc_krw: alloc });
  }
  return out;
}

function filterRowsByStatus(
  rows: ReceiptWorklistRow[],
  filter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED"
) {
  if (filter === "ALL") return rows;
  if (filter === "APPLIED") return rows.filter((r) => !!r.applied_at);
  if (filter === "NEED_INPUT") {
    return rows.filter((r) => !r.pricing_total_amount_krw && !r.pricing_total_amount);
  }
  return rows.filter((r) => !r.applied_at);
}

function pickFirstRow(
  rows: ReceiptWorklistRow[],
  filter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED"
) {
  return filterRowsByStatus(rows, filter)[0] ?? null;
}

export default function PurchaseCostWorklistPage() {
  // NOTE: route 이름은 유지하지만, 실제로는 "영수증 작업대"를 구현합니다.
  const [filter, setFilter] = useState<"ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED">("NEED_APPLY");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [currencyCode, setCurrencyCode] = useState<"KRW" | "CNY">("KRW");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [weightG, setWeightG] = useState<string>("");
  const [laborBasic, setLaborBasic] = useState<string>("");
  const [laborOther, setLaborOther] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [forceReapply, setForceReapply] = useState<boolean>(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function applySelectedReceipt(receipt: ReceiptWorklistRow) {
    const c = (receipt.pricing_currency_code ?? receipt.inbox_currency_code ?? "KRW").toUpperCase();
    setCurrencyCode((c === "CNY" ? "CNY" : "KRW") as "KRW" | "CNY");
    setTotalAmount(receipt.pricing_total_amount != null ? String(receipt.pricing_total_amount) : "");
    setWeightG(receipt.weight_g != null ? String(receipt.weight_g) : "");
    setLaborBasic(receipt.labor_basic != null ? String(receipt.labor_basic) : "");
    setLaborOther(receipt.labor_other != null ? String(receipt.labor_other) : "");
    setNote("");
    setForceReapply(false);
  }

  const worklist = useQuery<{ data: ReceiptWorklistRow[] }>(
    {
      queryKey: ["cms", "receipt_worklist"],
      queryFn: async () => {
        const res = await fetch("/api/purchase-cost-worklist?limit=250", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "작업대 조회 실패");
        return json;
      },
      refetchInterval: 15_000,
      onSuccess: (data) => {
        if (selectedReceiptId) return;
        const first = pickFirstRow(data?.data ?? [], filter);
        if (first?.receipt_id) {
          setSelectedReceiptId(first.receipt_id);
          applySelectedReceipt(first);
        }
      },
    }
  );

  const rows = useMemo(() => worklist.data?.data ?? [], [worklist.data]);

  const selectReceiptId = (receiptId: string | null, sourceRows: ReceiptWorklistRow[] = rows) => {
    setSelectedReceiptId(receiptId);
    if (!receiptId) return;
    const target = sourceRows.find((r) => r.receipt_id === receiptId) ?? null;
    if (target) {
      applySelectedReceipt(target);
    }
  };

  const handleFilterChange = (nextFilter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED") => {
    setFilter(nextFilter);
    if (!selectedReceiptId) {
      const first = pickFirstRow(rows, nextFilter);
      if (first?.receipt_id) {
        selectReceiptId(first.receipt_id, rows);
      }
    }
  };

  const filteredRows = useMemo(() => {
    return filterRowsByStatus(rows, filter);
  }, [rows, filter]);

  const selected = useMemo(() => {
    if (!selectedReceiptId) return null;
    return rows.find((r) => r.receipt_id === selectedReceiptId) ?? null;
  }, [rows, selectedReceiptId]);

  const upsertSnapshot = useRpcMutation<UpsertSnapshotResult>({
    fn: "cms_fn_upsert_receipt_pricing_snapshot_v1",
    successMessage: "영수증 값 저장 완료",
    onSuccess: () => worklist.refetch(),
  });

  const applySnapshot = useRpcMutation<ApplySnapshotResult>({
    fn: "cms_fn_apply_receipt_pricing_snapshot_v1",
    successMessage: "출고 원가 배분/적용 완료",
    onSuccess: () => worklist.refetch(),
  });

  async function onSave() {
    if (!selectedReceiptId) return;

    const p_total_amount = parseNumOrNull(totalAmount);
    if (p_total_amount == null) {
      toast.error("총금액은 필수입니다");
      return;
    }

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_currency_code: currencyCode,
      p_total_amount,
      p_weight_g: parseNumOrNull(weightG),
      p_labor_basic: parseNumOrNull(laborBasic),
      p_labor_other: parseNumOrNull(laborOther),
      p_note: note || null,
    });
  }

  async function onApply() {
    if (!selected) return;
    if ((selected.linked_shipment_cnt ?? 0) <= 0) {
      toast.error("이 영수증에 연결된 출고가 없습니다. 먼저 출고에서 영수증을 선택해 연결하세요.");
      return;
    }

    // ✅ Apply 버튼 한 번에 끝내기: 저장(스냅샷) → 적용
    const p_total_amount = parseNumOrNull(totalAmount);
    if (p_total_amount == null) {
      toast.error("총금액은 필수입니다");
      return;
    }

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selected.receipt_id,
      p_currency_code: currencyCode,
      p_total_amount,
      p_weight_g: parseNumOrNull(weightG),
      p_labor_basic: parseNumOrNull(laborBasic),
      p_labor_other: parseNumOrNull(laborOther),
      p_note: note || null,
    });

    await applySnapshot.mutateAsync({
      p_receipt_id: selected.receipt_id,
      p_note: note || null,
      p_force: forceReapply,
    });
  }

  async function openReceiptPreview(receiptId: string) {
    try {
      const url = `/api/receipt-preview?receipt_id=${encodeURIComponent(receiptId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("미리보기를 열 수 없습니다");
    }
  }

  async function uploadReceipt() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("파일을 선택해 주세요");
      return;
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/receipt-upload", {
      method: "POST",
      body: form,
    });

    const json = await res.json();
    if (!res.ok) {
      toast.error("업로드 실패", { description: json?.error ?? "" });
      return;
    }

    const receiptId = json?.data?.receipt_id as string | undefined;
    if (receiptId) {
      toast.success("영수증 업로드 완료");
      setUploadOpen(false);
      // refresh and select
      const refreshed = await worklist.refetch();
      const nextRows = refreshed.data?.data ?? [];
      selectReceiptId(receiptId, nextRows);
    }
  }

  const allocations = useMemo((): Array<LinkedShipment & { alloc_krw: number }> => {
    if (!selected) return [];
    const totalKrw = selected.pricing_total_amount_krw ?? null;
    return calcAllocations(totalKrw, selected.linked_shipments ?? []);
  }, [selected]);

  const busy = worklist.isLoading || upsertSnapshot.isPending || applySnapshot.isPending;

  return (
    <div className="space-y-6">
      <ActionBar
        title="영수증 작업대"
        subtitle="영수증 총합(중량/공임/총금액)을 저장하고, 연결된 출고에 자동 배분하여 ACTUAL 원가로 반영합니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => worklist.refetch()} disabled={busy}>
              새로고침
            </Button>
            <Button onClick={() => setUploadOpen(true)} disabled={busy}>
              영수증 업로드
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: receipt list */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="영수증 목록"
            right={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={filter === "NEED_APPLY" ? "primary" : "secondary"}
                  onClick={() => handleFilterChange("NEED_APPLY")}
                >
                  미적용
                </Button>
                <Button
                  size="sm"
                  variant={filter === "NEED_INPUT" ? "primary" : "secondary"}
                  onClick={() => handleFilterChange("NEED_INPUT")}
                >
                  미입력
                </Button>
                <Button
                  size="sm"
                  variant={filter === "APPLIED" ? "primary" : "secondary"}
                  onClick={() => handleFilterChange("APPLIED")}
                >
                  적용완료
                </Button>
                <Button
                  size="sm"
                  variant={filter === "ALL" ? "primary" : "secondary"}
                  onClick={() => handleFilterChange("ALL")}
                >
                  전체
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-2">
            {worklist.isLoading ? (
              <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">표시할 영수증이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {filteredRows.map((r) => {
                  const isSelected = r.receipt_id === selectedReceiptId;
                  const hasInput = !!(r.pricing_total_amount_krw ?? r.pricing_total_amount);
                  const isApplied = !!r.applied_at;
                  const hasLinks = (r.linked_shipment_cnt ?? 0) > 0;

                  return (
                    <button
                      key={r.receipt_id}
                      type="button"
                      onClick={() => selectReceiptId(r.receipt_id)}
                      className={`w-full rounded-[12px] border px-3 py-3 text-left transition-all ${
                        isSelected
                          ? "border-[var(--primary)] bg-blue-50/40"
                          : "border-[var(--panel-border)] hover:bg-[var(--chip)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {shortPath(r.file_path)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                            <span>{formatYmd(r.received_at)}</span>
                            <span>·</span>
                            <span className="truncate">{r.vendor_name ?? "거래처 미지정"}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Badge tone={hasLinks ? "primary" : "neutral"}>연결 {r.linked_shipment_cnt ?? 0}</Badge>
                            <Badge tone={hasInput ? "active" : "warning"}>{hasInput ? "입력" : "미입력"}</Badge>
                            <Badge tone={isApplied ? "active" : "warning"}>{isApplied ? "적용" : "미적용"}</Badge>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {r.pricing_currency_code ?? "-"} {formatNumber(r.pricing_total_amount)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right: selected receipt editor */}
        <Card className="lg:col-span-3">
          <CardHeader
            title={selected ? "영수증 입력/배분" : "영수증을 선택하세요"}
            right={
              selected ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => openReceiptPreview(selected.receipt_id)}>
                    미리보기
                  </Button>
                  <Button variant="secondary" onClick={() => selectReceiptId(null)}>
                    선택해제
                  </Button>
                </div>
              ) : null
            }
          />
          <CardBody className="space-y-5">
            {!selected ? (
              <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--chip)] p-4 text-sm text-[var(--muted)]">
                왼쪽에서 영수증을 선택하면, 총합(중량/공임/총금액)을 입력하고 연결된 출고에 자동 배분하여 원가를 반영할 수 있습니다.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">통화</div>
                    <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value as any)}>
                      <option value="KRW">KRW</option>
                      <option value="CNY">CNY</option>
                    </Select>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      * 환율은 저장하지 않고, 적용 시점에 최신 시세(meta)를 참조해 KRW 환산합니다.
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">총금액 ({currencyCode})</div>
                    <Input
                      inputMode="decimal"
                      placeholder="예: 123456"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                    />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      저장 후 KRW 환산: <b>{formatNumber(selected.pricing_total_amount_krw)}</b>
                      {selected.fx_rate_krw_per_unit ? (
                        <span className="ml-2">(fx≈{formatNumber(selected.fx_rate_krw_per_unit)} KRW/1)</span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">중량(g)</div>
                    <Input
                      inputMode="decimal"
                      placeholder="예: 12.34"
                      value={weightG}
                      onChange={(e) => setWeightG(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">기본공임</div>
                    <Input
                      inputMode="decimal"
                      placeholder="예: 5000"
                      value={laborBasic}
                      onChange={(e) => setLaborBasic(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">기타공임</div>
                    <Input
                      inputMode="decimal"
                      placeholder="예: 2000"
                      value={laborOther}
                      onChange={(e) => setLaborOther(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--muted)]">메모(선택)</div>
                    <Textarea
                      placeholder="예: 공장 출고가 / 특이사항"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={onSave} disabled={busy || !selectedReceiptId}>
                    저장
                  </Button>
                  <Button onClick={onApply} disabled={busy || !selectedReceiptId}>
                    배분 적용
                  </Button>
                  <label className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={forceReapply}
                      onChange={(e) => setForceReapply(e.target.checked)}
                    />
                    재적용(덮어쓰기)
                  </label>
                </div>

                <div className="rounded-[12px] border border-[var(--panel-border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">연결된 출고</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        기준: 출고확정 당시 내부원가 합(total_amount_cost_krw) 비례 배분
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      연결 {selected.linked_shipment_cnt ?? 0}건 · 기준합 {formatNumber(selected.linked_basis_cost_krw)} KRW
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {selected.linked_shipments?.length ? (
                      allocations.map((s) => (
                        <div
                          key={s.shipment_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--panel-border)] bg-[var(--chip)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[var(--foreground)]">
                                {s.customer_name ?? "(거래처 미상)"}
                              </span>
                              <Badge tone="neutral">{formatYmd(s.ship_date)}</Badge>
                              <Badge tone="neutral">라인 {s.line_cnt ?? 0}</Badge>
                              <Badge tone="neutral">기준 {formatNumber(s.basis_cost_krw)} KRW</Badge>
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)] break-all">shipment_id: {s.shipment_id}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-[var(--foreground)]">배분 {formatNumber(s.alloc_krw)} KRW</div>
                            <div className="text-xs text-[var(--muted)]">
                              {selected.pricing_total_amount_krw ? "(저장된 KRW 환산 기준)" : "(총금액 저장 후 계산)"}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted)]">연결된 출고가 없습니다.</div>
                    )}
                  </div>
                </div>

                {selected.applied_at ? (
                  <div className="rounded-[12px] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                    적용 완료: {formatYmd(selected.applied_at)}
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="영수증 업로드">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs text-[var(--muted)]">파일</div>
            <Input ref={fileRef} type="file" accept="application/pdf,image/*" />
            <div className="mt-1 text-xs text-[var(--muted)]">
              PDF/이미지 파일을 업로드하면 영수증 inbox에 저장됩니다.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              취소
            </Button>
            <Button onClick={uploadReceipt} disabled={busy}>
              업로드
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
