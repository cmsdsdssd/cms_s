"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PoDetailLine = {
    customer_name?: string | null;
    model_name?: string | null;
    suffix?: string | null;
    color?: string | null;
    size?: string | null;
    qty?: number | null;
    memo?: string | null;
};

export type PoDetailData = {
    po_id: string;
    vendor_name: string | null;
    fax_sent_at: string | null;
    fax_provider: string | null;
    fax_payload_url: string | null;
    line_count: number;
    total_qty: number;
    lines: PoDetailLine[];
};

type PoDetailDrawerProps = {
    open: boolean;
    onClose: () => void;
    data: PoDetailData | null;
    isLoading: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
    canGoPrevious?: boolean;
    canGoNext?: boolean;
};

function formatNumber(value?: number | null) {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatTimeKst(value?: string | null) {
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
        second: "2-digit",
        hour12: false,
    }).format(parsed);
}

export function PoDetailDrawer({
    open,
    onClose,
    data,
    isLoading,
    onPrevious,
    onNext,
    canGoPrevious = false,
    canGoNext = false,
}: PoDetailDrawerProps) {
    const [tab, setTab] = useState<"lines" | "fax">("lines");
    const [lineSearchQuery, setLineSearchQuery] = useState("");

    const filteredLines = useMemo(() => {
        if (!data?.lines) return [];
        if (!lineSearchQuery.trim()) return data.lines;

        const needle = lineSearchQuery.trim().toLowerCase();
        return data.lines.filter((line) => {
            const model = (line.model_name ?? "").toLowerCase();
            const customer = (line.customer_name ?? "").toLowerCase();
            return model.includes(needle) || customer.includes(needle);
        });
    }, [data?.lines, lineSearchQuery]);

    const totalQty = useMemo(() => {
        return filteredLines.reduce((sum, line) => sum + (line.qty ?? 0), 0);
    }, [filteredLines]);

    return (
        <Drawer open={open} onClose={onClose} className="w-[min(800px,100vw)]">
            {/* Header */}
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">발주 상세</h2>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onPrevious}
                            disabled={!canGoPrevious}
                            title="이전 PO"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onNext}
                            disabled={!canGoNext}
                            title="다음 PO"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-2 h-8 w-8 rounded-lg hover:bg-[var(--panel)] flex items-center justify-center transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                ) : data ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono text-[var(--muted)]">
                                {data.po_id?.slice(0, 12) ?? "-"}
                            </span>
                            {data.fax_provider && (
                                <Badge tone="primary" className="text-[10px] uppercase">
                                    {data.fax_provider}
                                </Badge>
                            )}
                            {!data.fax_payload_url && (
                                <Badge tone="warning" className="text-[10px]">
                                    파일 없음
                                </Badge>
                            )}
                        </div>
                        <div className="text-xs text-[var(--muted)] flex items-center gap-4 flex-wrap">
                            <span>{data.vendor_name ?? "미지정"}</span>
                            <span>전송: {formatTimeKst(data.fax_sent_at)}</span>
                            <span>라인: {formatNumber(data.line_count)}</span>
                            <span>수량: {formatNumber(data.total_qty)}</span>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--panel-border)] bg-[var(--surface)] px-6 flex gap-4">
                <button
                    type="button"
                    onClick={() => setTab("lines")}
                    className={cn(
                        "py-3 text-sm font-medium border-b-2 transition-colors",
                        tab === "lines"
                            ? "border-[var(--primary)] text-[var(--primary)]"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                >
                    라인 상세
                </button>
                <button
                    type="button"
                    onClick={() => setTab("fax")}
                    className={cn(
                        "py-3 text-sm font-medium border-b-2 transition-colors",
                        tab === "fax"
                            ? "border-[var(--primary)] text-[var(--primary)]"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                >
                    FAX 미리보기
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : !data ? (
                    <div className="text-center text-sm text-[var(--muted)] py-12">
                        데이터를 불러올 수 없습니다.
                    </div>
                ) : tab === "lines" ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <Input
                                placeholder="모델/거래처 검색..."
                                value={lineSearchQuery}
                                onChange={(e) => setLineSearchQuery(e.target.value)}
                                className="h-8 max-w-sm"
                            />
                            <div className="text-sm font-semibold tabular-nums">
                                합계: {formatNumber(totalQty)} (필터: {filteredLines.length} / {data.lines.length})
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-[var(--panel-border)] rounded-lg">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[var(--chip)] text-[var(--muted)] font-medium border-b border-[var(--panel-border)]">
                                    <tr>
                                        <th className="px-3 py-2 whitespace-nowrap">거래처</th>
                                        <th className="px-3 py-2 whitespace-nowrap">모델</th>
                                        <th className="px-3 py-2 whitespace-nowrap">Suffix</th>
                                        <th className="px-3 py-2 whitespace-nowrap">색상</th>
                                        <th className="px-3 py-2 whitespace-nowrap">사이즈</th>
                                        <th className="px-3 py-2 whitespace-nowrap text-right">수량</th>
                                        <th className="px-3 py-2 whitespace-nowrap">메모</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--panel-border)]">
                                    {filteredLines.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">
                                                {lineSearchQuery ? "검색 결과가 없습니다." : "라인 정보가 없습니다."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLines.map((line, index) => (
                                            <tr key={`${line.model_name ?? "line"}-${index}`} className="hover:bg-[var(--panel-hover)]">
                                                <td className="px-3 py-2">{line.customer_name ?? "-"}</td>
                                                <td className="px-3 py-2">{line.model_name ?? "-"}</td>
                                                <td className="px-3 py-2">{line.suffix ?? "-"}</td>
                                                <td className="px-3 py-2">{line.color ?? "-"}</td>
                                                <td className="px-3 py-2">{line.size ?? "-"}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(line.qty ?? 0)}</td>
                                                <td className="px-3 py-2">{line.memo ?? "-"}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data.fax_payload_url ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-[var(--muted)]">FAX 파일</div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => window.open(data.fax_payload_url!, "_blank")}
                                    >
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        새 창에서 열기
                                    </Button>
                                </div>
                                <div className="border border-[var(--panel-border)] rounded-lg overflow-hidden bg-white">
                                    <iframe
                                        src={data.fax_payload_url}
                                        className="w-full h-[600px]"
                                        title="FAX Preview"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-3xl mb-4">📄</div>
                                <div className="text-sm text-[var(--muted)] mb-4">
                                    FAX 파일이 등록되지 않았습니다.
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                    PO ID: {data.po_id}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    );
}
