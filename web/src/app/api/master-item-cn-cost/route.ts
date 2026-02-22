import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

type ExtraItemInput = {
  label?: unknown;
  basis?: unknown;
  cny_per_g?: unknown;
  cny_per_piece?: unknown;
};

type ExtraItemNormalized =
  | { label: string; basis: "PER_G"; cny_per_g: number }
  | { label: string; basis: "PER_PIECE"; cny_per_piece: number };

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeExtraItems = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  const out: ExtraItemNormalized[] = [];
  for (const it of raw as ExtraItemInput[]) {
    const label = String(it?.label ?? "").trim();
    if (!label) continue;
    if (label.length > 40) continue;

    const basisRaw = String(it?.basis ?? "PER_G").trim().toUpperCase();
    const basis = basisRaw === "PER_PIECE" ? "PER_PIECE" : "PER_G";

    if (basis === "PER_PIECE") {
      const cny = toNum(it?.cny_per_piece);
      if (cny === null || cny < 0) continue;
      out.push({ label, basis: "PER_PIECE", cny_per_piece: cny });
    } else {
      const cny = toNum(it?.cny_per_g);
      if (cny === null || cny < 0) continue;
      out.push({ label, basis: "PER_G", cny_per_g: cny });
    }

    if (out.length >= 12) break;
  }
  return out;
};

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null;

type RawEntryNormalized = {
  requestId: string | null;
  analysisDate: string | null;
  totalPriceCny: number;
  silverPriceCnyPerG: number;
  laborBasis: "PER_G" | "PER_PIECE";
  netWeightGSnapshot: number;
  silverAmountCnySnapshot: number;
  laborBaseCnySnapshot: number;
  laborCnySnapshot: number;
  cnyKrwRateSnapshot: number;
  fxAsof: string;
  silverPriceKrwPerGSnapshot: number;
  laborKrwSnapshot: number;
  totalCostKrwSnapshot: number;
};

const SNAPSHOT_TABLE = "cms_master_item_cn_raw_cost_snapshot";
const CURRENT_ROWS_TABLE = "cms_master_item_cn_raw_cost_entry";

const isMissingRawColumnError = (error: SupabaseLikeError) => {
  const code = String(error?.code ?? "").trim().toUpperCase();
  const message = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const hint = String(error?.hint ?? "");
  const lower = `${message} ${details} ${hint}`.toLowerCase();
  const mentionsRawColumn =
    lower.includes("cn_raw_") ||
    lower.includes("cn_raw_cost_date") ||
    lower.includes("cn_raw_total_price_cny") ||
    lower.includes("cn_raw_silver_price_cny") ||
    lower.includes("cn_raw_labor_basis");

  if (code === "42703" || code === "PGRST204" || code === "PGRST205") return true;
  if (lower.includes("schema cache") && mentionsRawColumn) return true;
  if (lower.includes("could not find") && mentionsRawColumn) return true;
  return false;
};

const isSnapshotSkippableError = (error: SupabaseLikeError) => {
  const code = String(error?.code ?? "").trim().toUpperCase();
  const message = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const hint = String(error?.hint ?? "");
  const lower = `${message} ${details} ${hint}`.toLowerCase();
  const snapshotRelated =
    lower.includes("cms_master_item_cn_raw_cost_snapshot") ||
    lower.includes("cn_raw") ||
    lower.includes("schema cache") ||
    lower.includes("could not find");
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") return true;
  return snapshotRelated;
};

const isCurrentRowsSkippableError = (error: SupabaseLikeError) => {
  const code = String(error?.code ?? "").trim().toUpperCase();
  const message = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const hint = String(error?.hint ?? "");
  const lower = `${message} ${details} ${hint}`.toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") return true;
  return lower.includes(CURRENT_ROWS_TABLE) || lower.includes("schema cache") || lower.includes("could not find");
};

const normalizeRawLaborBasis = (value: unknown): "PER_G" | "PER_PIECE" =>
  String(value ?? "PER_G").trim().toUpperCase() === "PER_PIECE" ? "PER_PIECE" : "PER_G";

const normalizeRawEntry = (input: Record<string, unknown>): RawEntryNormalized => {
  const requestIdText = String(input.request_id ?? "").trim();
  const requestId = requestIdText && isUuid(requestIdText) ? requestIdText : null;
  const rawCostDateText = String(input.analysis_date ?? input.cn_raw_cost_date ?? "").trim();
  const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(rawCostDateText) ? rawCostDateText : null;
  const totalPriceCny = Math.max(toNum(input.total_price_cny ?? input.cn_raw_total_price_cny) ?? 0, 0);
  const silverPriceCnyPerG = Math.max(toNum(input.silver_price_cny_per_g ?? input.cn_raw_silver_price_cny) ?? 0, 0);
  const laborBasis = normalizeRawLaborBasis(input.labor_basis ?? input.cn_raw_labor_basis);
  const netWeightGSnapshot = Math.max(toNum(input.net_weight_g_snapshot ?? input.cn_net_weight_g_snapshot) ?? 0, 0);
  const silverAmountCnySnapshot = Math.max(toNum(input.silver_amount_cny_snapshot ?? input.cn_silver_amount_cny_snapshot) ?? 0, 0);
  const laborBaseCnySnapshot = toNum(input.labor_base_cny_snapshot ?? input.cn_labor_base_cny_snapshot) ?? 0;
  const laborCnySnapshot = toNum(input.labor_cny_snapshot ?? input.cn_labor_cny_snapshot) ?? 0;
  const cnyKrwRateSnapshot = Math.max(toNum(input.cny_krw_rate_snapshot ?? input.cn_cny_krw_rate_snapshot) ?? 0, 0);
  const fxAsofRaw = String(input.fx_asof ?? input.cn_fx_asof ?? "").trim();
  const fxAsof = fxAsofRaw || new Date().toISOString();
  const silverPriceKrwPerGSnapshot = Math.max(
    toNum(input.silver_price_krw_per_g_snapshot ?? input.cn_silver_price_krw_per_g_snapshot) ?? 0,
    0
  );
  const laborKrwSnapshot = toNum(input.labor_krw_snapshot ?? input.cn_labor_krw_snapshot) ?? 0;
  const totalCostKrwSnapshot = Math.max(toNum(input.total_cost_krw_snapshot ?? input.cn_total_cost_krw_snapshot) ?? 0, 0);
  return {
    requestId,
    analysisDate,
    totalPriceCny,
    silverPriceCnyPerG,
    laborBasis,
    netWeightGSnapshot,
    silverAmountCnySnapshot,
    laborBaseCnySnapshot,
    laborCnySnapshot,
    cnyKrwRateSnapshot,
    fxAsof,
    silverPriceKrwPerGSnapshot,
    laborKrwSnapshot,
    totalCostKrwSnapshot,
  };
};

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const masterId = String(searchParams.get("master_id") ?? "").trim();
  if (!masterId || !isUuid(masterId)) {
    return NextResponse.json({ error: "master_id(UUID) 값이 필요합니다." }, { status: 400 });
  }

  const { data: snapshotData, error: snapshotError } = await supabase
    .from(SNAPSHOT_TABLE)
    .select(
      "snapshot_id,analysis_date,labor_basis,total_price_cny,silver_price_cny_per_g,labor_cny_snapshot,total_cost_krw_snapshot,cny_krw_rate_snapshot,silver_price_krw_per_g_snapshot,labor_krw_snapshot,created_at"
    )
    .eq("master_id", masterId)
    .order("analysis_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!snapshotError) {
    return NextResponse.json({ data: snapshotData ?? [] });
  }

  if (!isSnapshotSkippableError(snapshotError as SupabaseLikeError)) {
    return NextResponse.json({ error: snapshotError.message ?? "RAW 분석 이력 조회에 실패했습니다." }, { status: 400 });
  }

  const { data: currentRowsData, error: currentRowsError } = await supabase
    .from(CURRENT_ROWS_TABLE)
    .select(
      "entry_id,analysis_date,labor_basis,total_price_cny,silver_price_cny_per_g,labor_cny_snapshot,total_cost_krw_snapshot,cny_krw_rate_snapshot,silver_price_krw_per_g_snapshot,labor_krw_snapshot,created_at"
    )
    .eq("master_id", masterId)
    .is("deleted_at", null)
    .order("analysis_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (currentRowsError) {
    if (isCurrentRowsSkippableError(currentRowsError as SupabaseLikeError)) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: currentRowsError.message ?? "RAW 분석 이력 조회에 실패했습니다." }, { status: 400 });
  }

  const rows = (currentRowsData ?? []).map((row) => ({
    ...row,
    snapshot_id: row.entry_id,
  }));
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const masterId = String(body.master_id ?? "").trim();
  if (!masterId || !isUuid(masterId)) {
    return NextResponse.json({ error: "master_id(UUID) 값이 필요합니다." }, { status: 400 });
  }

  const basicCny = Math.max(toNum(body.cn_labor_basic_cny_per_g) ?? 0, 0);
  const extraItems = normalizeExtraItems(body.cn_labor_extra_items);
  const rawEntriesInput = Array.isArray(body.cn_raw_entries) ? body.cn_raw_entries : [];
  const normalizedEntries = rawEntriesInput
    .map((entry) => (entry && typeof entry === "object" && !Array.isArray(entry) ? normalizeRawEntry(entry as Record<string, unknown>) : null))
    .filter((entry): entry is RawEntryNormalized => Boolean(entry))
    .filter(
      (entry) =>
        Boolean(entry.analysisDate) ||
        entry.totalPriceCny > 0 ||
        entry.silverPriceCnyPerG > 0
    );
  if (normalizedEntries.length === 0) {
    const singleFallback = normalizeRawEntry(body);
    if (singleFallback.analysisDate || singleFallback.totalPriceCny > 0 || singleFallback.silverPriceCnyPerG > 0) {
      normalizedEntries.push(singleFallback);
    }
  }
  const latestEntry = normalizedEntries[normalizedEntries.length - 1] ?? normalizeRawEntry(body);
  const formulaVersion = Math.max(Math.trunc(toNum(body.cn_formula_version) ?? 1), 1);
  const source = String(body.cn_source ?? "catalog:web").trim() || "catalog:web";
  const rawInput =
    body.cn_raw_input && typeof body.cn_raw_input === "object" && !Array.isArray(body.cn_raw_input)
      ? body.cn_raw_input
      : {};
  const computed =
    body.cn_raw_computed && typeof body.cn_raw_computed === "object" && !Array.isArray(body.cn_raw_computed)
      ? body.cn_raw_computed
      : {};

  const updatePayload: Record<string, unknown> = {
    cn_labor_basic_cny_per_g: basicCny,
    cn_labor_extra_items: extraItems,
    cn_raw_cost_date: latestEntry.analysisDate,
    cn_raw_total_price_cny: latestEntry.totalPriceCny,
    cn_raw_silver_price_cny: latestEntry.silverPriceCnyPerG,
    cn_raw_labor_basis: latestEntry.laborBasis,
  };

  const { error } = await supabase
    .from("cms_master_item")
    .update(updatePayload)
    .eq("master_id", masterId);

  let rawSaved = true;

  if (error && isMissingRawColumnError(error as SupabaseLikeError)) {
    const legacyPayload: Record<string, unknown> = {
      cn_labor_basic_cny_per_g: basicCny,
      cn_labor_extra_items: extraItems,
    };
    const { error: legacyError } = await supabase
      .from("cms_master_item")
      .update(legacyPayload)
      .eq("master_id", masterId);

    if (legacyError) {
      return NextResponse.json({ error: legacyError.message ?? "저장에 실패했습니다." }, { status: 400 });
    }

    rawSaved = false;
  }

  if (error && rawSaved) {
    return NextResponse.json({ error: error.message ?? "저장에 실패했습니다." }, { status: 400 });
  }

  let currentRowsSaved = true;
  let currentRowsHint = "";
  const currentRows = normalizedEntries.map((entry) => ({
    master_id: masterId,
    entry_id: entry.requestId ?? crypto.randomUUID(),
    source,
    formula_version: formulaVersion,
    analysis_date: entry.analysisDate,
    labor_basis: entry.laborBasis,
    total_price_cny: entry.totalPriceCny,
    silver_price_cny_per_g: entry.silverPriceCnyPerG,
    net_weight_g_snapshot: entry.netWeightGSnapshot,
    silver_amount_cny_snapshot: entry.silverAmountCnySnapshot,
    labor_base_cny_snapshot: entry.laborBaseCnySnapshot,
    labor_cny_snapshot: entry.laborCnySnapshot,
    cny_krw_rate_snapshot: entry.cnyKrwRateSnapshot,
    fx_asof: entry.fxAsof,
    silver_price_krw_per_g_snapshot: entry.silverPriceKrwPerGSnapshot,
    labor_krw_snapshot: entry.laborKrwSnapshot,
    total_cost_krw_snapshot: entry.totalCostKrwSnapshot,
    raw_input: rawInput,
    computed,
    deleted_at: null,
  }));

  if (currentRows.length > 0) {
    const { error: upsertCurrentRowsError } = await supabase
      .from(CURRENT_ROWS_TABLE)
      .upsert(currentRows, { onConflict: "master_id,entry_id" });
    if (upsertCurrentRowsError) {
      if (isCurrentRowsSkippableError(upsertCurrentRowsError as SupabaseLikeError)) {
        currentRowsSaved = false;
        currentRowsHint = "RAW 현재행 테이블 미적용/스키마 캐시 상태로 삭제 동기화는 건너뛰었습니다.";
      } else {
        return NextResponse.json({ error: upsertCurrentRowsError.message ?? "RAW 현재행 저장에 실패했습니다." }, { status: 400 });
      }
    }
  }

  if (currentRowsSaved) {
    const { data: activeRowsData, error: activeRowsError } = await supabase
      .from(CURRENT_ROWS_TABLE)
      .select("entry_id")
      .eq("master_id", masterId)
      .is("deleted_at", null);
    if (activeRowsError) {
      if (isCurrentRowsSkippableError(activeRowsError as SupabaseLikeError)) {
        currentRowsSaved = false;
        currentRowsHint = "RAW 현재행 테이블 미적용/스키마 캐시 상태로 삭제 동기화는 건너뛰었습니다.";
      } else {
        return NextResponse.json({ error: activeRowsError.message ?? "RAW 현재행 조회에 실패했습니다." }, { status: 400 });
      }
    } else {
      const keepIds = new Set(currentRows.map((row) => String(row.entry_id)));
      const activeIds = (activeRowsData ?? [])
        .map((row) => String((row as { entry_id?: unknown }).entry_id ?? "").trim())
        .filter((id) => Boolean(id));
      const nowIso = new Date().toISOString();
      for (const entryId of activeIds) {
        if (keepIds.has(entryId)) continue;
        const { error: markDeleteError } = await supabase
          .from(CURRENT_ROWS_TABLE)
          .update({ deleted_at: nowIso })
          .eq("master_id", masterId)
          .eq("entry_id", entryId)
          .is("deleted_at", null);
        if (markDeleteError) {
          if (isCurrentRowsSkippableError(markDeleteError as SupabaseLikeError)) {
            currentRowsSaved = false;
            currentRowsHint = "RAW 현재행 테이블 미적용/스키마 캐시 상태로 삭제 동기화는 건너뛰었습니다.";
            break;
          }
          return NextResponse.json({ error: markDeleteError.message ?? "RAW 삭제 동기화에 실패했습니다." }, { status: 400 });
        }
      }
    }
  }

  let snapshotSaved = true;
  let snapshotHint = "";
  let snapshotInserted = 0;
  const snapshotRows: Record<string, unknown>[] = normalizedEntries.map((entry) => ({
    master_id: masterId,
    request_id: entry.requestId,
    source,
    formula_version: formulaVersion,
    analysis_date: entry.analysisDate,
    labor_basis: entry.laborBasis,
    total_price_cny: entry.totalPriceCny,
    silver_price_cny_per_g: entry.silverPriceCnyPerG,
    net_weight_g_snapshot: entry.netWeightGSnapshot,
    silver_amount_cny_snapshot: entry.silverAmountCnySnapshot,
    labor_base_cny_snapshot: entry.laborBaseCnySnapshot,
    labor_cny_snapshot: entry.laborCnySnapshot,
    cny_krw_rate_snapshot: entry.cnyKrwRateSnapshot,
    fx_asof: entry.fxAsof,
    silver_price_krw_per_g_snapshot: entry.silverPriceKrwPerGSnapshot,
    labor_krw_snapshot: entry.laborKrwSnapshot,
    total_cost_krw_snapshot: entry.totalCostKrwSnapshot,
    raw_input: rawInput,
    computed,
  }));

  if (snapshotRows.length > 0) {
    const { error: snapshotBulkError } = await supabase.from(SNAPSHOT_TABLE).insert(snapshotRows);
    if (!snapshotBulkError) {
      snapshotInserted = snapshotRows.length;
    } else {
      const bulkCode = String(snapshotBulkError.code ?? "").trim().toUpperCase();
      if (bulkCode === "23505") {
        for (const row of snapshotRows) {
          const { error: rowError } = await supabase.from(SNAPSHOT_TABLE).insert(row);
          if (!rowError || String(rowError.code ?? "").trim().toUpperCase() === "23505") {
            snapshotInserted += 1;
            continue;
          }
          if (isSnapshotSkippableError(rowError as SupabaseLikeError)) {
            snapshotSaved = false;
            snapshotHint = "RAW 분석 스냅샷 테이블 미적용/스키마 캐시 상태로 일부 이력 저장은 건너뛰었습니다.";
            continue;
          }
          return NextResponse.json({ error: rowError.message ?? "RAW 분석 스냅샷 저장에 실패했습니다." }, { status: 400 });
        }
      } else if (isSnapshotSkippableError(snapshotBulkError as SupabaseLikeError)) {
        snapshotSaved = false;
        snapshotHint = "RAW 분석 스냅샷 테이블 미적용/스키마 캐시 상태로 이력 저장은 건너뛰었습니다.";
      } else {
        return NextResponse.json({ error: snapshotBulkError.message ?? "RAW 분석 스냅샷 저장에 실패했습니다." }, { status: 400 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    raw_saved: rawSaved,
    current_rows_saved: currentRowsSaved,
    snapshot_saved: snapshotSaved,
    snapshot_inserted: snapshotInserted,
    hint: !rawSaved ? "DB migration(cn_raw_* columns) 적용 전이라 RAW 값은 기존 컬럼에 일부 저장되지 않았습니다." : undefined,
    current_rows_hint: currentRowsHint || undefined,
    snapshot_hint: snapshotHint || undefined,
  });
}
