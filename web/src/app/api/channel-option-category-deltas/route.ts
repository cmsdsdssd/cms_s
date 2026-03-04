import { NextResponse } from "next/server";
import { normalizeMaterialCode } from "@/lib/material-factors";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED = new Set(["MATERIAL", "SIZE", "COLOR_PLATING", "DECOR", "OTHER"] as const);
type CategoryKey = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";

const normalizeScopeMaterialCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeMaterialCode(trimmed);
  return normalized === "00" ? null : normalized;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  const externalProductNo = String(searchParams.get("external_product_no") ?? "").trim();

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  let query = sb
    .from("channel_option_category_delta_v1")
    .select(
      "delta_id, channel_id, master_item_id, external_product_no, category_key, scope_material_code, sync_delta_krw, updated_at",
    )
    .eq("channel_id", channelId)
    .eq("external_product_no", externalProductNo)
    .order("category_key", { ascending: true })
    .order("scope_material_code", { ascending: true })
    .order("updated_at", { ascending: false });

  if (masterItemId) query = query.eq("master_item_id", masterItemId);

  const res = await query;
  if (res.error) return jsonError(res.error.message ?? "옵션 카테고리 델타 조회 실패", 500);

  return NextResponse.json({ data: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  let masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const actor = String(body.actor ?? "SYSTEM").trim() || "SYSTEM";
  const replaceExisting = body.replace_existing !== false;
  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  if (!masterItemId) {
    const mapRes = await sb
      .from("sales_channel_product")
      .select("master_item_id")
      .eq("channel_id", channelId)
      .eq("external_product_no", externalProductNo)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mapRes.error) return jsonError(mapRes.error.message ?? "master_item_id 추론 실패", 500);
    masterItemId = String(mapRes.data?.master_item_id ?? "").trim();
  }

  if (!masterItemId) {
    const prevRes = await sb
      .from("channel_option_category_delta_v1")
      .select("master_item_id")
      .eq("channel_id", channelId)
      .eq("external_product_no", externalProductNo)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevRes.error) return jsonError(prevRes.error.message ?? "기존 저장값 기반 master_item_id 추론 실패", 500);
    masterItemId = String(prevRes.data?.master_item_id ?? "").trim();
  }

  if (!masterItemId) return jsonError("master_item_id is required (매핑 없음)", 422);

  const insertRows: Array<Record<string, unknown>> = [];
  const dedup = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseJsonObject(rowsRaw[i]);
    if (!row) return jsonError(`rows[${i}] must be object`, 400);

    const categoryKey = String(row.category_key ?? "").trim().toUpperCase() as CategoryKey;
    const scopeMaterialCode = normalizeScopeMaterialCode(row.scope_material_code);
    const syncDelta = Math.round(Number(row.sync_delta_krw ?? 0));

    if (!ALLOWED.has(categoryKey)) return jsonError(`rows[${i}].category_key is invalid`, 400);
    if (!Number.isFinite(syncDelta) || syncDelta < -1_000_000 || syncDelta > 1_000_000) {
      return jsonError(`rows[${i}].sync_delta_krw is invalid`, 400);
    }
    if (syncDelta % 1000 !== 0) {
      return jsonError(`rows[${i}].sync_delta_krw must be 1000 KRW step`, 400);
    }

    const dedupKey = `${categoryKey}::${scopeMaterialCode ?? "__DEFAULT__"}`;
    dedup.set(dedupKey, {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: externalProductNo,
      category_key: categoryKey,
      scope_material_code: scopeMaterialCode,
      sync_delta_krw: syncDelta,
      updated_by: actor,
      created_by: actor,
    });
  }

  insertRows.push(...dedup.values());

  if (replaceExisting) {
    const deleteRes = await sb
      .from("channel_option_category_delta_v1")
      .delete()
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("external_product_no", externalProductNo);
    if (deleteRes.error) return jsonError(deleteRes.error.message ?? "옵션 카테고리 델타 기존값 삭제 실패", 500);
  }

  if (insertRows.length === 0) {
    return NextResponse.json({ ok: true, data: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const insertRes = await sb
    .from("channel_option_category_delta_v1")
    .insert(insertRows)
    .select(
      "delta_id, channel_id, master_item_id, external_product_no, category_key, scope_material_code, sync_delta_krw, updated_at",
    );
  if (insertRes.error) return jsonError(insertRes.error.message ?? "옵션 카테고리 델타 저장 실패", 500);

  return NextResponse.json({ ok: true, data: insertRes.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
