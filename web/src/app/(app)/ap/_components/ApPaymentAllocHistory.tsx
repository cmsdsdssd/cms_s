"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type AllocRow = Record<string, unknown> & {
    payment_id?: string | null;
    paid_at?: string | null;
    payment_note?: string | null;
    alloc_id?: string | null;
    asset_code?: string | null;
    alloc_qty?: number | null;
    occurred_at?: string | null;
    movement_code?: string | null;
    invoice_memo?: string | null;
};

type ApPaymentAllocHistoryProps = {
    allocations: AllocRow[];
    isLoading?: boolean;
};

const formatDateTimeKst = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(parsed);
};

const formatQty = (value?: number | null, asset?: string | null) => {
    if (value === null || value === undefined) return "-";
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    if (asset === "KRW_LABOR") {
        return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(n))}`;
    }
    return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(n)}g`;
};

export function ApPaymentAllocHistory({
    allocations,
    isLoading,
}: ApPaymentAllocHistoryProps) {
    // Group by payment_id
    const paymentsGrouped = useMemo(() => {
        const map = new Map<
            string,
            { paymentId: string; paidAt: string | null; note: string | null; allocs: AllocRow[] }
        >();
        for (const row of allocations) {
            const pid = row.payment_id ?? "";
            if (!pid) continue;
            if (!map.has(pid)) {
                map.set(pid, {
                    paymentId: pid,
                    paidAt: row.paid_at ?? null,
                    note: row.payment_note ?? null,
                    allocs: [],
                });
            }
            if (row.alloc_id) {
                map.get(pid)!.allocs.push(row);
            }
        }
        return Array.from(map.values());
    }, [allocations]);

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        );
    }

    if (paymentsGrouped.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                배정 내역이 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {paymentsGrouped.map((group) => (
                <div
                    key={group.paymentId}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs space-y-2"
                >
                    <div className="flex items-center justify-between text-[var(--foreground)]">
                        <span className="font-medium">{formatDateTimeKst(group.paidAt)}</span>
                        <span className="text-[var(--muted)] text-[10px] truncate max-w-[120px]">
                            {group.paymentId.slice(0, 8)}...
                        </span>
                    </div>
                    {group.note && (
                        <div className="text-[var(--muted)] text-[11px] truncate">{group.note}</div>
                    )}
                    {group.allocs.length > 0 ? (
                        <div className="space-y-1.5 pt-1 border-t border-[var(--panel-border)]">
                            {group.allocs.map((alloc, idx) => (
                                <div
                                    key={alloc.alloc_id ?? `alloc-${idx}`}
                                    className="flex items-center justify-between gap-2 text-[11px]"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="px-1.5 py-0.5 rounded bg-[var(--chip)] font-medium shrink-0">
                                            {alloc.asset_code ?? "-"}
                                        </span>
                                        <span className="truncate text-[var(--muted)]">
                                            {alloc.movement_code ?? alloc.invoice_memo ?? "-"}
                                        </span>
                                    </div>
                                    <span className="font-medium shrink-0 tabular-nums">
                                        {formatQty(alloc.alloc_qty, alloc.asset_code)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[var(--muted)] text-[11px]">배정 없음</div>
                    )}
                </div>
            ))}
        </div>
    );
}
