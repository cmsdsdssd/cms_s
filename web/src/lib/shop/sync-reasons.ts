type SyncStatus = "SUCCESS" | "FAILED" | "SKIPPED";

type ReasonMeta = {
  label: string;
  category: "BENIGN_SKIP" | "DATA_GAP" | "MAPPING_REQUIRED" | "EXTERNAL_API" | "VALIDATION" | "VERIFY_PENDING" | "PIPELINE" | "UNKNOWN";
};

export type SyncReasonSummary = {
  status: "FAILED" | "SKIPPED";
  reason_code: string;
  reason_label: string;
  reason_category: ReasonMeta["category"];
  count: number;
};

const REASON_META: Record<string, ReasonMeta> = {
  INVALID_TARGET_PRICE: { label: "유효하지 않은 목표가", category: "VALIDATION" },
  VERIFY_PENDING: { label: "검증 지연(반영 확인 대기)", category: "VERIFY_PENDING" },
  VERIFY_MISMATCH: { label: "검증 불일치", category: "VERIFY_PENDING" },
  BASE_PRICE_IMMUTABLE_OPTION_TYPE_C: { label: "옵션형(C) 기본가 직접반영 불가", category: "BENIGN_SKIP" },
  BASE_PRICE_IMMUTABLE_OPTION_PRODUCT: { label: "옵션상품 기본가 직접반영 불가", category: "BENIGN_SKIP" },
  BASE_PRICE_DEFERRED_TO_VARIANTS: { label: "기본행은 제외하고 variant 기준으로 동기화", category: "BENIGN_SKIP" },
  BASE_PRICE_IMMUTABLE_NEEDS_VARIANT_MAPPING: { label: "옵션코드 매핑 필요", category: "MAPPING_REQUIRED" },
  VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C: { label: "옵션형(C) 추가금 반영 불가", category: "BENIGN_SKIP" },
  ACTIVE_VARIANT_MAPPING_CONFLICT: { label: "활성 variant 매핑 충돌", category: "MAPPING_REQUIRED" },
  PRODUCT_ENDPOINT_NOT_FOUND: { label: "카페24 상품 엔드포인트 미발견", category: "EXTERNAL_API" },
  PUSH_RESULT_FILTERED_OR_MISSING: { label: "push 결과 누락/필터링", category: "PIPELINE" },
  PUSH_FAILED: { label: "push 호출 실패", category: "PIPELINE" },
  SOT_SYNC_RULESET_REQUIRED: { label: "SYNC 룰셋 미설정", category: "DATA_GAP" },
  SOT_RULESET_INCONSISTENT: { label: "SYNC 룰셋 불일치", category: "DATA_GAP" },
  MISSING_FLOOR_PRICE: { label: "바닥가 미설정", category: "DATA_GAP" },
};

const inferFromText = (text: string): string | null => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("no api found")) return "PRODUCT_ENDPOINT_NOT_FOUND";
  if (normalized.includes("additional_amount mismatch")) return "VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C";
  if (normalized.includes("push_result_filtered_or_missing")) return "PUSH_RESULT_FILTERED_OR_MISSING";
  if (normalized.includes("sync_rule_set_id") && normalized.includes("필요")) return "SOT_SYNC_RULESET_REQUIRED";
  if (normalized.includes("바닥가격") && normalized.includes("미설정")) return "MISSING_FLOOR_PRICE";
  return null;
};

const pickObjectCode = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const code = String(obj.error_code ?? obj.code ?? "").trim();
  if (code) return code.toUpperCase();
  const nested = obj.raw_response_json;
  if (nested && typeof nested === "object") {
    const nestedCode = pickObjectCode(nested);
    if (nestedCode) return nestedCode;
  }
  return null;
};

export function inferSyncReasonCode(input: {
  status: SyncStatus;
  error_code?: string | null;
  error_message?: string | null;
  raw_response_json?: unknown;
  last_error?: string | null;
}): string {
  const directCode = String(input.error_code ?? "").trim().toUpperCase();
  if (directCode) return directCode;

  const objectCode = pickObjectCode(input.raw_response_json);
  if (objectCode) return objectCode;

  const lastErrorCode = inferFromText(String(input.last_error ?? ""));
  if (lastErrorCode) return lastErrorCode;

  const errorCode = inferFromText(String(input.error_message ?? ""));
  if (errorCode) return errorCode;

  return input.status === "SKIPPED" ? "SKIPPED_UNKNOWN" : input.status === "FAILED" ? "FAILED_UNKNOWN" : "SUCCESS";
}

export function syncReasonMeta(reasonCode: string): ReasonMeta {
  const normalized = String(reasonCode ?? "").trim().toUpperCase();
  return REASON_META[normalized] ?? { label: normalized || "UNKNOWN", category: "UNKNOWN" };
}

export function buildSyncReasonSummary<T extends {
  status: SyncStatus;
  error_code?: string | null;
  error_message?: string | null;
  raw_response_json?: unknown;
  last_error?: string | null;
}>(rows: T[]): SyncReasonSummary[] {
  const counter = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "FAILED" && row.status !== "SKIPPED") continue;
    const reasonCode = inferSyncReasonCode(row);
    const key = `${row.status}::${reasonCode}`;
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  return Array.from(counter.entries())
    .map(([key, count]) => {
      const [status, reasonCode] = key.split("::");
      const meta = syncReasonMeta(reasonCode);
      return {
        status: status as "FAILED" | "SKIPPED",
        reason_code: reasonCode,
        reason_label: meta.label,
        reason_category: meta.category,
        count,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      if (b.count !== a.count) return b.count - a.count;
      return a.reason_code.localeCompare(b.reason_code);
    });
}
