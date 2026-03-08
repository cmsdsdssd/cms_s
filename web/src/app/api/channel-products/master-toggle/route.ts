import { NextResponse } from "next/server";
// keep
import { getShopAdminClient, isMissingColumnError, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate_keep = 0;
export const revalidate = 0;

const parseCurrentProductSyncProfile = (value: unknown) => {
  const profile = String(value == null ? "GENERAL" : value).trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("current_product_sync_profile must be GENERAL/MARKET_LINKED");
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const hasIncludeMasterPlatingLabor = Object.prototype.hasOwnProperty.call(body, "include_master_plating_labor");
  const includeMasterPlatingLabor = body.include_master_plating_labor === true;
  const hasCurrentProductSyncProfile = Object.prototype.hasOwnProperty.call(body, "current_product_sync_profile");

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!hasIncludeMasterPlatingLabor && !hasCurrentProductSyncProfile) {
    return jsonError("at least one update field is required", 400);
  }

  const updatePayload: Record<string, unknown> = {};
  if (hasIncludeMasterPlatingLabor) {
    updatePayload.include_master_plating_labor = includeMasterPlatingLabor;
  }
  if (hasCurrentProductSyncProfile) {
    try {
      updatePayload.current_product_sync_profile = parseCurrentProductSyncProfile(body.current_product_sync_profile);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid current_product_sync_profile", 400);
    }
  }

  const runUpdate = (payload: Record<string, unknown>) => sb
    .from("sales_channel_product")
    .update(payload)
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .select("channel_product_id");

  let { data, error } = await runUpdate(updatePayload);
  if (error && hasCurrentProductSyncProfile && isMissingColumnError(error, "sales_channel_product.current_product_sync_profile")) {
    delete updatePayload.current_product_sync_profile;
    if (Object.keys(updatePayload).length === 0) {
      data = [];
      error = null;
    } else {
      ({ data, error } = await runUpdate(updatePayload));
    }
  }

  if (error) {
    return jsonError(error.message ?? "마스터 동기화 설정 저장 실패", 400);
  }

  return NextResponse.json(
    {
      ok: true,
      updated: data?.length ?? 0,
      channel_id: channelId,
      master_item_id: masterItemId,
      include_master_plating_labor: hasIncludeMasterPlatingLabor ? includeMasterPlatingLabor : undefined,
      current_product_sync_profile: updatePayload.current_product_sync_profile ?? undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
