import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSchemaClient } from "@/lib/supabase/client";

type PlatingOption = {
    plating_variant_id: string;
    plating_type: string;
    color_code: string;
    thickness_code: string;
    display_name: string;
};

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function GET() {
    const admin = getSupabaseAdmin();
    const schema = admin ?? getSchemaClient();
    if (!schema) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await schema
        .from("cms_plating_variant")
        .select("plating_variant_id, plating_type, color_code, thickness_code, display_name")
        .order("display_name", { ascending: true });

    if (error) {
        console.error("Error fetching plating options:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedData = (data ?? []) as unknown as PlatingOption[];
    return NextResponse.json(typedData);
}
