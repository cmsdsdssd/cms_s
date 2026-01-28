import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

type ShippedModelRow = {
    model_name: string;
    suffix: string;
    color: string;
    material_code?: string;
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

    // Query shipment lines for this customer with distinct model names
    let query = schema
        .from("cms_shipment_line")
        .select(`
      model_name,
      suffix,
      color,
      material_code,
      cms_shipment_header!inner(customer_party_id)
    `)
        .eq("cms_shipment_header.customer_party_id", customerId)
        .order("model_name", { ascending: true });

    if (keyword) {
        query = query.ilike("model_name", `%${keyword}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching shipped models:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduplicate by model_name (keep first occurrence)
    const seen = new Set<string>();
    const unique: ShippedModelRow[] = [];
    for (const row of (data ?? []) as unknown as ShippedModelRow[]) {
        if (!seen.has(row.model_name)) {
            seen.add(row.model_name);
            unique.push({
                model_name: row.model_name,
                suffix: row.suffix,
                color: row.color,
                material_code: row.material_code,
            });
        }
    }

    return NextResponse.json(unique.slice(0, 50));
}
