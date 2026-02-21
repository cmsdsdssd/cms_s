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
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSizeRaw = Number(searchParams.get("page_size") ?? "50") || 50;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
    const includeCount = ["1", "true", "yes"].includes(
        String(searchParams.get("include_count") ?? "").trim().toLowerCase()
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = schema
        .from("cms_party")
        .select("party_id, name, party_type, phone, region", {
            count: includeCount ? "exact" : undefined,
        })
        .eq("party_type", partyType)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(from, to);

    if (keyword.trim().length >= 1) {
        query = query.ilike("name", `%${keyword}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error("Error fetching parties:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedData = (data ?? []) as unknown as PartyRow[];
    return NextResponse.json({
        data: typedData,
        paging: {
            page,
            pageSize,
            count: includeCount ? (count ?? typedData.length) : undefined,
            hasMore: typedData.length === pageSize,
        },
    });
}
