"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type VendorItem = {
    vendor_party_id: string;
    vendor_name: string | null;
    vendor_region?: string | null;
    vendor_is_active?: boolean | null;
};

type ApVendorListProps = {
    vendors: VendorItem[];
    isLoading?: boolean;
    selectedVendorId: string | null;
    onSelectVendor: (vendorId: string | null) => void;
};

export function ApVendorList({
    vendors,
    isLoading,
    selectedVendorId,
    onSelectVendor,
}: ApVendorListProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredVendors = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return vendors;
        return vendors.filter((v) => {
            const name = (v.vendor_name ?? "").toLowerCase();
            const id = (v.vendor_party_id ?? "").toLowerCase();
            return name.includes(needle) || id.includes(needle);
        });
    }, [vendors, searchQuery]);

    return (
        <div className="flex flex-col h-full">
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] p-3">
                <Input
                    placeholder="공장 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
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
                        const isSelected = vendor.vendor_party_id === selectedVendorId;
                        return (
                            <button
                                key={vendor.vendor_party_id}
                                type="button"
                                className={cn(
                                    "w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between",
                                    isSelected
                                        ? "bg-[var(--primary)]/10 border border-[var(--primary)]"
                                        : "bg-[var(--panel)] border border-transparent hover:border-[var(--panel-border)]"
                                )}
                                onClick={() => onSelectVendor(vendor.vendor_party_id)}
                            >
                                <div className="min-w-0">
                                    <p className="font-medium truncate">
                                        {vendor.vendor_name ?? "-"}
                                    </p>
                                    <p className="text-xs text-[var(--muted)] truncate">
                                        {vendor.vendor_party_id}
                                    </p>
                                </div>
                                {vendor.vendor_is_active === false && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)]/20 text-[var(--muted)]">
                                        비활성
                                    </span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
