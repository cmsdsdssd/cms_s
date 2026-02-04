import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OrderUpsertPayload = {
    p_is_plated?: boolean | null;
    p_plating_variant_id?: string | null;
    p_plating_color_code?: string | null;
} & Record<string, unknown>;

type PlatingVariantRow = {
    plating_variant_id?: string | null;
    color_code?: string | null;
    display_name?: string | null;
};

const normalizePlatingCode = (value: string) => value.replace(/[^A-Za-z]/g, "").toUpperCase();

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}


export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json(
            { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
            { status: 500 }
        );
    }

    const payload = await request.json();

    const typedPayload = payload as OrderUpsertPayload;
    if (typedPayload.p_is_plated && !typedPayload.p_plating_variant_id) {
        const platingCode = typedPayload.p_plating_color_code ?? null;
        if (platingCode) {
            const { data, error } = await supabase
                .from("cms_plating_variant")
                .select("plating_variant_id, color_code, display_name");
            if (error) {
                return NextResponse.json(
                    { error: error.message, details: error.details, hint: error.hint },
                    { status: 400 }
                );
            }
            const map = new Map<string, string>();
            for (const row of (data ?? []) as PlatingVariantRow[]) {
                const id = row.plating_variant_id?.trim();
                if (!id) continue;
                const candidates = [row.color_code, row.display_name]
                    .map((value) => value?.trim())
                    .filter((value): value is string => Boolean(value));
                for (const candidate of candidates) {
                    map.set(candidate, id);
                    map.set(normalizePlatingCode(candidate), id);
                }
            }
            const normalized = normalizePlatingCode(platingCode);
            let resolved = map.get(platingCode) ?? map.get(normalized) ?? null;
            if (!resolved && normalized.length > 1) {
                for (const char of normalized) {
                    const byChar = map.get(char);
                    if (byChar) {
                        resolved = byChar;
                        break;
                    }
                }
            }
            if (!resolved && map.size > 0) {
                const first = map.values().next();
                resolved = first.done ? null : first.value;
            }
            typedPayload.p_plating_variant_id = resolved;
        }
    }

    if (typedPayload.p_is_plated && !typedPayload.p_plating_variant_id) {
        return NextResponse.json(
            { error: "plating_variant_id required when is_plated=true" },
            { status: 400 }
        );
    }

    const { data, error } = await supabase.rpc("cms_fn_upsert_order_line_v3", typedPayload);

    if (error) {
        const err = error as { message: string; details?: string; hint?: string; code?: string };
        return NextResponse.json(
            {
                error: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
            },
            { status: 400 }
        );
    }

    return NextResponse.json({ data });
}
