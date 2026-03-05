import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED = new Set(["MATERIAL", "SIZE", "COLOR_PLATING", "DECOR", "OTHER"] as const);

type CategoryKey = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";

const normalizeOptionValue = (value: string) =>
  String(value ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

const resolveCanonicalExternalProductNo = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  masterItemId: string,
  requestedExternalProductNo: string,
): Promise<string> => {
  const requested = String(requestedExternalProductNo ?? "").trim();
  if (!requested || !masterItemId) return requested;

  const aliasRes = await sb
    .from("sales_channel_product")
    .select("external_product_no")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (aliasRes.error) throw new Error(aliasRes.error.message ?? "활성 별칭 매핑 조회 실패");

  const activeProductNos = Array.from(
    new Set((aliasRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim()).filter(Boolean)),
  );
  if (activeProductNos.length === 0) return requested;
  if (activeProductNos.includes(requested)) return requested;
  return activeProductNos.find((value) => /^P/i.test(value)) ?? activeProductNos[0] ?? requested;
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
    .from("channel_option_category_v2")
    .select(
      "category_id, channel_id, master_item_id, external_product_no, option_name, option_value, category_key, sync_delta_krw, updated_at",
    )
    .eq("channel_id", channelId)
    .eq("external_product_no", externalProductNo)
    .order("updated_at", { ascending: false })
    .order("option_name", { ascending: true })
    .order("option_value", { ascending: true });

  if (masterItemId) query = query.eq("master_item_id", masterItemId);

  const res = await query;
  if (res.error) return jsonError(res.error.message ?? "옵션 카테고리 조회 실패", 500);

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
  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);
  if (rowsRaw.length === 0) return jsonError("rows is required", 400);

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
      .from("channel_option_category_v2")
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

  let resolvedExternalProductNo = externalProductNo;
  try {
    resolvedExternalProductNo = await resolveCanonicalExternalProductNo(sb, channelId, masterItemId, externalProductNo);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "활성 별칭 매핑 조회 실패", 500);
  }

  const upsertRows: Array<Record<string, unknown>> = [];
  const categoryByOptionName = new Map<string, CategoryKey>();

  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseJsonObject(rowsRaw[i]);
    if (!row) return jsonError(`rows[${i}] must be object`, 400);

    const optionName = String(row.option_name ?? "").trim();
    const optionValue = normalizeOptionValue(String(row.option_value ?? "").trim());
    const categoryKey = String(row.category_key ?? "").trim().toUpperCase() as CategoryKey;
    const syncDelta = Math.round(Number(row.sync_delta_krw ?? 0));

    if (!optionName) return jsonError(`rows[${i}].option_name is required`, 400);
    if (!optionValue) return jsonError(`rows[${i}].option_value is required`, 400);
    if (!ALLOWED.has(categoryKey)) return jsonError(`rows[${i}].category_key is invalid`, 400);
    if (!Number.isFinite(syncDelta) || syncDelta < -1_000_000 || syncDelta > 1_000_000) {
      return jsonError(`rows[${i}].sync_delta_krw is invalid`, 400);
    }
    if (syncDelta % 1000 !== 0) {
      return jsonError(`rows[${i}].sync_delta_krw must be 1000 KRW step`, 400);
    }

    const prevCategory = categoryByOptionName.get(optionName);
    if (prevCategory && prevCategory !== categoryKey) {
      return jsonError(`rows[${i}].category_key conflicts within same option_name`, 400);
    }
    categoryByOptionName.set(optionName, categoryKey);

    upsertRows.push({
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: resolvedExternalProductNo,
      option_name: optionName,
      option_value: optionValue,
      category_key: categoryKey,
      sync_delta_krw: syncDelta,
      updated_by: actor,
      created_by: actor,
    });
  }

  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of upsertRows) {
    const key = `${row.option_name}::${row.option_value}`;
    dedup.set(key, row);
  }

  const res = await sb
    .from("channel_option_category_v2")
    .upsert(Array.from(dedup.values()), {
      onConflict: "channel_id,master_item_id,external_product_no,option_name,option_value",
    })
    .select(
      "category_id, channel_id, master_item_id, external_product_no, option_name, option_value, category_key, sync_delta_krw, updated_at",
    );

  if (res.error) return jsonError(res.error.message ?? "옵션 카테고리 저장 실패", 500);

  return NextResponse.json({ ok: true, data: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
