"use client";

import { useEffect, useState } from "react";

export function MarketTicker() {
    const [kg, setKg] = useState<number | null>(null);
    const [ks, setKs] = useState<number | null>(null);
    const [ksOriginal, setKsOriginal] = useState<number | null>(null);
    const [cs, setCs] = useState<number | null>(null);
    const [csOriginal, setCsOriginal] = useState<number | null>(null);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const response = await fetch("/api/market-ticks");
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
                }
            } catch (error) {
                console.error("Failed to fetch market ticks:", error);
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

    return (
        <div className="flex flex-wrap items-start justify-center gap-8 text-base font-bold">
            {/* KG */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: "#D4AF37" }}>
                        KG:
                    </span>
                    <span className="font-mono text-lg font-extrabold" style={{ color: "#D4AF37" }}>
                        {formatPrice(kg)} /g
                    </span>
                </div>
            </div>

            {/* KS */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: "#C0C0C0" }}>
                        KS:
                    </span>
                    <span className="font-mono text-lg font-extrabold" style={{ color: "#C0C0C0" }}>
                        {formatPrice(ks)} /g
                    </span>
                </div>
                <div className="text-xs font-normal" style={{ color: "#9CA3AF" }}>
                    (원래 은시세: {formatPrice(ksOriginal)} /g)
                </div>
            </div>

            {/* CS */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: "#6B7280" }}>
                        CS:
                    </span>
                    <span className="font-mono text-lg font-extrabold" style={{ color: "#6B7280" }}>
                        {formatPrice(cs)} /g
                    </span>
                </div>
                <div className="text-xs font-normal" style={{ color: "#9CA3AF" }}>
                    (보정전: {formatPrice(csOriginal)} /g)
                </div>
            </div>
        </div>
    );
}
