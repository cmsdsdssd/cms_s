import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

type PartyRow = {
    party_id: string;
    name: string;
    party_type: string;
    phone?: string;
    region?: string;
};

export async function GET(request: Request) {
    const schema = getSchemaClient();
    if (!schema) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") ?? "";
    const partyType = searchParams.get("type") ?? "customer";

    let query = schema
        .from("cms_party")
        .select("party_id, name, party_type, phone, region")
        .eq("party_type", partyType)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(50);

    if (keyword) {
        query = query.ilike("name", `%${keyword}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching parties:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedData = (data ?? []) as unknown as PartyRow[];
    return NextResponse.json(typedData);
}
