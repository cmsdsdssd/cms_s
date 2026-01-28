"use client";

import { useEffect, useState } from "react";

export function MarketTicker() {
    const [goldPrice, setGoldPrice] = useState<number | null>(null);
    const [silverPrice, setSilverPrice] = useState<number | null>(null);
    const [silverOriginal, setSilverOriginal] = useState<number | null>(null);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const response = await fetch("/api/market-ticks");
                const result = (await response.json()) as {
                    data?: { gold: number; silver: number; silverOriginal: number };
                    error?: string;
                };
                if (result.data) {
                    setGoldPrice(result.data.gold);
                    setSilverPrice(result.data.silver);
                    setSilverOriginal(result.data.silverOriginal);
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
        <div className="flex items-center justify-center gap-6 text-base font-bold">
            <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: "#D4AF37" }}>
                    금시세:
                </span>
                <span className="font-mono text-lg font-extrabold" style={{ color: "#D4AF37" }}>
                    {formatPrice(goldPrice)} /g
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: "#C0C0C0" }}>
                    수정된 은시세:
                </span>
                <span className="font-mono text-lg font-extrabold" style={{ color: "#C0C0C0" }}>
                    {formatPrice(silverPrice)} /g
                </span>
                <span className="text-xs font-normal" style={{ color: "#C0C0C0" }}>
                    (은시세: {formatPrice(silverOriginal)} /g)
                </span>
            </div>
        </div>
    );
}
