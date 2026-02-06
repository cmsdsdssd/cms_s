"use client";

import { Skeleton } from "@/components/ui/skeleton";

type UnallocatedRow = Record<string, unknown> & {
    payment_id?: string | null;
    paid_at?: string | null;
    note?: string | null;
    asset_code?: string | null;
    paid_qty?: number | null;
    allocated_qty?: number | null;
    unallocated_qty?: number | null;
};

type ApUnallocatedCreditListProps = {
    unallocated: UnallocatedRow[];
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

export function ApUnallocatedCreditList({
    unallocated,
    isLoading,
}: ApUnallocatedCreditListProps) {
    if (isLoading) {
        return <Skeleton className="h-10 w-full" />;
    }

    // Filter to only show rows with actual unallocated balance
    const withBalance = unallocated.filter((row) => {
        const qty = Number(row.unallocated_qty ?? 0);
        return Number.isFinite(qty) && Math.abs(qty) > 0.0001;
    });

    if (withBalance.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                미배정 크레딧이 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {withBalance.map((row, idx) => (
                <div
                    key={row.payment_id ? `${row.payment_id}-${row.asset_code}` : `unalloc-${idx}`}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-[var(--chip)] font-medium">
                                {row.asset_code ?? "-"}
                            </span>
                            <span className="text-[var(--muted)]">
                                {formatDateTimeKst(row.paid_at)}
                            </span>
                        </div>
                        <span className="font-semibold text-[var(--primary)] tabular-nums">
                            {formatQty(row.unallocated_qty, row.asset_code)}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--muted)]">
                        <span>투입: {formatQty(row.paid_qty, row.asset_code)}</span>
                        <span>배정: {formatQty(row.allocated_qty, row.asset_code)}</span>
                    </div>
                    {row.note && (
                        <div className="mt-1 text-[11px] text-[var(--muted)] truncate">
                            {row.note}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
