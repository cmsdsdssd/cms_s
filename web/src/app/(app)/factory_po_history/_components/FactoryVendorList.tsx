"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type FactoryVendorItem = {
    vendorPartyId: string;
    vendorName: string;
    vendorPrefix: string;
    poCount: number;
    totalQty: number;
};

type FactoryVendorListProps = {
    vendors: FactoryVendorItem[];
    isLoading?: boolean;
    selectedVendorPartyId: string | null;
    selectedVendorPrefix: string | null;
    onSelectVendor: (partyId: string | null, prefix: string | null) => void;
};

function formatNumber(value: number) {
    return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function FactoryVendorList({
    vendors,
    isLoading,
    selectedVendorPartyId,
    selectedVendorPrefix,
    onSelectVendor,
}: FactoryVendorListProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredVendors = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return vendors;
        return vendors.filter((v) => {
            const name = v.vendorName.toLowerCase();
            const id = v.vendorPartyId.toLowerCase();
            const prefix = v.vendorPrefix.toLowerCase();
            return name.includes(needle) || id.includes(needle) || prefix.includes(needle);
        });
    }, [vendors, searchQuery]);

    const isAllSelected = !selectedVendorPartyId && !selectedVendorPrefix;

    return (
        <div className="flex flex-col h-full border-r border-[var(--panel-border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] p-3">
                <Input
                    placeholder="공장 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                />
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {/* "전체" Option */}
                <button
                    type="button"
                    className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between",
                        isAllSelected
                            ? "bg-[var(--primary)]/10 border border-[var(--primary)]"
                            : "bg-[var(--panel)] border border-transparent hover:border-[var(--panel-border)]"
                    )}
                    onClick={() => onSelectVendor(null, null)}
                >
                    <div className="min-w-0">
                        <p className="font-medium text-sm">전체</p>
                        <p className="text-xs text-[var(--muted)]">모든 공장</p>
                    </div>
                    <div className="text-xs text-[var(--muted)] tabular-nums">
                        {vendors.reduce((sum, v) => sum + v.poCount, 0)}건
                    </div>
                </button>

                {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                        <div
                            key={`skel-${idx}`}
                            className="p-3 rounded-lg border border-dashed border-[var(--panel-border)]"
                        >
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="mt-2 h-3 w-24" />
                        </div>
                    ))
                ) : filteredVendors.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[var(--muted)]">
                        {searchQuery ? "검색 결과가 없습니다." : "공장이 없습니다."}
                    </div>
                ) : (
                    filteredVendors.map((vendor) => {
                        const isSelected =
                            (selectedVendorPartyId && vendor.vendorPartyId === selectedVendorPartyId) ||
                            (selectedVendorPrefix && vendor.vendorPrefix === selectedVendorPrefix);

                        return (
                            <button
                                key={`${vendor.vendorPartyId}-${vendor.vendorPrefix}`}
                                type="button"
                                className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                                    isSelected
                                        ? "bg-[var(--primary)]/10 border border-[var(--primary)]"
                                        : "bg-[var(--panel)] border border-transparent hover:border-[var(--panel-border)]"
                                )}
                                onClick={() => onSelectVendor(vendor.vendorPartyId || null, vendor.vendorPrefix || null)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm truncate">{vendor.vendorName}</p>
                                        <p className="text-xs text-[var(--muted)] truncate">
                                            {vendor.vendorPrefix || vendor.vendorPartyId}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className="text-xs text-[var(--muted)] tabular-nums">{vendor.poCount}건</span>
                                        <span className="text-xs text-[var(--muted)] tabular-nums">
                                            {formatNumber(vendor.totalQty)}개
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
