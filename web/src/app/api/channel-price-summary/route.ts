import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActivePolicyRow = {
  policy_id: string;
  margin_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
  material_factor_set_id: string | null;
};

type FactorSetRow = {
  factor_set_id: string;
  scope: "GLOBAL" | "CHANNEL";
  name: string;
};

type LatestRow = {
  as_of_at: string | null;
  channel_price_fetched_at: string | null;
  computed_at: string | null;
  tick_gold_krw_g: number | null;
  tick_silver_krw_g: number | null;
};

function toNum(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const [
    totalRows,
    okRows,
    outOfSyncRows,
    errorRows,
    overrideRows,
    adjustmentRows,
    latestRowsRes,
    latestPushRes,
    activePolicyRes,
    globalDefaultRes,
  ] = await Promise.all([
    sb.from("v_channel_price_dashboard").select("channel_id", { count: "exact", head: true }).eq("channel_id", channelId),
    sb
      .from("v_channel_price_dashboard")
      .select("channel_id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .eq("price_state", "OK"),
    sb
      .from("v_channel_price_dashboard")
      .select("channel_id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .eq("price_state", "OUT_OF_SYNC"),
    sb
      .from("v_channel_price_dashboard")
      .select("channel_id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .eq("price_state", "ERROR"),
    sb
      .from("v_channel_price_dashboard")
      .select("channel_id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .not("active_override_id", "is", null),
    sb
      .from("v_channel_price_dashboard")
      .select("channel_id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .gt("active_adjustment_count", 0),
    sb
      .from("v_channel_price_dashboard")
      .select("as_of_at,channel_price_fetched_at,computed_at,tick_gold_krw_g,tick_silver_krw_g")
      .eq("channel_id", channelId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle<LatestRow>(),
    sb
      .from("price_sync_job")
      .select("finished_at,started_at")
      .eq("channel_id", channelId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ finished_at: string | null; started_at: string | null }>(),
    sb
      .from("pricing_policy")
      .select("policy_id,margin_multiplier,rounding_unit,rounding_mode,material_factor_set_id")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<ActivePolicyRow>(),
    sb
      .from("material_factor_set")
      .select("factor_set_id,scope,name")
      .eq("scope", "GLOBAL")
      .eq("is_global_default", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<FactorSetRow>(),
  ]);

  const countErrors = [totalRows, okRows, outOfSyncRows, errorRows, overrideRows, adjustmentRows].find((r) => r.error);
  if (countErrors?.error) return jsonError(countErrors.error.message ?? "요약 카운트 조회 실패", 500);
  if (latestRowsRes.error) return jsonError(latestRowsRes.error.message ?? "최신 시각 조회 실패", 500);
  if (latestPushRes.error) return jsonError(latestPushRes.error.message ?? "최신 push 조회 실패", 500);
  if (activePolicyRes.error) return jsonError(activePolicyRes.error.message ?? "활성 정책 조회 실패", 500);
  if (globalDefaultRes.error) return jsonError(globalDefaultRes.error.message ?? "글로벌 기본 factor 조회 실패", 500);

  const activePolicy = activePolicyRes.data;
  const globalDefault = globalDefaultRes.data;

  let activeFactorSet: FactorSetRow | null = null;
  if (activePolicy?.material_factor_set_id) {
    const factorRes = await sb
      .from("material_factor_set")
      .select("factor_set_id,scope,name")
      .eq("factor_set_id", activePolicy.material_factor_set_id)
      .limit(1)
      .maybeSingle<FactorSetRow>();
    if (factorRes.error) return jsonError(factorRes.error.message ?? "활성 factor set 조회 실패", 500);
    activeFactorSet = factorRes.data;
  } else {
    activeFactorSet = globalDefault;
  }

  const factorSource = activePolicy?.material_factor_set_id
    ? "CHANNEL_POLICY"
    : globalDefault
      ? "GLOBAL_DEFAULT"
      : "SYSTEM_DEFAULT";

  return NextResponse.json(
    {
      data: {
        channel_id: channelId,
        counts: {
          total: toNum(totalRows.count),
          ok: toNum(okRows.count),
          out_of_sync: toNum(outOfSyncRows.count),
          error: toNum(errorRows.count),
          override: toNum(overrideRows.count),
          adjustment: toNum(adjustmentRows.count),
        },
        freshness: {
          tick_as_of: latestRowsRes.data?.as_of_at ?? null,
          last_pull_at: latestRowsRes.data?.channel_price_fetched_at ?? null,
          last_recompute_at: latestRowsRes.data?.computed_at ?? null,
          last_push_at: latestPushRes.data?.finished_at ?? latestPushRes.data?.started_at ?? null,
        },
        market: {
          gold_krw_g: latestRowsRes.data?.tick_gold_krw_g ?? null,
          silver_krw_g: latestRowsRes.data?.tick_silver_krw_g ?? null,
        },
        policy: {
          policy_id: activePolicy?.policy_id ?? null,
          margin_multiplier: activePolicy?.margin_multiplier ?? 1,
          rounding_unit: activePolicy?.rounding_unit ?? 1000,
          rounding_mode: activePolicy?.rounding_mode ?? "CEIL",
        },
        factor: {
          source: factorSource,
          factor_set_id: activeFactorSet?.factor_set_id ?? null,
          factor_set_name: activeFactorSet?.name ?? null,
          factor_scope: activeFactorSet?.scope ?? null,
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
