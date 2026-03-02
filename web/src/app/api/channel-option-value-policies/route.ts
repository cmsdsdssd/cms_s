import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyRow = {
  channel_id: string;
  master_item_id: string;
  axis_key: string;
  axis_value: string;
  axis_mode: "SYNC" | "OVERRIDE";
  rule_type: "R1" | "R2" | "R3" | "R4";
  value_mode: "BASE" | "SYNC";
  sync_rule_set_id: string | null;
  selected_rule_id: string | null;
  manual_delta_krw: number;
};

type SavedPolicyRow = {
  policy_id: string;
  channel_id: string;
  master_item_id: string;
  axis_key: string;
  axis_value: string;
  axis_mode: "SYNC" | "OVERRIDE";
  rule_type: "R1" | "R2" | "R3" | "R4";
  value_mode: "BASE" | "SYNC";
  sync_rule_set_id: string | null;
  selected_rule_id: string | null;
  manual_delta_krw: number;
  created_at: string;
  updated_at: string;
};

const toTrimmed = (value: unknown) => String(value ?? "").trim();
const policyKey = (row: { channel_id: string; master_item_id: string; axis_key: string; axis_value: string }) =>
  `${row.channel_id}::${row.master_item_id}::${row.axis_key}::${row.axis_value}`;

const policyChanged = (prev: SavedPolicyRow | undefined, next: SavedPolicyRow) => {
  if (!prev) return true;
  return (
    prev.axis_mode !== next.axis_mode
    || prev.rule_type !== next.rule_type
    || prev.value_mode !== next.value_mode
    || String(prev.sync_rule_set_id ?? "") !== String(next.sync_rule_set_id ?? "")
    || String(prev.selected_rule_id ?? "") !== String(next.selected_rule_id ?? "")
    || Math.round(Number(prev.manual_delta_krw ?? 0)) !== Math.round(Number(next.manual_delta_krw ?? 0))
  );
};

function normalizeRow(raw: unknown): { ok: true; row: PolicyRow } | { ok: false; error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { ok: false, error: "row must be object" };

  const channelId = toTrimmed(body.channel_id);
  const masterItemId = toTrimmed(body.master_item_id);
  const axisKey = toTrimmed(body.axis_key);
  const axisValue = toTrimmed(body.axis_value);

  const axisModeRaw = toTrimmed(body.axis_mode).toUpperCase();
  const axisMode: PolicyRow["axis_mode"] = axisModeRaw === "OVERRIDE" ? "OVERRIDE" : "SYNC";
  const ruleTypeRaw = toTrimmed(body.rule_type).toUpperCase();
  const ruleType: PolicyRow["rule_type"] =
    ruleTypeRaw === "R1" || ruleTypeRaw === "R2" || ruleTypeRaw === "R3" || ruleTypeRaw === "R4"
      ? (ruleTypeRaw as PolicyRow["rule_type"])
      : "R2";
  const valueModeRaw = toTrimmed(body.value_mode).toUpperCase();
  const valueMode: PolicyRow["value_mode"] = valueModeRaw === "SYNC" ? "SYNC" : "BASE";

  const syncRuleSetId = typeof body.sync_rule_set_id === "string" ? toTrimmed(body.sync_rule_set_id) || null : null;
  const selectedRuleId = typeof body.selected_rule_id === "string" ? toTrimmed(body.selected_rule_id) || null : null;
  const manualDelta = Number(body.manual_delta_krw ?? 0);
  const manualDeltaRounded = Math.round(manualDelta);

  if (!channelId) return { ok: false, error: "channel_id is required" };
  if (!masterItemId) return { ok: false, error: "master_item_id is required" };
  if (!axisKey) return { ok: false, error: "axis_key is required" };
  if (!axisValue) return { ok: false, error: "axis_value is required" };
  if (!Number.isFinite(manualDeltaRounded) || manualDeltaRounded < -100000000 || manualDeltaRounded > 100000000) {
    return { ok: false, error: "manual_delta_krw must be between -100000000 and 100000000" };
  }
  if (axisMode === "SYNC" && valueMode === "SYNC" && !syncRuleSetId) {
    return { ok: false, error: "sync_rule_set_id is required when axis_mode is SYNC and value_mode is SYNC" };
  }

  return {
    ok: true,
    row: {
      channel_id: channelId,
      master_item_id: masterItemId,
      axis_key: axisKey,
      axis_value: axisValue,
      axis_mode: axisMode,
      rule_type: ruleType,
      value_mode: valueMode,
      sync_rule_set_id: syncRuleSetId,
      selected_rule_id: selectedRuleId,
      manual_delta_krw: manualDeltaRounded,
    },
  };
}

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get("channel_id"));
  const masterItemId = toTrimmed(searchParams.get("master_item_id"));

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  const { data, error } = await sb
    .from("channel_option_value_policy")
    .select("policy_id, channel_id, master_item_id, axis_key, axis_value, axis_mode, rule_type, value_mode, sync_rule_set_id, selected_rule_id, manual_delta_krw, created_at, updated_at")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .order("axis_key", { ascending: true })
    .order("axis_value", { ascending: true });

  if (error) return jsonError(error.message ?? "옵션값 정책 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const inputRows = Array.isArray(body.rows) ? body.rows : [];
  if (inputRows.length === 0) return jsonError("rows is required", 400);

  const normalized: PolicyRow[] = [];
  for (let i = 0; i < inputRows.length; i += 1) {
    const result = normalizeRow(inputRows[i]);
    if (!result.ok) return jsonError(`rows[${i}]: ${result.error}`, 400);
    normalized.push(result.row);
  }

  const dedup = new Map<string, PolicyRow>();
  for (const row of normalized) {
    const key = `${row.channel_id}::${row.master_item_id}::${row.axis_key}::${row.axis_value}`;
    dedup.set(key, row);
  }
  const rows = Array.from(dedup.values());

  const pairKeys = new Set<string>();
  for (const row of rows) {
    pairKeys.add(`${row.channel_id}::${row.master_item_id}`);
  }

  const previousByKey = new Map<string, SavedPolicyRow>();
  for (const pairKey of pairKeys) {
    const [channelId, masterItemId] = pairKey.split("::");
    const existingRes = await sb
      .from("channel_option_value_policy")
      .select("policy_id, channel_id, master_item_id, axis_key, axis_value, axis_mode, rule_type, value_mode, sync_rule_set_id, selected_rule_id, manual_delta_krw, created_at, updated_at")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId);

    if (existingRes.error) return jsonError(existingRes.error.message ?? "기존 옵션값 정책 조회 실패", 500);
    const existingRows = (existingRes.data ?? []) as SavedPolicyRow[];
    for (const existingRow of existingRows) {
      previousByKey.set(policyKey(existingRow), existingRow);
    }
  }

  const changeReason = typeof body.change_reason === "string" ? toTrimmed(body.change_reason) : "";
  const changedBy =
    toTrimmed(request.headers.get("x-user-email"))
    || toTrimmed(request.headers.get("x-user-id"))
    || toTrimmed(request.headers.get("x-user"))
    || null;

  const { data, error } = await sb
    .from("channel_option_value_policy")
    .upsert(rows, { onConflict: "channel_id,master_item_id,axis_key,axis_value" })
    .select("policy_id, channel_id, master_item_id, axis_key, axis_value, axis_mode, rule_type, value_mode, sync_rule_set_id, selected_rule_id, manual_delta_krw, created_at, updated_at");

  if (error) return jsonError(error.message ?? "옵션값 정책 저장 실패", 400);

  const savedRows = (data ?? []) as SavedPolicyRow[];
  const logRows = savedRows
    .map((row) => {
      const prev = previousByKey.get(policyKey(row));
      if (!policyChanged(prev, row)) return null;
      return {
        policy_id: row.policy_id,
        channel_id: row.channel_id,
        master_item_id: row.master_item_id,
        axis_key: row.axis_key,
        axis_value: row.axis_value,
        action_type: prev ? "UPDATE" : "CREATE",
        old_row: prev ?? null,
        new_row: row,
        change_reason: changeReason || null,
        changed_by: changedBy,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (logRows.length > 0) {
    const logRes = await sb
      .from("channel_option_value_policy_log")
      .insert(logRows);
    if (logRes.error) {
      return jsonError(logRes.error.message ?? "옵션값 정책 로그 저장 실패", 500);
    }
  }

  return NextResponse.json(
    {
      data: data ?? [],
      requested: inputRows.length,
      deduplicated: rows.length,
      saved: (data ?? []).length,
      logged: logRows.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
