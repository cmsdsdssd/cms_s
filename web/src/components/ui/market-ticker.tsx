"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";


type MarketTickerVariant = "full" | "compact";

type MarketTickerProps = {
    variant?: MarketTickerVariant;
};

export function MarketTicker({ variant = "full" }: MarketTickerProps) {
    const [kg, setKg] = useState<number | null>(null);
    const [ks, setKs] = useState<number | null>(null);
    const [ksOriginal, setKsOriginal] = useState<number | null>(null);
    const [cs, setCs] = useState<number | null>(null);
    const [csOriginal, setCsOriginal] = useState<number | null>(null);
    const [cnyAd, setCnyAd] = useState<number | null>(null);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        let disposed = false;

        const fetchPrices = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch("/api/market-ticks", {
                    method: "GET",
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!response.ok) {
                    if (!disposed) setIsOffline(true);
                    return;
                }
                const result = (await response.json()) as {
                    data?: {
                        // legacy
                        gold?: number;
                        silver?: number;
                        silverOriginal?: number;
                        // new
                        kg?: number;
                        ks?: number;
                        ksOriginal?: number;
                        cs?: number | null;
                        csOriginal?: number | null;
                        cnyAd?: number | null;
                    };
                    error?: string;
                };
                if (result.data) {
                    if (!disposed) {
                        setKg(result.data.kg ?? result.data.gold ?? null);
                        setKs(result.data.ks ?? result.data.silver ?? null);
                        setKsOriginal(result.data.ksOriginal ?? result.data.silverOriginal ?? null);
                        setCs(result.data.cs ?? null);
                        setCsOriginal(result.data.csOriginal ?? null);
                        setCnyAd(result.data.cnyAd ?? null);
                        setIsOffline(false);
                    }
                } else {
                    if (!disposed) setIsOffline(true);
                }
            } catch (error) {
                const isAbort =
                    error instanceof DOMException
                    && error.name === "AbortError";
                if (!disposed && !isAbort) {
                    setIsOffline(true);
                }
            } finally {
                clearTimeout(timeoutId);
            }
        };

        fetchPrices();
        // Refresh every 30 seconds to catch table updates quickly
        const interval = setInterval(fetchPrices, 30 * 1000);
        return () => {
            disposed = true;
            clearInterval(interval);
        };
    }, []);

    const formatPrice = (price: number | null) => {
        if (price === null) return "-";
        return new Intl.NumberFormat("ko-KR").format(Math.round(price));
    };

    const isCompact = variant === "compact";

    const labels = useMemo(() => {
        const kgValue = formatPrice(kg);
        const ksDisplay = formatPrice(ksOriginal ?? ks);
        const ksAdjusted = formatPrice(ks);
        const csDisplay = formatPrice(csOriginal ?? cs);
        const csAdjusted = formatPrice(cs);

        return {
            kg: {
                label: "한국금시세",
                value: `${kgValue}`,
                unit: "원/g",
                color: "text-amber-600 dark:text-amber-400",
            },
            ks: {
                label: "한국은시세",
                value: `${ksDisplay}`, // Use raw/original value
                unit: "원/g",
                color: "text-indigo-600 dark:text-indigo-400",
            },
            cs: {
                label: "중국은시세",
                value: `${csDisplay}`, // Use raw/original value
                unit: "원/g",
                color: "text-blue-600 dark:text-blue-400",
            },
            cnyAd: {
                label: "위안화환율",
                value: `${formatPrice(cnyAd)}`,
                unit: "원",
                color: "text-rose-600 dark:text-rose-400",
            },
        };
    }, [kg, ks, ksOriginal, cs, csOriginal, cnyAd]);

    const offlineBadge = isOffline ? (
        <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE OFF
        </span>
    ) : null;

    if (isCompact) {
        return (
            <div
                className="flex items-center gap-6 overflow-hidden py-1 px-1"
                data-variant="compact"
            >
                {/* KG */}
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-[var(--muted)] tracking-tight">
                        {labels.kg.label}
                    </span>
                    <span className={cn("text-sm font-bold tabular-nums tracking-tight", labels.kg.color)}>
                        {labels.kg.value}
                        <span className="text-[10px] font-normal text-[var(--muted-weak)] ml-0.5">{labels.kg.unit}</span>
                    </span>
                </div>

                <div className="h-3 w-px bg-[var(--hairline)]" />

                {/* KS */}
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-[var(--muted)] tracking-tight">
                        {labels.ks.label}
                    </span>
                    <span className={cn("text-sm font-bold tabular-nums tracking-tight", labels.ks.color)}>
                        {labels.ks.value}
                        <span className="text-[10px] font-normal text-[var(--muted-weak)] ml-0.5">{labels.ks.unit}</span>
                    </span>
                </div>

                {/* CS (Desktop only) */}
                <div className="hidden lg:flex items-center gap-6">
                    <div className="h-3 w-px bg-[var(--hairline)]" />

                    <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-[var(--muted)] tracking-tight">
                            {labels.cs.label}
                        </span>
                        <span className={cn("text-sm font-bold tabular-nums tracking-tight", labels.cs.color)}>
                            {labels.cs.value}
                            <span className="text-[10px] font-normal text-[var(--muted-weak)] ml-0.5">{labels.cs.unit}</span>
                        </span>
                    </div>
                </div>

                {/* CNY (XL only) */}
                <div className="hidden xl:flex items-center gap-6">
                    <div className="h-3 w-px bg-[var(--hairline)]" />

                    <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-[var(--muted)] tracking-tight">
                            {labels.cnyAd.label}
                        </span>
                        <span className={cn("text-sm font-bold tabular-nums tracking-tight", labels.cnyAd.color)}>
                            {labels.cnyAd.value}
                            <span className="text-[10px] font-normal text-[var(--muted-weak)] ml-0.5">{labels.cnyAd.unit}</span>
                        </span>
                    </div>
                </div>

                {offlineBadge && <div className="ml-auto">{offlineBadge}</div>}
            </div>
        );
    }

    // Full variant (e.g., dashboard)
    return (
        <div className="flex flex-wrap justify-center gap-8 py-4">
            {/* ... similar premium styling for full variant ... */}
            {/* I'll simplify full variant to match compact style but bigger */}
            {Object.entries(labels).map(([key, data]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                    <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{data.label}</div>
                    <div className={cn("text-2xl font-bold tabular-nums", data.color)}>
                        {data.value}
                        <span className="text-sm font-medium text-[var(--muted)] ml-1">{data.unit}</span>
                    </div>
                    {(data as any).subValue && (
                        <div className="text-xs text-[var(--muted-weak)]">{(data as any).subValue}</div>
                    )}
                </div>
            ))}
            {offlineBadge}
        </div>
    );
}
