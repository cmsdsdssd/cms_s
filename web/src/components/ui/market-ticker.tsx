"use client";

import { useEffect, useMemo, useState } from "react";

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
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const response = await fetch("/api/market-ticks");
                if (!response.ok) {
                    setIsOffline(true);
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
                    };
                    error?: string;
                };
                if (result.data) {
                    setKg(result.data.kg ?? result.data.gold ?? null);
                    setKs(result.data.ks ?? result.data.silver ?? null);
                    setKsOriginal(result.data.ksOriginal ?? result.data.silverOriginal ?? null);
                    setCs(result.data.cs ?? null);
                    setCsOriginal(result.data.csOriginal ?? null);
                    setIsOffline(false);
                } else {
                    setIsOffline(true);
                }
            } catch (error) {
                console.error("Failed to fetch market ticks:", error);
                setIsOffline(true);
            }
        };

        fetchPrices();
        // Refresh every 30 seconds to catch table updates quickly
        const interval = setInterval(fetchPrices, 30 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatPrice = (price: number | null) => {
        if (price === null) return "-";
        return new Intl.NumberFormat("ko-KR").format(Math.round(price));
    };

    const isCompact = variant === "compact";

    const labels = useMemo(() => {
        const kgValue = `${formatPrice(kg)} /g`;
        // User requested RAW price (without 1.2 factor) for display
        const ksDisplay = formatPrice(ksOriginal ?? ks);
        const ksAdjusted = formatPrice(ks);

        const csDisplay = formatPrice(csOriginal ?? cs);
        const csAdjusted = formatPrice(cs);

        const ksOriginalValue = formatPrice(ksOriginal);
        const csOriginalValue = formatPrice(csOriginal);

        return {
            kg: {
                title: `KG ${kgValue}`,
                ariaLabel: `KG ${kgValue}`,
            },
            ks: {
                title: `KS 원본 ${ksDisplay} /g · 보정 ${ksAdjusted} /g`,
                ariaLabel: `KS ${ksDisplay}, 보정 ${ksAdjusted} /g`,
                original: ksOriginalValue,
                adjusted: ksAdjusted,
                display: ksDisplay,
            },
            cs: {
                title: `CS 원본 ${csDisplay} /g · 보정 ${csAdjusted} /g`,
                ariaLabel: `CS ${csDisplay}, 보정 ${csAdjusted} /g`,
                original: csOriginalValue,
                adjusted: csAdjusted,
                display: csDisplay,
            },
        };
    }, [kg, ks, ksOriginal, cs, csOriginal]);

    const offlineBadge = isOffline ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--hairline)] bg-[color:var(--panel)]/80 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-weak)] shadow-[var(--shadow-subtle)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--danger)] opacity-70" aria-hidden />
            offline
        </span>
    ) : null;

    return (
        <div
            className={
                isCompact
                    ? "flex min-w-0 items-center gap-3 whitespace-nowrap rounded-full border border-[color:var(--hairline)] bg-[color:var(--panel)]/80 px-3 py-1.5 shadow-[var(--shadow-subtle)]"
                    : "flex flex-wrap items-start justify-center gap-8 text-base font-bold"
            }
            data-variant={variant}
        >
            {/* KG */}
            <div
                className={
                    isCompact
                        ? "flex min-w-0 items-baseline gap-2 text-[clamp(0.68rem,0.8vw,0.85rem)] font-semibold text-[var(--primary)]"
                        : "flex flex-col gap-1"
                }
                aria-label={labels.kg.ariaLabel}
            >
                <div
                    className={
                        isCompact
                            ? "flex min-w-0 items-baseline gap-1.5"
                            : "flex items-center gap-2 text-[var(--primary)]"
                    }
                >
                    <span className={isCompact ? "text-[clamp(0.6rem,0.7vw,0.75rem)] font-semibold tracking-[0.08em]" : "font-bold"}>
                        KG:
                    </span>
                    <span
                        className={
                            isCompact
                                ? "min-w-0 max-w-[7.5rem] truncate tabular-nums"
                                : "font-mono text-lg font-extrabold tabular-nums"
                        }
                        title={labels.kg.title}
                    >
                        {formatPrice(kg)} /g
                    </span>
                </div>
            </div>

            {/* KS */}
            <div
                className={
                    isCompact
                        ? "flex min-w-0 items-baseline gap-2 text-[clamp(0.68rem,0.8vw,0.85rem)] font-semibold text-[var(--muted-strong)]"
                        : "flex flex-col gap-1"
                }
                aria-label={labels.ks.ariaLabel}
            >
                <div
                    className={
                        isCompact
                            ? "flex min-w-0 items-baseline gap-1.5"
                            : "flex items-center gap-2 text-[var(--muted-strong)]"
                    }
                >
                    <span className={isCompact ? "text-[clamp(0.6rem,0.7vw,0.75rem)] font-semibold tracking-[0.08em]" : "font-bold"}>
                        KS:
                    </span>
                    <span
                        className={
                            isCompact
                                ? "min-w-0 max-w-[7.5rem] truncate tabular-nums"
                                : "font-mono text-lg font-extrabold tabular-nums"
                        }
                        title={labels.ks.title}
                    >
                        {labels.ks.display} /g
                    </span>
                </div>
                {!isCompact ? (
                    <div className="text-xs font-normal text-[var(--muted)]">
                        (보정: {labels.ks.adjusted} /g)
                    </div>
                ) : null}
            </div>

            {/* CS */}
            <div
                className={
                    isCompact
                        ? "hidden min-w-0 items-baseline gap-2 text-[clamp(0.68rem,0.8vw,0.85rem)] font-semibold text-[var(--muted-weak)] lg:flex"
                        : "flex flex-col gap-1"
                }
                aria-label={labels.cs.ariaLabel}
            >
                <div
                    className={
                        isCompact
                            ? "flex min-w-0 items-baseline gap-1.5"
                            : "flex items-center gap-2 text-[var(--muted-weak)]"
                    }
                >
                    <span className={isCompact ? "text-[clamp(0.6rem,0.7vw,0.75rem)] font-semibold tracking-[0.08em]" : "font-bold"}>
                        CS:
                    </span>
                    <span
                        className={
                            isCompact
                                ? "min-w-0 max-w-[7.5rem] truncate tabular-nums"
                                : "font-mono text-lg font-extrabold tabular-nums"
                        }
                        title={labels.cs.title}
                    >
                        {labels.cs.display} /g
                    </span>
                </div>
                {!isCompact ? (
                    <div className="text-xs font-normal text-[var(--muted)]">
                        (보정: {labels.cs.adjusted} /g)
                    </div>
                ) : null}
            </div>

            {isCompact ? (offlineBadge ? <div className="ml-auto shrink-0">{offlineBadge}</div> : null) : offlineBadge ? (
                <div className="flex w-full justify-center">{offlineBadge}</div>
            ) : null}
        </div>
    );
}
