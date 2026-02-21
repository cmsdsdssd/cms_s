import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

type ShippedModelRow = {
    model_name: string;
    suffix: string;
    color: string;
    material_code?: string;
    last_shipped_at?: string | null;
};

export async function GET(request: Request) {
    const schema = getSchemaClient();
    if (!schema) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_party_id");
    const keyword = searchParams.get("keyword") ?? "";

    if (!customerId) {
        return NextResponse.json({ error: "customer_party_id is required" }, { status: 400 });
    }

    let query = schema
        .from("cms_v_shipped_model_latest_v1")
        .select("model_name, suffix, color, material_code, last_shipped_at")
        .eq("customer_party_id", customerId)
        .order("last_shipped_at", { ascending: false })
        .limit(50);

    if (keyword) {
        query = query.ilike("model_name", `%${keyword}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching shipped models:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data ?? []) as unknown as ShippedModelRow[]);
}
