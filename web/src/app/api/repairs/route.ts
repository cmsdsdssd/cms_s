import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";

type RepairLineRow = {
    repair_line_id: string;
    customer_party_id: string;
    customer_name: string;
    received_at: string;
    model_name: string;
    model_name_raw?: string;
    suffix: string;
    color: string;
    material_code?: string;
    qty: number;
    measured_weight_g?: number;
    is_plated: boolean;
    plating_variant_id?: string;
    plating_code?: string;
    plating_display_name?: string;
    repair_fee_krw?: number;
    requested_due_date?: string;
    priority_code?: string;
    status: string;
    memo?: string;
    source_channel?: string;
    correlation_id?: string;
    created_at: string;
    updated_at: string;
};

export async function GET(request: Request) {
    const schema = getSchemaClient();
    if (!schema) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const customerId = searchParams.get("customer_party_id");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const keyword = searchParams.get("keyword");

    let query = schema
        .from(CONTRACTS.views.repairsEnriched)
        .select("*")
        .order("received_at", { ascending: false });

    // Filter by status (comma-separated for multi-select)
    if (status) {
        const statuses = status.split(",").filter(Boolean);
        if (statuses.length > 0) {
            query = query.in("status", statuses);
        }
    }

    // Filter by priority (comma-separated for multi-select)
    if (priority) {
        const priorities = priority.split(",").filter(Boolean);
        if (priorities.length > 0) {
            query = query.in("priority_code", priorities);
        }
    }

    // Filter by customer
    if (customerId) {
        query = query.eq("customer_party_id", customerId);
    }

    // Filter by date range
    if (fromDate) {
        query = query.gte("received_at", fromDate);
    }
    if (toDate) {
        query = query.lte("received_at", toDate);
    }

    // Filter by keyword (model_name, model_name_raw, memo)
    if (keyword) {
        query = query.or(
            `model_name.ilike.%${keyword}%,model_name_raw.ilike.%${keyword}%,memo.ilike.%${keyword}%`
        );
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching repairs:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cast data to typed array and sort by priority (VVIP > URGENT > NORMAL), then by received_at desc
    const typedData = (data ?? []) as unknown as RepairLineRow[];
    const priorityOrder: Record<string, number> = { VVIP: 0, URGENT: 1, NORMAL: 2 };
    const sorted = typedData.sort((a, b) => {
        const pA = priorityOrder[a.priority_code ?? "NORMAL"] ?? 99;
        const pB = priorityOrder[b.priority_code ?? "NORMAL"] ?? 99;
        if (pA !== pB) return pA - pB;
        return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });

    return NextResponse.json(sorted);
}

