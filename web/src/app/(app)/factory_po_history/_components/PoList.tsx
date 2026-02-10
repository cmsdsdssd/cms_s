"use client";

import { useMemo, useState } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ExternalLink, FileText } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PoRow = {
    po_id: string;
    fax_sent_at: string | null;
    fax_provider: string | null;
    fax_payload_url: string | null;
    line_count: number;
    total_qty: number;
    model_names: string | null;
    customers: string | null;
};

type PoListProps = {
    rows: PoRow[];
    onOpenDetail: (poId: string) => void;
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
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(parsed);
}

export function PoList({ rows, onOpenDetail }: PoListProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "fax_sent_at", desc: false }]);
    const [searchQuery, setSearchQuery] = useState("");
    const [providerFilter, setProviderFilter] = useState<string>("ALL");

    const providers = useMemo(() => {
        const set = new Set<string>();
        rows.forEach((row) => {
            if (row.fax_provider) set.add(row.fax_provider);
        });
        return Array.from(set).sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        let result = rows;

        // Provider filter
        if (providerFilter !== "ALL") {
            result = result.filter((row) => row.fax_provider === providerFilter);
        }

        // Text search
        if (searchQuery.trim()) {
            const needle = searchQuery.trim().toLowerCase();
            result = result.filter((row) => {
                const poId = (row.po_id ?? "").toLowerCase();
                const models = (row.model_names ?? "").toLowerCase();
                const customers = (row.customers ?? "").toLowerCase();
                return poId.includes(needle) || models.includes(needle) || customers.includes(needle);
            });
        }

        return result;
    }, [rows, providerFilter, searchQuery]);

    const columns = useMemo<ColumnDef<PoRow>[]>(
        () => [
            {
                accessorKey: "fax_sent_at",
                header: "전송시간",
                cell: ({ row }) => (
                    <div className="text-sm tabular-nums">
                        {formatTimeKst(row.original.fax_sent_at)}
                    </div>
                ),
                sortingFn: "datetime",
            },
            {
                accessorKey: "po_id",
                header: "PO ID",
                cell: ({ row }) => (
                    <div className="text-sm font-mono text-[var(--muted)]">
                        {row.original.po_id?.slice(0, 8) ?? "-"}
                    </div>
                ),
                enableSorting: false,
            },
            {
                accessorKey: "fax_provider",
                header: "Provider",
                cell: ({ row }) => {
                    const provider = row.original.fax_provider;
                    return provider ? (
                        <Badge tone="primary" className="text-[10px] uppercase">
                            {provider}
                        </Badge>
                    ) : (
                        <span className="text-xs text-[var(--muted)]">-</span>
                    );
                },
                enableSorting: false,
            },
            {
                accessorKey: "line_count",
                header: "라인수",
                cell: ({ row }) => (
                    <div className="text-sm tabular-nums text-right">
                        {formatNumber(row.original.line_count)}
                    </div>
                ),
            },
            {
                accessorKey: "total_qty",
                header: "총수량",
                cell: ({ row }) => (
                    <div className="text-sm tabular-nums text-right font-semibold">
                        {formatNumber(row.original.total_qty)}
                    </div>
                ),
            },
            {
                id: "actions",
                header: "액션",
                cell: ({ row }) => {
                    const hasFax = Boolean(row.original.fax_payload_url);
                    return (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    if (row.original.fax_payload_url) {
                                        window.open(row.original.fax_payload_url, "_blank");
                                    }
                                }}
                                disabled={!hasFax}
                                title={hasFax ? "FAX 열기" : "FAX 파일 없음"}
                                className="h-7 px-2"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onOpenDetail(row.original.po_id)}
                                className="h-7 px-2"
                            >
                                <FileText className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                },
                enableSorting: false,
            },
        ],
        [onOpenDetail]
    );

    const table = useReactTable({
        data: filteredRows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div className="flex flex-col h-full bg-[var(--surface)]">
            {/* Controls */}
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder="PO/모델/거래처 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 flex-1 min-w-[200px]"
                    />
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setProviderFilter("ALL")}
                            className={cn(
                                "px-3 py-1 text-xs rounded-md transition-colors",
                                providerFilter === "ALL"
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                            )}
                        >
                            전체
                        </button>
                        {providers.map((provider) => (
                            <button
                                key={provider}
                                type="button"
                                onClick={() => setProviderFilter(provider)}
                                className={cn(
                                    "px-3 py-1 text-xs rounded-md transition-colors uppercase",
                                    providerFilter === provider
                                        ? "bg-[var(--primary)] text-white"
                                        : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                                )}
                            >
                                {provider}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs text-[var(--muted)]">
                    {filteredRows.length} / {rows.length} PO
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[var(--chip)] border-b border-[var(--panel-border)] z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className={cn(
                                            "px-4 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider",
                                            header.column.getCanSort() ? "cursor-pointer select-none hover:text-[var(--foreground)]" : ""
                                        )}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getIsSorted() ? (
                                                header.column.getIsSorted() === "desc" ? (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                )
                                            ) : null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-[var(--panel-border)]">
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-[var(--muted)]">
                                    조회된 PO가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-[var(--panel-hover)] transition-colors cursor-pointer"
                                    onClick={() => onOpenDetail(row.original.po_id)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
