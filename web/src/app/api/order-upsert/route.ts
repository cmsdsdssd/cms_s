import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isStoneSource, type StoneSource } from "@/lib/stone-source";

type OrderUpsertPayload = {
  p_is_plated?: boolean | null;
  p_plating_variant_id?: string | null;
  p_plating_color_code?: string | null;
  p_center_stone_name?: string | null;
  p_sub1_stone_name?: string | null;
  p_sub2_stone_name?: string | null;
  p_center_stone_source?: StoneSource | null;
  p_sub1_stone_source?: StoneSource | null;
  p_sub2_stone_source?: StoneSource | null;
  p_buy_margin_profile_id?: string | null;
} & Record<string, unknown>;

type LegacyOrderUpsertPayload = Omit<
  OrderUpsertPayload,
  "p_center_stone_source" | "p_sub1_stone_source" | "p_sub2_stone_source"
>;

type RpcError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

type PlatingVariantRow = {
    plating_variant_id?: string | null;
    color_code?: string | null;
    display_name?: string | null;
};

const normalizePlatingCode = (value: string) => value.replace(/[^A-Za-z]/g, "").toUpperCase();

const SOURCE_FIELD_RULES = [
  { nameKey: "p_center_stone_name", sourceKey: "p_center_stone_source" },
  { nameKey: "p_sub1_stone_name", sourceKey: "p_sub1_stone_source" },
  { nameKey: "p_sub2_stone_name", sourceKey: "p_sub2_stone_source" },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseSourceInput = (value: unknown): StoneSource | null | "INVALID" => {
  if (value === null || value === undefined || value === "") return null;
  return isStoneSource(value) ? value : "INVALID";
};

function normalizeStoneSources(payload: OrderUpsertPayload): string | null {
  for (const { nameKey, sourceKey } of SOURCE_FIELD_RULES) {
    const name = normalizeName(payload[nameKey]);
    const source = parseSourceInput(payload[sourceKey]);
    if (source === "INVALID") {
      return `${sourceKey} must be one of SELF | PROVIDED | FACTORY | null`;
    }
    if (!name) {
      payload[sourceKey] = null;
      continue;
    }
    payload[sourceKey] = source ?? "FACTORY";
  }
  return null;
}

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

const buildLegacyPayload = (payload: OrderUpsertPayload): LegacyOrderUpsertPayload => {
  const next: LegacyOrderUpsertPayload = { ...payload };
  delete next.p_center_stone_source;
  delete next.p_sub1_stone_source;
  delete next.p_sub2_stone_source;
  return next;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value.trim());

const extractOrderLineId = (data: unknown, payload: OrderUpsertPayload): string | null => {
  if (isUuid(data)) return data;
  if (isRecord(data) && isUuid(data.order_line_id)) return data.order_line_id;
  if (isUuid(payload.p_order_line_id)) return payload.p_order_line_id;
  return null;
};

const shouldSyncSources = (payload: OrderUpsertPayload) =>
  payload.p_center_stone_source !== undefined ||
  payload.p_sub1_stone_source !== undefined ||
  payload.p_sub2_stone_source !== undefined;

const shouldSyncBuyProfile = (payload: OrderUpsertPayload) => payload.p_buy_margin_profile_id !== undefined;

const syncStoneSourcesAfterLegacyUpsert = async (
  orderLineId: string,
  payload: OrderUpsertPayload
): Promise<RpcError | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return { message: "Supabase env missing for source sync" };
  }

  const updatePayload: Record<string, StoneSource | null> = {
    center_stone_source: payload.p_center_stone_source ?? null,
    sub1_stone_source: payload.p_sub1_stone_source ?? null,
    sub2_stone_source: payload.p_sub2_stone_source ?? null,
  };

  const response = await fetch(`${url}/rest/v1/cms_order_line?order_line_id=eq.${orderLineId}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updatePayload),
  });

  if (response.ok) return null;

  const text = await response.text();
  return {
    message: text || `HTTP ${response.status}`,
    code: String(response.status),
  };
};


export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const rawPayload = await request.json();
  if (!isRecord(rawPayload)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const typedPayload: OrderUpsertPayload = { ...rawPayload };
  const sourceValidationError = normalizeStoneSources(typedPayload);
  if (sourceValidationError) {
    return NextResponse.json({ error: sourceValidationError }, { status: 400 });
  }

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

  let { data, error } = await supabase.rpc("cms_fn_upsert_order_line_v6", typedPayload);

  const isFunctionNotFound =
    error?.code === "42883" ||
    error?.message?.includes("does not exist") ||
    error?.message?.includes("No function matches");

  let usedLegacyFallback = false;
  if (error && isFunctionNotFound) {
    const legacyPayload = buildLegacyPayload(typedPayload);
    const fallback = await supabase.rpc("cms_fn_upsert_order_line_v3", legacyPayload);
    data = fallback.data;
    error = fallback.error;
    usedLegacyFallback = !fallback.error;
  }

  if (!error && usedLegacyFallback && shouldSyncSources(typedPayload)) {
    const orderLineId = extractOrderLineId(data, typedPayload);
    if (!orderLineId) {
      return NextResponse.json(
        { error: "v3 fallback succeeded but order_line_id could not be resolved for stone source sync" },
        { status: 400 }
      );
    }

    const syncError = await syncStoneSourcesAfterLegacyUpsert(orderLineId, typedPayload);
    if (syncError) {
      return NextResponse.json(
        {
          error: "v3 fallback succeeded but stone source sync failed",
          details: syncError.details,
          hint: syncError.hint,
          code: syncError.code,
          sourceSyncMessage: syncError.message,
        },
        { status: 400 }
      );
    }
  }

  if (!error && shouldSyncBuyProfile(typedPayload)) {
    const orderLineId = extractOrderLineId(data, typedPayload);
    if (!orderLineId) {
      return NextResponse.json(
        { error: "order_line_id could not be resolved for buy_margin_profile sync" },
        { status: 400 }
      );
    }

    const buyMarginProfileId =
      typeof typedPayload.p_buy_margin_profile_id === "string"
        ? typedPayload.p_buy_margin_profile_id.trim() || null
        : null;

    const { error: buyProfileSyncError } = await supabase
      .from("cms_order_line")
      .update({ buy_margin_profile_id: buyMarginProfileId })
      .eq("order_line_id", orderLineId);

    if (buyProfileSyncError) {
      return NextResponse.json(
        {
          error: "order upsert succeeded but buy_margin_profile sync failed",
          details: buyProfileSyncError.details,
          hint: buyProfileSyncError.hint,
          code: buyProfileSyncError.code,
          sourceSyncMessage: buyProfileSyncError.message,
        },
        { status: 400 }
      );
    }
  }

  if (error) {
    const err = error as RpcError;
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
