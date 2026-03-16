import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";
import { buildMissingActiveMappingSummary, resolveNoIntentsReason } from "@/lib/shop/price-sync-run-summary";
import {
  buildAutoSyncPressureStateRow,
  evaluateAutoSyncPressurePolicy,
  normalizeAutoSyncPressureState,
  resolveAutoSyncPressurePolicyConfig,
} from "@/lib/shop/price-sync-pressure-policy";
import {
  normalizeOptionAdditionalSyncPolicy,
  normalizePriceSyncPolicy,
  normalizePriceSyncThresholdProfile,
  resolveEffectiveOptionAdditionalMinChangeKrw,
  resolvePriceSyncThresholdProfilePolicy,
  resolveRateDerivedThresholdKrw,
  shouldSyncOptionAdditionalChange,
  shouldSyncPriceChange,
} from "@/lib/shop/price-sync-policy";
import { buildCurrentProductSyncProfileByMaster } from "@/lib/shop/current-product-sync-profile";
import { loadPublishedPriceStateByVersion } from "@/lib/shop/publish-price-state";
import { parseCafe24VariantAdditionalAmountFromRaw } from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const makeIdempotencyKey = (parts: Array<string | number>) => parts.map((v) => String(v ?? "").trim()).join(":");
const TERMINAL_RUN_STATUSES = ["SUCCESS", "PARTIAL", "FAILED", "CANCELLED"] as const;
const IN_QUERY_CHUNK_SIZE = 500;
const INSERT_CHUNK_SIZE = 1000;
const CRON_TICK_ERROR_PREFIX = "CRON_TICK:";

const isNumericProductNo = (productNo: string) => /^\d+$/u.test(String(productNo ?? "").trim());
const looksCanonicalProductCode = (productNo: string) => /^P/i.test(String(productNo ?? "").trim());

const shouldPreferMappingProductNo = (currentProductNo: string, nextProductNo: string): boolean => {
  const current = String(currentProductNo ?? "").trim();
  const next = String(nextProductNo ?? "").trim();
  if (!current && next) return true;
  if (!next) return false;
  const currentNumeric = isNumericProductNo(current);
  const nextNumeric = isNumericProductNo(next);
  if (nextNumeric !== currentNumeric) return nextNumeric;
  const currentCanonical = looksCanonicalProductCode(current);
  const nextCanonical = looksCanonicalProductCode(next);
  if (nextCanonical !== currentCanonical) return nextCanonical;
  return next.localeCompare(current) < 0;
};

const toMs = (value: unknown): number | null => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const isCronTickError = (value: unknown): boolean =>
  String(value ?? "").trim().toUpperCase().startsWith(CRON_TICK_ERROR_PREFIX);

const toPositiveInt = (value: unknown, fallback: number, max = 10000): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
};

const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "y" || normalized === "yes";
};

type AutoSyncPolicyInput = {
  auto_sync_force_full?: unknown;
  auto_sync_min_change_krw?: unknown;
  auto_sync_min_change_rate?: unknown;
  auto_sync_threshold_profile?: unknown;
};

type ActivePricingOverrideRow = {
  override_id: string | null;
  master_item_id: string | null;
  override_price_krw: number | null;
  reason: string | null;
  valid_from: string | null;
  valid_to: string | null;
  updated_at: string | null;
};

type ActiveFloorGuardRow = {
  guard_id: string | null;
  master_item_id: string | null;
  floor_price_krw: number | null;
  floor_source: string | null;
  effective_from: string | null;
  effective_to: string | null;
  updated_at: string | null;
};

type ActiveMappingRow = {
  channel_product_id: string | null;
  master_item_id: string | null;
  external_product_no: string | null;
  external_variant_code: string | null;
  current_product_sync_profile: string | null;
};

type PreferredMasterTarget = {
  productNo: string;
  target: number;
};

type IntentDecisionContext = {
  threshold_profile: string;
  current_price_krw: number | null;
  base_target_price_krw: number;
  market_uplift_price_krw: number | null;
  pricing_override_id: string | null;
  pricing_override_price_krw: number | null;
  floor_guard_id: string | null;
  floor_price_krw: number;
  final_desired_price_krw: number;
  floor_applied: boolean;
  option_sync_mode?: "BASE_TOTAL" | "OPTION_ADDITIONAL" | null;
  option_additional_target_krw?: number | null;
  option_additional_current_krw?: number | null;
  option_additional_out_of_sync?: boolean;
  option_additional_threshold_delta_krw?: number | null;
  option_effective_threshold_krw?: number | null;
  option_threshold_passed?: boolean | null;
  option_threshold_reason?: string | null;
};

const isActiveDuringWindow = ({
  startsAt,
  endsAt,
  nowMs,
}: {
  startsAt?: unknown;
  endsAt?: unknown;
  nowMs: number;
}): boolean => {
  const startsAtMs = toMs(startsAt);
  if (startsAtMs !== null && startsAtMs > nowMs) return false;
  const endsAtMs = toMs(endsAt);
  if (endsAtMs !== null && endsAtMs < nowMs) return false;
  return true;
};

const selectLatestByMasterItemId = <T extends { master_item_id?: unknown }>(rows: T[]): Map<string, T> => {
  const next = new Map<string, T>();
  for (const row of rows) {
    const masterItemId = String(row.master_item_id ?? "").trim();
    if (!masterItemId || next.has(masterItemId)) continue;
    next.set(masterItemId, row);
  }
  return next;
};

const roundByMode = (value: number, unit: number, mode: "CEIL" | "ROUND" | "FLOOR") => {
  if (!Number.isFinite(value)) return 0;
  const safeUnit = Number.isFinite(unit) && unit > 0 ? unit : 1;
  const q = value / safeUnit;
  if (mode === "FLOOR") return Math.floor(q) * safeUnit;
  if (mode === "ROUND") return Math.round(q) * safeUnit;
  return Math.ceil(q) * safeUnit;
};

const resolveRunningStaleWindowMs = (): number => {
  const staleMinutes = toPositiveInt(process.env.SHOP_SYNC_RUNNING_STALE_MINUTES, 360, 7 * 24 * 60);
  return staleMinutes * 60 * 1000;
};

const resolveIntervalEarlyGraceMs = (): number => {
  const graceSeconds = toPositiveInt(process.env.SHOP_SYNC_INTERVAL_EARLY_GRACE_SECONDS, 30, 300);
  return graceSeconds * 1000;
};
const resolveDefaultIntervalMinutes = (): number => {
  return toPositiveInt(process.env.SHOP_SYNC_DEFAULT_INTERVAL_MINUTES, 60, 60);
};

const resolveMinChangeThresholdKrw = (): number => {
  return toPositiveInt(process.env.SHOP_SYNC_MIN_CHANGE_KRW, 5000, 10_000_000);
};

const normalizeAutoSyncPolicy = (policy: AutoSyncPolicyInput) => {
  const thresholdProfile = normalizePriceSyncThresholdProfile(policy.auto_sync_threshold_profile);
  const profileDefaults = resolvePriceSyncThresholdProfilePolicy(thresholdProfile);
  const normalized = normalizePriceSyncPolicy(
    {
      always_sync: policy.auto_sync_force_full,
      min_change_krw: policy.auto_sync_min_change_krw,
      min_change_rate: policy.auto_sync_min_change_rate,
    },
    profileDefaults,
  );

  return {
    thresholdProfile,
    forceFullSync: normalized.always_sync,
    minChangeKrw: normalized.min_change_krw,
    minChangeRate: normalized.min_change_rate,
  };
};

const normalizeRequestedAutoSyncOverrides = (overrides: {
  min_change_krw?: unknown;
  min_change_rate?: unknown;
}) => {
  const hasRequestedMinChangeKrw = overrides.min_change_krw !== undefined;
  const requestedMinChangeKrwNumber = hasRequestedMinChangeKrw ? Number(overrides.min_change_krw) : undefined;
  if (
    hasRequestedMinChangeKrw
    && (requestedMinChangeKrwNumber === undefined || !Number.isFinite(requestedMinChangeKrwNumber) || requestedMinChangeKrwNumber < 0)
  ) {
    return { error: "min_change_krw must be >= 0" } as const;
  }

  const hasRequestedMinChangeRate = overrides.min_change_rate !== undefined;
  const requestedMinChangeRateNumber = hasRequestedMinChangeRate ? Number(overrides.min_change_rate) : undefined;
  if (
    hasRequestedMinChangeRate
    && (
      requestedMinChangeRateNumber === undefined
      || !Number.isFinite(requestedMinChangeRateNumber)
      || requestedMinChangeRateNumber < 0
      || requestedMinChangeRateNumber > 1
    )
  ) {
    return { error: "min_change_rate must be between 0 and 1" } as const;
  }

  const normalizedOverrides = normalizePriceSyncPolicy(
    {
      min_change_krw: hasRequestedMinChangeKrw ? requestedMinChangeKrwNumber : undefined,
      min_change_rate: hasRequestedMinChangeRate ? requestedMinChangeRateNumber : undefined,
    },
    {
      min_change_krw: resolveMinChangeThresholdKrw(),
      min_change_rate: 0.02,
    },
  );

  return {
    minChangeKrw: hasRequestedMinChangeKrw ? normalizedOverrides.min_change_krw : undefined,
    minChangeRate: hasRequestedMinChangeRate ? normalizedOverrides.min_change_rate : undefined,
  } as const;
};

const evaluateAutoSyncThreshold = ({
  currentPriceKrw,
  desiredPriceKrw,
  policy,
}: {
  currentPriceKrw: number;
  desiredPriceKrw: number;
  policy: AutoSyncPolicyInput;
}) => {
  const normalizedPolicy = normalizeAutoSyncPolicy(policy);
  const result = shouldSyncPriceChange({
    currentPriceKrw,
    nextPriceKrw: desiredPriceKrw,
    policy: {
      always_sync: normalizedPolicy.forceFullSync,
      min_change_krw: normalizedPolicy.minChangeKrw,
      min_change_rate: normalizedPolicy.minChangeRate,
    },
  });
  const rateThresholdKrw = resolveRateDerivedThresholdKrw({
    currentPriceKrw,
    policy: { min_change_rate: normalizedPolicy.minChangeRate },
  });

  return {
    thresholdProfile: normalizedPolicy.thresholdProfile,
    forceFullSync: normalizedPolicy.forceFullSync,
    minChangeKrw: normalizedPolicy.minChangeKrw,
    minChangeRate: normalizedPolicy.minChangeRate,
    diffKrw: result.price_delta_krw,
    rateThresholdKrw,
    effectiveThresholdKrw: result.effective_min_change_krw,
    bypassedByAlwaysSync: result.threshold_bypassed,
    passesThreshold: result.should_sync,
  };
};

const evaluateOptionAdditionalThreshold = ({
  currentAdditionalKrw,
  targetAdditionalKrw,
  policy,
}: {
  currentAdditionalKrw: number;
  targetAdditionalKrw: number;
  policy: { always_sync?: unknown; min_change_krw?: unknown; min_change_rate?: unknown };
}) => {
  const normalizedPolicy = normalizeOptionAdditionalSyncPolicy(policy);
  const threshold = resolveEffectiveOptionAdditionalMinChangeKrw({
    currentAdditionalKrw,
    policy: normalizedPolicy,
  });
  const result = shouldSyncOptionAdditionalChange({
    currentAdditionalKrw,
    nextAdditionalKrw: targetAdditionalKrw,
    policy: normalizedPolicy,
  });
  return {
    forceFullSync: normalizedPolicy.always_sync,
    minChangeKrw: normalizedPolicy.min_change_krw,
    minChangeRate: normalizedPolicy.min_change_rate,
    diffKrw: result.additional_delta_krw,
    flatThresholdKrw: threshold.flatMinChangeKrw,
    rateThresholdKrw: threshold.rateMinChangeKrw,
    effectiveThresholdKrw: threshold.effectiveMinChangeKrw,
    bypassedByAlwaysSync: result.threshold_bypassed,
    passesThreshold: result.should_sync,
  };
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

const pickMostRecentByStartedAt = <T extends { started_at?: unknown }>(rows: T[]): T | null => {
  let best: T | null = null;
  let bestMs = -1;
  for (const row of rows) {
    const ms = toMs(row.started_at);
    if (ms === null) continue;
    if (ms > bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

  const runsRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, channel_id, pinned_compute_request_id, interval_minutes, trigger_type, status, total_count, success_count, failed_count, skipped_count, started_at, finished_at, error_message, request_payload, created_at")
    .eq("channel_id", channelId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (runsRes.error) return jsonError(runsRes.error.message ?? "?癒?짗??녿┛??run 鈺곌퀬????쎈솭", 500);

  const activeMapRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, current_product_sync_profile")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (activeMapRes.error) return jsonError(activeMapRes.error.message ?? "active mapping 조회 실패", 500);

  const scheduleRes = await sb
    .from("price_sync_master_schedule_v1")
    .select("master_item_id, effective_sync_profile, cadence_minutes, next_due_at, last_evaluated_at")
    .eq("channel_id", channelId);
  const scheduleRows = scheduleRes.error ? [] : (scheduleRes.data ?? []);

  const leaseRes = await sb
    .from("price_sync_scheduler_lease_v1")
    .select("channel_id, owner_token, lease_expires_at, last_tick_started_at, last_tick_finished_at, last_tick_status, last_tick_error, updated_at")
    .eq("channel_id", channelId)
    .maybeSingle();
  const lease = leaseRes.error ? null : (leaseRes.data ?? null);

  const nowIso = new Date().toISOString();
  const activeMapRows = activeMapRes.data ?? [];
  const activeMasterIds = Array.from(new Set(activeMapRows.map((row) => String(row.master_item_id ?? "").trim()).filter(Boolean)));
  const profileByMaster = buildCurrentProductSyncProfileByMaster(activeMapRows as ActiveMappingRow[]);
  const dueMasterIds = activeMasterIds.filter((masterItemId) => {
    const scheduleRow = scheduleRows.find((row) => String(row.master_item_id ?? "").trim() === masterItemId) ?? null;
    if (!scheduleRow) return true;
    const nextDueAtMs = toMs(scheduleRow.next_due_at);
    return nextDueAtMs === null || nextDueAtMs <= Date.parse(nowIso);
  });
  const dueProfileCounts = dueMasterIds.reduce<Record<string, number>>((acc, masterItemId) => {
    const profile = String(profileByMaster.get(masterItemId) ?? "GENERAL").trim() || "GENERAL";
    acc[profile] = (acc[profile] ?? 0) + 1;
    return acc;
  }, {});

  const runs = (runsRes.data ?? []).map((row) => {
    const payload = row.request_payload && typeof row.request_payload === "object" && !Array.isArray(row.request_payload)
      ? (row.request_payload as Record<string, unknown>)
      : null;
    const scopeMasterItemIds = payload && Array.isArray(payload.scope_master_item_ids)
      ? payload.scope_master_item_ids.filter((value): value is string => typeof value === "string")
      : [];
    const schedulerReason = payload ? String(payload.scheduler_reason ?? "").trim() || null : null;
    return {
      ...row,
      publish_version: row.pinned_compute_request_id,
      due_master_count: scopeMasterItemIds.length || null,
      scheduler_reason: schedulerReason,
    };
  });

  return NextResponse.json({
    data: runs,
    scheduler: {
      active_master_count: activeMasterIds.length,
      scheduled_master_count: scheduleRows.length,
      due_master_count: dueMasterIds.length,
      due_profile_counts: dueProfileCounts,
      lease,
      migration_ready: !scheduleRes.error && !leaseRes.error,
      migration_error: scheduleRes.error?.message ?? leaseRes.error?.message ?? null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const intervalRaw = Number(body.interval_minutes ?? resolveDefaultIntervalMinutes());
  const intervalMinutes = Number.isFinite(intervalRaw)
    ? Math.max(1, Math.min(60, Math.floor(intervalRaw)))
    : resolveDefaultIntervalMinutes();
  const normalizedRequestedOverrides = normalizeRequestedAutoSyncOverrides({
    min_change_krw: body.min_change_krw,
    min_change_rate: body.min_change_rate,
  });
  if ("error" in normalizedRequestedOverrides && typeof normalizedRequestedOverrides.error === "string") {
    return jsonError(normalizedRequestedOverrides.error, 400);
  }
  const requestedMinChangeKrwValue = normalizedRequestedOverrides.minChangeKrw;
  const requestedMinChangeRateValue = normalizedRequestedOverrides.minChangeRate;
  const requestedForceFullSync = toBool(body.force_full_sync ?? false);
  const requestedForceFullSyncSource = String(body.force_full_sync_source ?? "").trim().toUpperCase();
  const runningStaleWindowMs = resolveRunningStaleWindowMs();
  const triggerType = String(body.trigger_type ?? "AUTO").trim().toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO";
  const pressurePolicyConfig = resolveAutoSyncPressurePolicyConfig();
  const masterItemIds = parseUuidArray(body.master_item_ids);
  const pinnedComputeRequestId = String(body.compute_request_id ?? "").trim();

  const nowMs = Date.now();

  const runningRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, status, started_at")
    .eq("channel_id", channelId)
    .eq("status", "RUNNING")
    .order("started_at", { ascending: false })
    .limit(10);
  if (runningRes.error) return jsonError(runningRes.error.message ?? "running run 鈺곌퀬????쎈솭", 500);

  const activeRunning = (runningRes.data ?? []).find((row) => {
    const startedAtMs = toMs(row.started_at);
    if (startedAtMs === null) return true;
    return nowMs - startedAtMs <= runningStaleWindowMs;
  });
  if (activeRunning) {
    return NextResponse.json(
      {
        ok: true,
        run_id: String(activeRunning.run_id ?? "").trim(),
        skipped: true,
        skip_reason: "OVERLAP_RUNNING",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const recentRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, status, started_at, error_message")
    .eq("channel_id", channelId)
    .in("status", [...TERMINAL_RUN_STATUSES])
    .order("started_at", { ascending: false })
    .limit(20);
  if (recentRes.error) return jsonError(recentRes.error.message ?? "筌ㅼ뮄??run 鈺곌퀬????쎈솭", 500);

  const recentNonTickRows = (recentRes.data ?? []).filter((row) => !isCronTickError((row as { error_message?: unknown }).error_message));
  const latestTerminal = pickMostRecentByStartedAt(recentNonTickRows);
  if (latestTerminal) {
    const startedAtMs = toMs(latestTerminal.started_at);
    if (startedAtMs !== null) {
      const elapsedMs = nowMs - startedAtMs;
      const intervalWindowMs = intervalMinutes * 60 * 1000;
      const intervalEarlyGraceMs = Math.min(
        resolveIntervalEarlyGraceMs(),
        Math.max(0, Math.floor(intervalWindowMs * 0.1)),
      );
      if (!requestedForceFullSync && elapsedMs >= 0 && (elapsedMs + intervalEarlyGraceMs) < intervalWindowMs) {
        return NextResponse.json(
          {
            ok: true,
            run_id: String(latestTerminal.run_id ?? "").trim(),
            skipped: true,
            skip_reason: "INTERVAL_NOT_ELAPSED",
            interval_minutes: intervalMinutes,
            elapsed_minutes: Math.floor(elapsedMs / 60000),
            interval_early_grace_seconds: Math.floor(intervalEarlyGraceMs / 1000),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  let cursorQuery = sb
    .from("pricing_compute_cursor")
    .select("channel_id, master_item_id, compute_request_id, computed_at")
    .eq("channel_id", channelId);
  if (masterItemIds && masterItemIds.length > 0) cursorQuery = cursorQuery.in("master_item_id", masterItemIds);
  if (pinnedComputeRequestId) cursorQuery = cursorQuery.eq("compute_request_id", pinnedComputeRequestId);
  const cursorRes = await cursorQuery;
  if (cursorRes.error) return jsonError(cursorRes.error.message ?? "compute cursor 鈺곌퀬????쎈솭", 500);

  const cursors = (cursorRes.data ?? []).filter((row) => String(row.compute_request_id ?? "").trim().length > 0);
  if (cursors.length === 0) {
    return jsonError('활성 compute_request_id를 찾지 못했습니다. 먼저 계산을 실행해주세요.', 422);
  }

  const runRequestPayload: Record<string, unknown> = {
    ...body,
    interval_minutes: intervalMinutes,
    ...(requestedMinChangeKrwValue !== undefined ? { min_change_krw: requestedMinChangeKrwValue } : {}),
    ...(requestedMinChangeRateValue !== undefined ? { min_change_rate: requestedMinChangeRateValue } : {}),
    ...(triggerType === "AUTO" ? { auto_downsync_pressure_policy: pressurePolicyConfig } : {}),
  };

  const runInsertRes = await sb
    .from("price_sync_run_v2")
    .insert({
      channel_id: channelId,
      pinned_compute_request_id: pinnedComputeRequestId || String(cursors[0]?.compute_request_id ?? "").trim() || null,
      interval_minutes: intervalMinutes,
      trigger_type: triggerType,
      status: "RUNNING",
      request_payload: runRequestPayload,
      started_at: new Date().toISOString(),
    })
    .select("run_id")
    .single();
  if (runInsertRes.error) return jsonError(runInsertRes.error.message ?? "?癒?짗??녿┛??run ??밴쉐 ??쎈솭", 500);

  const runId = String(runInsertRes.data.run_id ?? "").trim();
  if (!runId) return jsonError("run_id ??밴쉐 ??쎈솭", 500);

  const masterIds = Array.from(new Set(cursors.map((r) => String(r.master_item_id ?? "").trim()).filter(Boolean)));
  const evaluationNowIso = new Date().toISOString();
  const evaluationNowMs = Date.parse(evaluationNowIso);

  const activePricingOverrideRows: ActivePricingOverrideRow[] = [];
  for (const masterChunk of chunkArray(masterIds, IN_QUERY_CHUNK_SIZE)) {
    if (masterChunk.length === 0) continue;
    const pricingOverrideRes = await sb
      .from("pricing_override")
      .select("override_id, master_item_id, override_price_krw, reason, valid_from, valid_to, updated_at")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .in("master_item_id", masterChunk)
      .order("updated_at", { ascending: false });
    if (pricingOverrideRes.error) return jsonError(pricingOverrideRes.error.message ?? "??뽮쉐 override 鈺곌퀬????쎈솭", 500);
    activePricingOverrideRows.push(...((pricingOverrideRes.data ?? []) as ActivePricingOverrideRow[]));
  }
  const activePricingOverrideByMaster = selectLatestByMasterItemId(
    activePricingOverrideRows.filter((row) => isActiveDuringWindow({
      startsAt: row.valid_from,
      endsAt: row.valid_to,
      nowMs: evaluationNowMs,
    })),
  );

  const activeFloorGuardRows: ActiveFloorGuardRow[] = [];
  for (const masterChunk of chunkArray(masterIds, IN_QUERY_CHUNK_SIZE)) {
    if (masterChunk.length === 0) continue;
    const floorGuardRes = await sb
      .from("product_price_guard_v2")
      .select("guard_id, master_item_id, floor_price_krw, floor_source, effective_from, effective_to, updated_at")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .in("master_item_id", masterChunk)
      .order("updated_at", { ascending: false });
    if (floorGuardRes.error) return jsonError(floorGuardRes.error.message ?? "??뽮쉐 floor guard 鈺곌퀬????쎈솭", 500);
    activeFloorGuardRows.push(...((floorGuardRes.data ?? []) as ActiveFloorGuardRow[]));
  }
  const activeFloorGuardByMaster = selectLatestByMasterItemId(
    activeFloorGuardRows.filter((row) => isActiveDuringWindow({
      startsAt: row.effective_from,
      endsAt: row.effective_to,
      nowMs: evaluationNowMs,
    })),
  );

  const policyRes = await sb
    .from("pricing_policy")
    .select("rounding_unit, rounding_mode, auto_sync_force_full, auto_sync_min_change_krw, auto_sync_min_change_rate, auto_sync_threshold_profile, option_sync_force_full, option_sync_min_change_krw, option_sync_min_change_rate, updated_at")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policyRes.error) return jsonError(policyRes.error.message ?? "揶쎛野꺿뫗?숋㎖?鈺곌퀬????쎈솭", 500);
  const roundingUnit = Math.max(1, Math.round(Number(policyRes.data?.rounding_unit ?? 1000)));
  const roundingModeRaw = String(policyRes.data?.rounding_mode ?? "CEIL").trim().toUpperCase();
  const roundingMode: "CEIL" | "ROUND" | "FLOOR" = roundingModeRaw === "FLOOR"
    ? "FLOOR"
    : roundingModeRaw === "ROUND"
      ? "ROUND"
      : "CEIL";
  const autoSyncPolicy = normalizeAutoSyncPolicy({
    auto_sync_force_full: triggerType === "AUTO" ? (requestedForceFullSync || policyRes.data?.auto_sync_force_full === true) : requestedForceFullSync,
    auto_sync_min_change_krw: requestedMinChangeKrwValue ?? policyRes.data?.auto_sync_min_change_krw,
    auto_sync_min_change_rate: requestedMinChangeRateValue ?? policyRes.data?.auto_sync_min_change_rate,
    auto_sync_threshold_profile: policyRes.data?.auto_sync_threshold_profile,
  });
  const autoSyncThresholdProfile = autoSyncPolicy.thresholdProfile;
  const forceFullSync = autoSyncPolicy.forceFullSync;
  const minChangeKrw = autoSyncPolicy.minChangeKrw;
  const minChangeRate = autoSyncPolicy.minChangeRate;
  const optionSyncPolicyInput = normalizeOptionAdditionalSyncPolicy({
    always_sync: policyRes.data?.option_sync_force_full === true,
    min_change_krw: 2000,
    min_change_rate: 0.02,
  });

  const thresholdPolicyInput = {
    auto_sync_force_full: false,
    auto_sync_min_change_krw: requestedMinChangeKrwValue ?? policyRes.data?.auto_sync_min_change_krw,
    auto_sync_min_change_rate: requestedMinChangeRateValue ?? policyRes.data?.auto_sync_min_change_rate,
    auto_sync_threshold_profile: autoSyncThresholdProfile,
  };
  const resolveThresholdPolicyForProfile = (currentProductProfile: string | null | undefined) => {
    if (requestedMinChangeKrwValue !== undefined || requestedMinChangeRateValue !== undefined) {
      return {
        thresholdProfile: autoSyncThresholdProfile,
        minChangeKrw,
        minChangeRate,
        policyInput: thresholdPolicyInput,
      };
    }

    const effectiveThresholdProfile = String(currentProductProfile ?? "").trim()
      ? normalizePriceSyncThresholdProfile(currentProductProfile)
      : autoSyncThresholdProfile;
    if (effectiveThresholdProfile === autoSyncThresholdProfile) {
      return {
        thresholdProfile: autoSyncThresholdProfile,
        minChangeKrw,
        minChangeRate,
        policyInput: thresholdPolicyInput,
      };
    }

    const overridePolicy = normalizeAutoSyncPolicy({
      auto_sync_force_full: false,
      auto_sync_min_change_krw: undefined,
      auto_sync_min_change_rate: undefined,
      auto_sync_threshold_profile: effectiveThresholdProfile,
    });

    return {
      thresholdProfile: overridePolicy.thresholdProfile,
      minChangeKrw: overridePolicy.minChangeKrw,
      minChangeRate: overridePolicy.minChangeRate,
      policyInput: {
        auto_sync_force_full: false,
        auto_sync_min_change_krw: overridePolicy.minChangeKrw,
        auto_sync_min_change_rate: overridePolicy.minChangeRate,
        auto_sync_threshold_profile: overridePolicy.thresholdProfile,
      },
    };
  };
  const syncPolicyMode = forceFullSync ? "ALWAYS" : "RULE_BASED";
  const forceFullSyncSource = forceFullSync
    ? (requestedForceFullSyncSource || (requestedForceFullSync ? "REQUEST" : triggerType === "AUTO" && policyRes.data?.auto_sync_force_full === true ? "POLICY" : "REQUEST"))
    : null;

  const computeIds = Array.from(new Set(cursors.map((r) => String(r.compute_request_id ?? "").trim()).filter(Boolean)));
  if (pinnedComputeRequestId && !computeIds.includes(pinnedComputeRequestId)) {
    await sb
      .from("price_sync_run_v2")
      .update({ status: "FAILED", error_message: "PINNED_COMPUTE_REQUEST_NOT_FOUND", finished_at: new Date().toISOString() })
      .eq("run_id", runId);
    return jsonError("?遺욧퍕??compute_request_id??筌≪뼚??????곷뮸??덈뼄", 422, { code: "PINNED_COMPUTE_REQUEST_NOT_FOUND" });
  }

  const fullAutoScope = triggerType === "AUTO" && (!masterItemIds || masterItemIds.length === 0);
  if (fullAutoScope && computeIds.length !== 1) {
    await sb
      .from("price_sync_run_v2")
      .update({ status: "FAILED", error_message: "MIXED_COMPUTE_REQUESTS", finished_at: new Date().toISOString() })
      .eq("run_id", runId);
    return jsonError("Full auto sync requires a single compute_request_id snapshot", 409, {
      code: "MIXED_COMPUTE_REQUESTS",
      compute_request_ids: computeIds,
    });
  }
  const snapshotV2Probe = await sb.from("pricing_snapshot").select("final_target_price_v2_krw").limit(1);
  const hasV2TargetColumns = !snapshotV2Probe.error;
  const snapshotSelect = hasV2TargetColumns
    ? "channel_id, master_item_id, channel_product_id, compute_request_id, final_target_price_krw, final_target_price_v2_krw, pricing_algo_version, base_total_pre_margin_krw, total_after_margin_krw, delta_total_krw"
    : "channel_id, master_item_id, channel_product_id, compute_request_id, final_target_price_krw, base_total_pre_margin_krw, total_after_margin_krw, delta_total_krw";

  const snapshotRows: Array<{
    channel_id: string | null;
    master_item_id: string | null;
    channel_product_id: string | null;
    compute_request_id: string | null;
    final_target_price_krw: number | null;
    final_target_price_v2_krw?: number | null;
    pricing_algo_version?: string | null;
    base_total_pre_margin_krw: number | null;
    total_after_margin_krw: number | null;
    delta_total_krw: number | null;
  }> = [];
  const publishedByChannelProduct = new Map<string, { publishVersion: string; targetPriceRawKrw: number | null; publishedBasePriceKrw: number; publishedAdditionalAmountKrw: number; publishedTotalPriceKrw: number; masterItemId: string; externalProductNo: string; externalVariantCode: string; }>();

  for (const computeId of computeIds) {
    const publishedRes = await loadPublishedPriceStateByVersion({
      sb,
      channelId,
      publishVersion: computeId,
    });
    if (!publishedRes.available) {
      return jsonError("published price rows are required for run creation", 422, {
        code: "PUBLISHED_PRICE_ROWS_REQUIRED",
        publish_versions: computeIds,
      });
    }
    for (const [key, value] of publishedRes.rowsByChannelProduct.entries()) {
      if (masterIds.length > 0 && !masterIds.includes(value.masterItemId)) continue;
      publishedByChannelProduct.set(key, value as never);
    }
  }
  if (publishedByChannelProduct.size === 0) {
    return jsonError("no published rows matched the requested versions", 422, {
      code: "PUBLISHED_ROWS_EMPTY",
      publish_versions: computeIds,
    });
  }

  const snapshotChannelProductIds = Array.from(publishedByChannelProduct.keys());
  for (const idChunk of chunkArray(snapshotChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
    if (idChunk.length === 0) continue;
    const snapshotRes = await sb
      .from("pricing_snapshot")
      .select(snapshotSelect)
      .eq("channel_id", channelId)
      .in("compute_request_id", computeIds)
      .in("channel_product_id", idChunk);
    if (snapshotRes.error) return jsonError(snapshotRes.error.message ?? "pricing snapshot context lookup failed", 500);
    snapshotRows.push(...((snapshotRes.data ?? []) as unknown as Array<typeof snapshotRows[number]>));
  }

  const snapshotContextByChannelProduct = new Map<string, typeof snapshotRows[number]>();
  for (const row of snapshotRows) {
    const key = String(row.channel_product_id ?? "").trim();
    const computeRequestId = String(row.compute_request_id ?? "").trim();
    const published = publishedByChannelProduct.get(key) ?? null;
    if (!key || !published || published.publishVersion !== computeRequestId || snapshotContextByChannelProduct.has(key)) continue;
    snapshotContextByChannelProduct.set(key, row);
  }

  snapshotRows.splice(0, snapshotRows.length, ...Array.from(publishedByChannelProduct.entries()).map(([channelProductId, published]) => {
    const context = snapshotContextByChannelProduct.get(channelProductId) ?? null;
    const finalTarget = !published.externalVariantCode
      ? published.publishedBasePriceKrw
      : published.publishedBasePriceKrw + published.publishedAdditionalAmountKrw;
    return {
      channel_id: context?.channel_id ?? channelId,
      master_item_id: published.masterItemId,
      channel_product_id: channelProductId,
      compute_request_id: published.publishVersion,
      final_target_price_krw: finalTarget,
      final_target_price_v2_krw: context?.final_target_price_v2_krw ?? finalTarget,
      pricing_algo_version: context?.pricing_algo_version ?? null,
      base_total_pre_margin_krw: context?.base_total_pre_margin_krw ?? null,
      total_after_margin_krw: context?.total_after_margin_krw ?? null,
      delta_total_krw: published.publishedAdditionalAmountKrw,
    };
  }));
  const activeMapRows: ActiveMappingRow[] = [];
  for (const idChunk of chunkArray(snapshotChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
    if (idChunk.length === 0) continue;
    const activeMapRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id, master_item_id, external_product_no, external_variant_code, current_product_sync_profile")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .in("channel_product_id", idChunk);
    if (activeMapRes.error) return jsonError(activeMapRes.error.message ?? "??뽮쉐 筌띲끋釉?鈺곌퀬????쎈솭", 500);
    activeMapRows.push(...(activeMapRes.data ?? []));
  }

  const activeByChannelProduct = new Map(activeMapRows.map((r) => [
    String(r.channel_product_id ?? ""),
    {
      external_product_no: String(r.external_product_no ?? "").trim(),
      external_variant_code: String(r.external_variant_code ?? "").trim(),
    },
  ]));
  const currentProductSyncProfileByMaster = buildCurrentProductSyncProfileByMaster(activeMapRows);
  const publishedBaseRowsByMasterProduct = new Map<string, number>();
  for (const published of publishedByChannelProduct.values()) {
    if (!published.externalVariantCode) {
      publishedBaseRowsByMasterProduct.set(`${published.masterItemId}::${published.externalProductNo}`, published.publishedBasePriceKrw);
    }
  }

  const { summary: missingMappingSummary } = buildMissingActiveMappingSummary({
    snapshotRows,
    activeByChannelProduct,
  });

  const currentSnapshotRows: Array<{
    channel_product_id: string | null;
    current_price_krw: number | null;
    raw_json?: unknown;
    fetched_at?: string | null;
  }> = [];
  for (const idChunk of chunkArray(snapshotChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
    if (idChunk.length === 0) continue;
    const currentRes = await sb
      .from("channel_price_snapshot")
      .select("channel_product_id, current_price_krw, raw_json, fetched_at")
      .eq("channel_id", channelId)
      .in("channel_product_id", idChunk)
      .order("fetched_at", { ascending: false });
    if (currentRes.error) return jsonError(currentRes.error.message ?? "current snapshot lookup failed", 500);
    currentSnapshotRows.push(...((currentRes.data ?? []) as Array<typeof currentSnapshotRows[number]>));
  }
  const currentByChannelProduct = new Map<string, number>();
  const currentOptionAdditionalByChannelProduct = new Map<string, number>();
  for (const row of currentSnapshotRows) {
    const key = String(row.channel_product_id ?? "").trim();
    if (!key || currentByChannelProduct.has(key)) continue;
    const current = Number(row.current_price_krw ?? Number.NaN);
    if (Number.isFinite(current)) currentByChannelProduct.set(key, Math.round(current));
    const currentAdditional = parseCafe24VariantAdditionalAmountFromRaw(row.raw_json ?? null);
    if (currentAdditional != null && Number.isFinite(Number(currentAdditional))) {
      currentOptionAdditionalByChannelProduct.set(key, Math.round(Number(currentAdditional)));
    }
  }

  const pressureStateRows: Array<{
    channel_product_id: string | null;
    pressure_units?: number | null;
    last_gap_units?: number | null;
    last_seen_target_krw?: number | null;
    last_seen_current_krw?: number | null;
    last_auto_sync_at?: string | null;
    last_upsync_at?: string | null;
    last_downsync_at?: string | null;
    cooldown_until?: string | null;
  }> = [];
  for (const idChunk of chunkArray(snapshotChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
    if (idChunk.length === 0) continue;
    const pressureStateRes = await sb
      .from("price_sync_auto_state_v1")
      .select("channel_product_id, pressure_units, last_gap_units, last_seen_target_krw, last_seen_current_krw, last_auto_sync_at, last_upsync_at, last_downsync_at, cooldown_until")
      .eq("channel_id", channelId)
      .in("channel_product_id", idChunk);
    if (pressureStateRes.error) return jsonError(pressureStateRes.error.message ?? "AUTO pressure state 鈺곌퀬????쎈솭", 500);
    pressureStateRows.push(...(pressureStateRes.data ?? []));
  }
  const pressureStateByChannelProduct = new Map(pressureStateRows.map((row) => [
    String(row.channel_product_id ?? "").trim(),
    normalizeAutoSyncPressureState(row),
  ]));
  const nextPressureStateByChannelProduct = new Map<string, ReturnType<typeof normalizeAutoSyncPressureState>>();
  const pressureStateMetadataByChannelProduct = new Map<string, {
    masterItemId: string;
    externalProductNo: string;
    externalVariantCode: string;
  }>();

  const baseSnapshotTargetByMaster = new Map<string, PreferredMasterTarget>();
  const forcedBaseTargetByMaster = new Map<string, PreferredMasterTarget>();
  for (const row of snapshotRows) {
    const channelProductId = String(row.channel_product_id ?? "").trim();
    const mapping = activeByChannelProduct.get(channelProductId);
    if (!channelProductId || !mapping || !mapping.external_product_no) continue;
    const variantCode = String(mapping.external_variant_code ?? "").trim();
    if (variantCode.length > 0) continue;

    const masterItemId = String(row.master_item_id ?? "").trim();
    if (!masterItemId) continue;
    const masterThresholdPolicy = resolveThresholdPolicyForProfile(currentProductSyncProfileByMaster.get(masterItemId) ?? null);
    const targetRaw = row.final_target_price_v2_krw ?? row.final_target_price_krw;
    const baseTarget = Math.round(Number(targetRaw ?? Number.NaN));
    if (!Number.isFinite(baseTarget)) continue;
    const prevBaseTarget = baseSnapshotTargetByMaster.get(masterItemId) ?? null;
    if (!prevBaseTarget || shouldPreferMappingProductNo(prevBaseTarget.productNo, mapping.external_product_no)) {
      baseSnapshotTargetByMaster.set(masterItemId, { productNo: mapping.external_product_no, target: baseTarget });
    }

    if (triggerType !== "AUTO") continue;
    const current = currentByChannelProduct.get(channelProductId);
    if (typeof current !== "number" || !Number.isFinite(current)) continue;
    const currentRounded = Math.round(current);

    const marketBasePrice = Math.round(Number(row.base_total_pre_margin_krw ?? Number.NaN));
    const marketAfterMarginRaw = Number(row.total_after_margin_krw ?? Number.NaN);
    const marketAfterMargin = roundByMode(marketAfterMarginRaw, roundingUnit, roundingMode);
    if (!Number.isFinite(marketBasePrice) || !Number.isFinite(marketAfterMargin) || marketAfterMargin <= 0) continue;

    const marketForceDecision = evaluateAutoSyncThreshold({
      desiredPriceKrw: marketAfterMargin,
      currentPriceKrw: currentRounded,
      policy: masterThresholdPolicy.policyInput,
    });
    if (!marketForceDecision.passesThreshold) continue;
    const forcedTarget = Math.max(baseTarget, marketAfterMargin);
    const prevForcedTarget = forcedBaseTargetByMaster.get(masterItemId) ?? null;
    if (!prevForcedTarget || shouldPreferMappingProductNo(prevForcedTarget.productNo, mapping.external_product_no)) {
      forcedBaseTargetByMaster.set(masterItemId, { productNo: mapping.external_product_no, target: forcedTarget });
    }
  }

  const intentRows: Array<Record<string, unknown>> = [];
  const taskRows: Array<Record<string, unknown>> = [];
  let thresholdFilteredCount = 0;
  let thresholdEvaluatedCount = 0;
  let optionThresholdFilteredCount = 0;
  let optionThresholdEvaluatedCount = 0;
  let optionCurrentMissingCount = 0;
  let optionIntentCount = 0;
  let marketGapForcedCount = 0;
  let downsyncSuppressedCount = 0;
  let pressureDownsyncReleaseCount = 0;
  let largeDownsyncReleaseCount = 0;
  let cooldownBlockCount = 0;
  let stalenessReleaseCount = 0;
  let pressureDecayCount = 0;
  const runNowIso = evaluationNowIso;
  const marketGapForcedMasterKeys = new Set<string>();
  const dedupeByLogicalTarget = new Map<
    string,
    {
      idx: number;
      desired: number;
      floorApplied: boolean;
      floorPriceKrw: number;
      decisionContext: IntentDecisionContext;
      channelProductId: string;
      externalProductNo: string;
      externalVariantCode: string;
    }
  >();
  for (const row of snapshotRows) {
    const channelProductId = String(row.channel_product_id ?? "").trim();
    const mapping = activeByChannelProduct.get(channelProductId);
    if (!channelProductId || !mapping || !mapping.external_product_no) continue;

    const masterItemId = String(row.master_item_id ?? "").trim();
    const variantCode = String(mapping.external_variant_code ?? "").trim();
    const published = publishedByChannelProduct.get(channelProductId) ?? null;
    if (!published || published.publishVersion !== String(row.compute_request_id ?? "").trim()) continue;
    const basePublished = variantCode
      ? (publishedBaseRowsByMasterProduct.get(`${masterItemId}::${mapping.external_product_no}`) ?? published.publishedBasePriceKrw)
      : published.publishedBasePriceKrw;
    const target = variantCode ? basePublished + published.publishedAdditionalAmountKrw : basePublished;
    let desired = target;
    if (!(desired > 0)) continue;
    const masterThresholdPolicy = resolveThresholdPolicyForProfile(currentProductSyncProfileByMaster.get(masterItemId) ?? null);

    const forcedBaseTarget = forcedBaseTargetByMaster.get(masterItemId)?.target;
    const baseSnapshotTarget = baseSnapshotTargetByMaster.get(masterItemId)?.target;
    const masterHasForcedMarketSync = Number.isFinite(Number(forcedBaseTarget ?? Number.NaN))
      && Number.isFinite(Number(baseSnapshotTarget ?? Number.NaN))
      && Number(forcedBaseTarget) > Number(baseSnapshotTarget);

    const currentPrice = currentByChannelProduct.get(channelProductId);
    const snapshotOptionAdditional = variantCode ? published.publishedAdditionalAmountKrw : null;
    const lastKnownOptionAdditional = variantCode
      ? (currentOptionAdditionalByChannelProduct.get(channelProductId) ?? null)
      : null;
    const optionThresholdDecision = variantCode && lastKnownOptionAdditional != null && snapshotOptionAdditional != null
      ? evaluateOptionAdditionalThreshold({
        currentAdditionalKrw: lastKnownOptionAdditional,
        targetAdditionalKrw: snapshotOptionAdditional,
        policy: optionSyncPolicyInput,
      })
      : null;
    const optionAdditionalOutOfSync = snapshotOptionAdditional != null
      && lastKnownOptionAdditional != null
      && Math.round(Number(snapshotOptionAdditional)) !== Math.round(Number(lastKnownOptionAdditional));
    const rowCurrentRounded = Number.isFinite(Number(currentPrice ?? Number.NaN))
      ? Math.round(Number(currentPrice))
      : null;
    const rowMarketAfterMarginRaw = Number(row.total_after_margin_krw ?? Number.NaN);
    const rowMarketAfterMargin = roundByMode(rowMarketAfterMarginRaw, roundingUnit, roundingMode);
    const rowMarketForceDecision = triggerType === "AUTO"
      && variantCode.length === 0
      && rowCurrentRounded !== null
      && Number.isFinite(rowMarketAfterMargin)
      && rowMarketAfterMargin > 0
      ? evaluateAutoSyncThreshold({
        desiredPriceKrw: rowMarketAfterMargin,
        currentPriceKrw: rowCurrentRounded,
        policy: masterThresholdPolicy.policyInput,
      })
      : null;
    const rowHasDirectMarketForce = Boolean(rowMarketForceDecision?.passesThreshold);

    if (variantCode.length === 0 && (rowHasDirectMarketForce || masterHasForcedMarketSync)) {
      if (rowHasDirectMarketForce) desired = Math.max(desired, rowMarketAfterMargin);
      if (masterHasForcedMarketSync) desired = Math.max(desired, Math.round(Number(forcedBaseTarget)));
      if (!marketGapForcedMasterKeys.has(masterItemId)) {
        marketGapForcedMasterKeys.add(masterItemId);
        marketGapForcedCount += 1;
      }
    }

    let marketUpliftPriceKrw = desired > target ? desired : null;
    let activePricingOverride = variantCode.length === 0 ? (activePricingOverrideByMaster.get(masterItemId) ?? null) : null;
    const pricingOverridePriceKrwRaw = Number(activePricingOverride?.override_price_krw ?? Number.NaN);
    let pricingOverridePriceKrw = Number.isFinite(pricingOverridePriceKrwRaw)
      ? Math.max(0, Math.round(pricingOverridePriceKrwRaw))
      : null;
    if (pricingOverridePriceKrw !== null) desired = pricingOverridePriceKrw;

    let activeFloorGuard = variantCode.length === 0 ? (activeFloorGuardByMaster.get(masterItemId) ?? null) : null;
    const floorPriceKrwRaw = Number(activeFloorGuard?.floor_price_krw ?? 0);
    let floorPriceKrw = Number.isFinite(floorPriceKrwRaw)
      ? Math.max(0, Math.round(floorPriceKrwRaw))
      : 0;
    let floorApplied = floorPriceKrw > desired;
    if (floorApplied) desired = floorPriceKrw;

    if (variantCode.length > 0) {
      marketUpliftPriceKrw = null;
      activePricingOverride = null;
      pricingOverridePriceKrw = null;
      activeFloorGuard = null;
      floorPriceKrw = 0;
      floorApplied = false;
      desired = target;
    }

    const decisionContext: IntentDecisionContext = {
      threshold_profile: masterThresholdPolicy.thresholdProfile,
      current_price_krw: rowCurrentRounded,
      base_target_price_krw: target,
      market_uplift_price_krw: marketUpliftPriceKrw,
      pricing_override_id: activePricingOverride ? String(activePricingOverride.override_id ?? "").trim() || null : null,
      pricing_override_price_krw: pricingOverridePriceKrw,
      floor_guard_id: activeFloorGuard ? String(activeFloorGuard.guard_id ?? "").trim() || null : null,
      floor_price_krw: floorPriceKrw,
      final_desired_price_krw: desired,
      floor_applied: floorApplied,
      option_sync_mode: variantCode ? "OPTION_ADDITIONAL" : "BASE_TOTAL",
      option_additional_target_krw: snapshotOptionAdditional,
      option_additional_current_krw: lastKnownOptionAdditional,
      option_additional_out_of_sync: optionAdditionalOutOfSync,
      option_additional_threshold_delta_krw: optionThresholdDecision?.diffKrw ?? null,
      option_effective_threshold_krw: optionThresholdDecision?.effectiveThresholdKrw ?? null,
      option_threshold_passed: optionThresholdDecision?.passesThreshold ?? null,
      option_threshold_reason: variantCode
        ? (lastKnownOptionAdditional == null
          ? "OPTION_CURRENT_MISSING"
          : optionThresholdDecision?.passesThreshold
            ? "OPTION_THRESHOLD_PASSED"
            : "OPTION_THRESHOLD_NOT_MET")
        : null,
    };

    if (triggerType === "AUTO") {
      if (variantCode.length > 0) {
        if (!forceFullSync) {
          optionThresholdEvaluatedCount += 1;
          if (lastKnownOptionAdditional == null) {
            optionCurrentMissingCount += 1;
            continue;
          }
          if (!optionThresholdDecision?.passesThreshold) {
            optionThresholdFilteredCount += 1;
            continue;
          }
        }
      } else if (Number.isFinite(Number(currentPrice ?? Number.NaN))) {
        const currentRounded = Math.round(Number(currentPrice));
        const thresholdDecision = evaluateAutoSyncThreshold({
          desiredPriceKrw: desired,
          currentPriceKrw: currentRounded,
          policy: masterThresholdPolicy.policyInput,
        });
        const isForcedBaseUplift = marketUpliftPriceKrw !== null
          && pricingOverridePriceKrw === null
          && !floorApplied;
        const pressureDecision = evaluateAutoSyncPressurePolicy({
          currentPriceKrw: currentRounded,
          desiredPriceKrw: desired,
          state: nextPressureStateByChannelProduct.get(channelProductId) ?? pressureStateByChannelProduct.get(channelProductId),
          minChangeKrw: masterThresholdPolicy.minChangeKrw,
          minChangeRate: masterThresholdPolicy.minChangeRate,
          now: runNowIso,
          config: pressurePolicyConfig,
        });
        nextPressureStateByChannelProduct.set(channelProductId, pressureDecision.nextState);
        pressureStateMetadataByChannelProduct.set(channelProductId, {
          masterItemId,
          externalProductNo: mapping.external_product_no,
          externalVariantCode: variantCode,
        });

        if (!forceFullSync && !isForcedBaseUplift) {
          if (pressureDecision.pressureDecayApplied) pressureDecayCount += 1;
          if (pressureDecision.cooldownBlocked) cooldownBlockCount += 1;
          if (pressureDecision.pressureReleaseTriggered) pressureDownsyncReleaseCount += 1;
          if (pressureDecision.largeDownsyncTriggered) largeDownsyncReleaseCount += 1;
          if (pressureDecision.stalenessReleaseTriggered) stalenessReleaseCount += 1;
        }

        if (!forceFullSync && !isForcedBaseUplift && desired <= currentRounded && !pressureDecision.shouldCreateDownsyncIntent) {
          downsyncSuppressedCount += 1;
          continue;
        }

        if (!forceFullSync) {
          thresholdEvaluatedCount += 1;
          if (!isForcedBaseUplift && !pressureDecision.shouldCreateDownsyncIntent && !thresholdDecision.passesThreshold) {
            thresholdFilteredCount += 1;
            continue;
          }
        }
      }
    }
    if (variantCode.length > 0) optionIntentCount += 1;

    const intentId = crypto.randomUUID();
    const computeRequestId = String(row.compute_request_id ?? "").trim();
    const logicalTargetKey = `${masterItemId}:${variantCode || "BASE"}:${computeRequestId}`;
    const existing = dedupeByLogicalTarget.get(logicalTargetKey);

    if (existing) {
      const intentIdx = existing.idx;
      const shouldReplaceMapping = shouldPreferMappingProductNo(existing.externalProductNo, mapping.external_product_no);
      const selectedChannelProductId = shouldReplaceMapping ? channelProductId : existing.channelProductId;
      const selectedProductNo = shouldReplaceMapping ? mapping.external_product_no : existing.externalProductNo;
      const selectedVariantCode = shouldReplaceMapping ? variantCode : existing.externalVariantCode;
      const selectedDesired = shouldReplaceMapping ? desired : existing.desired;
      const selectedFloorApplied = shouldReplaceMapping ? floorApplied : existing.floorApplied;
      const selectedFloorPriceKrw = shouldReplaceMapping ? floorPriceKrw : existing.floorPriceKrw;
      const selectedDecisionContext = shouldReplaceMapping ? decisionContext : existing.decisionContext;
      intentRows[intentIdx] = {
        ...intentRows[intentIdx],
        channel_product_id: selectedChannelProductId,
        external_product_no: selectedProductNo,
        external_variant_code: selectedVariantCode || null,
        desired_price_krw: selectedDesired,
        floor_price_krw: selectedFloorPriceKrw,
        floor_applied: selectedFloorApplied,
        decision_context_json: selectedDecisionContext,
        inputs_hash: makeIdempotencyKey([channelId, selectedChannelProductId, computeRequestId, selectedDesired, selectedFloorPriceKrw]),
      };
      const existingTask = taskRows[intentIdx] ?? {};
      const existingIntentId = String((intentRows[intentIdx] as { intent_id?: unknown } | undefined)?.intent_id ?? "").trim();
      taskRows[intentIdx] = {
        ...existingTask,
        idempotency_key: makeIdempotencyKey([
          existingIntentId || `intent_idx_${intentIdx}`,
          channelId,
          selectedChannelProductId,
          selectedVariantCode || "BASE",
          computeRequestId,
          selectedDesired,
          selectedFloorPriceKrw,
        ]),
      };
      dedupeByLogicalTarget.set(logicalTargetKey, {
        idx: intentIdx,
        desired: selectedDesired,
        floorApplied: selectedFloorApplied,
        floorPriceKrw: selectedFloorPriceKrw,
        decisionContext: selectedDecisionContext,
        channelProductId: selectedChannelProductId,
        externalProductNo: selectedProductNo,
        externalVariantCode: selectedVariantCode,
      });
      continue;
    }

    intentRows.push({
      intent_id: intentId,
      run_id: runId,
      channel_id: channelId,
      channel_product_id: channelProductId,
      master_item_id: masterItemId,
      external_product_no: mapping.external_product_no,
      external_variant_code: variantCode || null,
      compute_request_id: computeRequestId,
      desired_price_krw: desired,
      floor_price_krw: floorPriceKrw,
      floor_applied: floorApplied,
      decision_context_json: decisionContext,
      intent_version: Date.now(),
      inputs_hash: makeIdempotencyKey([channelId, channelProductId, computeRequestId, desired, floorPriceKrw]),
      state: "PENDING",
    });

    taskRows.push({
      intent_id: intentId,
      idempotency_key: makeIdempotencyKey([
        intentId,
        channelId,
        channelProductId,
        variantCode || "BASE",
        computeRequestId,
        desired,
        floorPriceKrw,
      ]),
      state: "PENDING",
      attempt_count: 0,
    });
    dedupeByLogicalTarget.set(logicalTargetKey, {
      idx: intentRows.length - 1,
      desired,
      floorApplied,
      floorPriceKrw,
      decisionContext,
      channelProductId,
      externalProductNo: mapping.external_product_no,
      externalVariantCode: variantCode,
    });
  }

  const normalizedOptionSyncPolicy = normalizeOptionAdditionalSyncPolicy(optionSyncPolicyInput);
  const runSummary = {
    threshold_profile: autoSyncThresholdProfile,
    threshold_min_change_krw: minChangeKrw,
    threshold_min_change_rate: minChangeRate,
    option_sync_min_change_krw: normalizedOptionSyncPolicy.min_change_krw,
    option_sync_min_change_rate: normalizedOptionSyncPolicy.min_change_rate,
    option_sync_effective_mode: "MAX",
    sync_policy_mode: syncPolicyMode,
    auto_downsync_policy_mode: pressurePolicyConfig.mode,
    threshold_evaluated_count: thresholdEvaluatedCount,
    threshold_filtered_count: thresholdFilteredCount,
    option_threshold_evaluated_count: optionThresholdEvaluatedCount,
    option_threshold_filtered_count: optionThresholdFilteredCount,
    option_current_missing_count: optionCurrentMissingCount,
    option_intent_count: optionIntentCount,
    market_gap_forced_count: marketGapForcedCount,
    downsync_suppressed_count: downsyncSuppressedCount,
    pressure_downsync_release_count: pressureDownsyncReleaseCount,
    large_downsync_release_count: largeDownsyncReleaseCount,
    cooldown_block_count: cooldownBlockCount,
    staleness_release_count: stalenessReleaseCount,
    pressure_decay_count: pressureDecayCount,
    force_full_sync: forceFullSync,
    force_full_sync_source: forceFullSyncSource,
    ...missingMappingSummary,
  };

  if (triggerType === "AUTO" && nextPressureStateByChannelProduct.size > 0) {
    const pressureStateUpserts = Array.from(nextPressureStateByChannelProduct.entries()).map(([channelProductId, nextState]) => {
      const metadata = pressureStateMetadataByChannelProduct.get(channelProductId);
      return buildAutoSyncPressureStateRow({
        channelId,
        channelProductId,
        masterItemId: metadata?.masterItemId ?? "",
        externalProductNo: metadata?.externalProductNo ?? "",
        externalVariantCode: metadata?.externalVariantCode ?? "",
        nextState,
        now: runNowIso,
      });
    });

    for (const chunk of chunkArray(pressureStateUpserts, INSERT_CHUNK_SIZE)) {
      if (chunk.length === 0) continue;
      const pressureStateUpsertRes = await sb
        .from("price_sync_auto_state_v1")
        .upsert(chunk, { onConflict: "channel_id,channel_product_id" });
      if (pressureStateUpsertRes.error) {
        await sb
          .from("price_sync_run_v2")
          .update({ status: "FAILED", error_message: pressureStateUpsertRes.error.message ?? "AUTO_PRESSURE_STATE_UPSERT_FAILED", finished_at: new Date().toISOString() })
          .eq("run_id", runId);
        return jsonError(pressureStateUpsertRes.error.message ?? "AUTO pressure state ??????쎈솭", 500);
      }
    }
  }

  if (intentRows.length === 0) {
    const reason = resolveNoIntentsReason({
      thresholdFilteredCount,
      optionThresholdFilteredCount,
      missingActiveMappingProductCount: missingMappingSummary.missing_active_mapping_product_count,
    });
    await sb
      .from("price_sync_run_v2")
      .update({
        status: "SUCCESS",
        total_count: 0,
        finished_at: new Date().toISOString(),
        request_payload: {
          ...runRequestPayload,
          summary: runSummary,
        },
      })
      .eq("run_id", runId);
    return NextResponse.json({
      ok: true,
      run_id: runId,
      total_count: 0,
      reason,
      ...runSummary,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  for (const chunk of chunkArray(intentRows, INSERT_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;
    const intentInsertRes = await sb.from("price_sync_intent_v2").insert(chunk);
    if (intentInsertRes.error) {
      await sb
        .from("price_sync_run_v2")
        .update({ status: "FAILED", error_message: intentInsertRes.error.message ?? "INTENT_INSERT_FAILED", finished_at: new Date().toISOString() })
        .eq("run_id", runId);
      return jsonError(intentInsertRes.error.message ?? "intent ??????쎈솭", 500);
    }
  }

  for (const chunk of chunkArray(taskRows, INSERT_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;
    const taskInsertRes = await sb.from("price_sync_push_task_v2").insert(chunk);
    if (taskInsertRes.error) {
      await sb
        .from("price_sync_run_v2")
        .update({ status: "FAILED", error_message: taskInsertRes.error.message ?? "TASK_INSERT_FAILED", finished_at: new Date().toISOString() })
        .eq("run_id", runId);
      return jsonError(taskInsertRes.error.message ?? "push task ??????쎈솭", 500);
    }
  }

  await sb
    .from("price_sync_run_v2")
    .update({
      total_count: intentRows.length,
      updated_at: new Date().toISOString(),
      request_payload: {
        ...runRequestPayload,
        summary: runSummary,
      },
    })
    .eq("run_id", runId);

  return NextResponse.json(
    {
      ok: true,
      run_id: runId,
      total_count: intentRows.length,
      floor_applied_count: intentRows.filter((row) => row.floor_applied === true).length,
      publish_versions: computeIds,
      compute_request_ids: computeIds,
      ...runSummary,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
