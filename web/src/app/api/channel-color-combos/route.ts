import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizePlatingComboCode } from "@/lib/shop/rule-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ComboRow = {
  combo_id?: string;
  combo_key?: string;
  display_name?: string;
  base_delta_krw?: number;
  sort_order?: number;
  is_active?: boolean;
};

const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const toInt = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get("channel_id"));
  if (!channelId) return jsonError("channel_id is required", 400);

  const res = await sb
    .from("channel_color_combo_catalog_v1")
    .select("combo_id, combo_key, display_name, base_delta_krw, sort_order, is_active")
    .eq("channel_id", channelId)
    .order("sort_order", { ascending: true })
    .order("combo_key", { ascending: true });
  if (res.error) return jsonError(res.error.message ?? "색상 조합 목록 조회 실패", 500);

  return NextResponse.json({ data: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = toTrimmed(body.channel_id);
  if (!channelId) return jsonError("channel_id is required", 400);

  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];
  if (rowsRaw.length === 0) return jsonError("rows is required", 400);

  const upsertRows = rowsRaw.map((rawRow, index) => {
    const row = parseJsonObject(rawRow);
    if (!row) throw new Error(`rows[${index}] must be object`);
    const comboKey = normalizePlatingComboCode(String(row.combo_key ?? ""));
    if (!comboKey) throw new Error(`rows[${index}].combo_key is invalid`);
    const baseDeltaKrw = toInt(row.base_delta_krw, 0);
    if (baseDeltaKrw < 0 || baseDeltaKrw > 200000) throw new Error(`rows[${index}].base_delta_krw must be between 0 and 200000`);
    return {
      channel_id: channelId,
      combo_key: comboKey,
      display_name: toTrimmed(row.display_name) || comboKey,
      base_delta_krw: baseDeltaKrw,
      sort_order: Math.max(0, toInt(row.sort_order, index + 1)),
      is_active: row.is_active !== false,
      updated_by: toTrimmed(body.actor) || "CHANNEL_COLOR_COMBO_API",
      created_by: toTrimmed(body.actor) || "CHANNEL_COLOR_COMBO_API",
    };
  });

  const upsertRes = await sb
    .from("channel_color_combo_catalog_v1")
    .upsert(upsertRows, { onConflict: "channel_id,combo_key" })
    .select("combo_id, combo_key, display_name, base_delta_krw, sort_order, is_active");
  if (upsertRes.error) return jsonError(upsertRes.error.message ?? "색상 조합 저장 실패", 500);

  return NextResponse.json({ data: upsertRes.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
