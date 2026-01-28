import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

type PlatingOption = {
    plating_variant_id: string;
    plating_type: string;
    color_code: string;
    thickness_code: string;
    display_name: string;
};

export async function GET() {
    const schema = getSchemaClient();
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
