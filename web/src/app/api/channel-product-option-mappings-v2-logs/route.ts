import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toTrimmed = (value: unknown) => String(value ?? "").trim();

const ALLOWED_AXIS_KEYS = new Set(["OTHER_REASON", "OPTION_CATEGORY", "OPTION_AXIS_SELECTION"]);

const normalizeCategoryKey = (value: unknown): "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER" | "NOTICE" | null => {
  const normalized = toTrimmed(value).toUpperCase();
  if (normalized === "MATERIAL" || normalized === "SIZE" || normalized === "COLOR_PLATING" || normalized === "DECOR" || normalized === "OTHER" || normalized === "NOTICE") {
    return normalized;
  }
  return null;
};

const toRoundedOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const readRowValue = (row: Record<string, unknown>, snakeKey: string, camelKey: string): unknown => {
  if (row[snakeKey] !== undefined) return row[snakeKey];
  return row[camelKey];
};

export const buildPolicyLogInsertRows = (args: {
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
  changeReason: string;
  changedBy: string | null;
  rowsRaw: unknown[];
}) => {
  return args.rowsRaw
    .map((rawRow) => {
      const row = parseJsonObject(rawRow);
      if (!row) return null;
      const entryKey = toTrimmed(readRowValue(row, "entry_key", "entryKey"));
      const axisKeyRaw = toTrimmed(readRowValue(row, "axis_key", "axisKey")).toUpperCase();
      if (!entryKey || !axisKeyRaw || !ALLOWED_AXIS_KEYS.has(axisKeyRaw)) return null;
      const axisKey = axisKeyRaw as "OTHER_REASON" | "OPTION_CATEGORY" | "OPTION_AXIS_SELECTION";

      if (axisKey === "OTHER_REASON") {
        const otherReason = toTrimmed(readRowValue(row, "other_reason", "otherReason"));
        if (!otherReason) return null;
        return {
          policy_id: null,
          channel_id: args.channelId,
          master_item_id: args.masterItemId,
          axis_key: "OTHER_REASON",
          axis_value: `${args.externalProductNo}::${entryKey}`,
          action_type: "UPDATE",
          old_row: null,
          new_row: {
            entry_key: entryKey,
            other_reason: otherReason,
            resolved_delta_krw: toRoundedOrNull(readRowValue(row, "resolved_delta_krw", "resolvedDeltaKrw")) ?? 0,
            category_key: normalizeCategoryKey(readRowValue(row, "category_key", "categoryKey")) ?? "OTHER",
          },
          change_reason: args.changeReason || "OTHER_REASON_SAVE",
          changed_by: args.changedBy,
        };
      }

      if (axisKey === "OPTION_CATEGORY") {
        const categoryKey = normalizeCategoryKey(readRowValue(row, "category_key", "categoryKey"));
        if (!categoryKey) return null;
        return {
          policy_id: null,
          channel_id: args.channelId,
          master_item_id: args.masterItemId,
          axis_key: "OPTION_CATEGORY",
          axis_value: `${args.externalProductNo}::${entryKey}`,
          action_type: "UPDATE",
          old_row: null,
          new_row: {
            entry_key: entryKey,
            category_key: categoryKey,
          },
          change_reason: args.changeReason || "OPTION_CATEGORY_SAVE",
          changed_by: args.changedBy,
        };
      }

      if (axisKey === "OPTION_AXIS_SELECTION") {
        const categoryKey = normalizeCategoryKey(readRowValue(row, "category_key", "categoryKey"));
        const axis1Value = toTrimmed(readRowValue(row, "axis1_value", "axis1Value")) || null;
        const axis2Value = toTrimmed(readRowValue(row, "axis2_value", "axis2Value")) || null;
        const axis3Value = toTrimmed(readRowValue(row, "axis3_value", "axis3Value")) || null;
        const decorMasterItemId = toTrimmed(readRowValue(row, "decor_master_item_id", "decorMasterItemId")) || null;
        const decorExtraDeltaKrw = toRoundedOrNull(readRowValue(row, "decor_extra_delta_krw", "decorExtraDeltaKrw"));
        const decorFinalAmountKrw = toRoundedOrNull(readRowValue(row, "decor_final_amount_krw", "decorFinalAmountKrw"));
        const hasMeaningfulSelection = Boolean(
          categoryKey
          || axis1Value
          || axis2Value
          || axis3Value
          || decorMasterItemId
          || decorExtraDeltaKrw != null
          || decorFinalAmountKrw != null,
        );
        if (!hasMeaningfulSelection) return null;
        return {
          policy_id: null,
          channel_id: args.channelId,
          master_item_id: args.masterItemId,
          axis_key: "OPTION_AXIS_SELECTION",
          axis_value: `${args.externalProductNo}::${entryKey}`,
          action_type: "UPDATE",
          old_row: null,
          new_row: {
            entry_key: entryKey,
            category_key: categoryKey,
            axis1_value: axis1Value,
            axis2_value: axis2Value,
            axis3_value: axis3Value,
            decor_master_item_id: decorMasterItemId,
            decor_extra_delta_krw: decorExtraDeltaKrw,
            decor_final_amount_krw: decorFinalAmountKrw,
          },
          change_reason: args.changeReason || "OPTION_AXIS_SELECTION_SAVE",
          changed_by: args.changedBy,
        };
      }

      return null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get("channel_id"));
  const masterItemId = toTrimmed(searchParams.get("master_item_id"));
  const axisKey = toTrimmed(searchParams.get("axis_key")).toUpperCase();
  const externalProductNo = toTrimmed(searchParams.get("external_product_no"));
  const limitRaw = Number(searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  let query = sb
    .from("channel_option_value_policy_log")
    .select("policy_log_id, policy_id, channel_id, master_item_id, axis_key, axis_value, action_type, old_row, new_row, change_reason, changed_by, created_at")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (axisKey) query = query.eq("axis_key", axisKey);
  if (externalProductNo) query = query.like("axis_value", `${externalProductNo}::%`);

  const { data, error } = await query;
  if (error) return jsonError(error.message ?? "옵션 매핑 로그 조회 실패", 500);

  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = toTrimmed(body.channel_id);
  const masterItemId = toTrimmed(body.master_item_id);
  const externalProductNo = toTrimmed(body.external_product_no);
  const changeReason = typeof body.change_reason === "string" ? toTrimmed(body.change_reason) : "";
  const changedBy =
    toTrimmed(request.headers.get("x-user-email"))
    || toTrimmed(request.headers.get("x-user-id"))
    || toTrimmed(request.headers.get("x-user"))
    || null;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];
  if (rowsRaw.length === 0) return jsonError("rows is required", 400);

  const insertRows = buildPolicyLogInsertRows({
    channelId,
    masterItemId,
    externalProductNo,
    changeReason,
    changedBy,
    rowsRaw,
  });

  if (insertRows.length === 0) {
    return NextResponse.json({ data: [], saved: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await sb
    .from("channel_option_value_policy_log")
    .insert(insertRows)
    .select("policy_log_id, axis_key, axis_value, created_at");

  if (error) return jsonError(error.message ?? "옵션 매핑 로그 저장 실패", 500);

  return NextResponse.json({ data: data ?? [], saved: insertRows.length }, { headers: { "Cache-Control": "no-store" } });
}
