import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

export async function GET() {
    try {
        const supabase = getSchemaClient();

        // Use the gold_silver view which provides both prices in one row
        const { data, error } = await supabase
            .from("cms_v_market_tick_latest_gold_silver_v1")
            .select("gold_price_krw_per_g, silver_price_krw_per_g")
            .single();

        if (error) {
            console.error("Market ticks fetch error:", error);
            return NextResponse.json(
                { error: "Failed to fetch market ticks" },
                { status: 500 }
            );
        }

        const goldPrice = data?.gold_price_krw_per_g ?? 0;
        const silverBasePrice = data?.silver_price_krw_per_g ?? 0;
        const silverPrice = silverBasePrice * 1.2;

        return NextResponse.json({
            data: {
                gold: goldPrice,
                silver: silverPrice,
                silverOriginal: silverBasePrice,
            },
        });
    } catch (error) {
        console.error("Market ticks API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch market ticks" },
            { status: 500 }
        );
    }
}
