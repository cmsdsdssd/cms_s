import { createClient } from "@supabase/supabase-js";

export function getShopAdminClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: message, ...(extra ?? {}) }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseUuidArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return null;
  const out = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return out;
}

type DbErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export function isMissingColumnError(error: unknown, columnName?: string) {
  if (!error || typeof error !== "object") return false;
  const err = error as DbErrorLike;
  const haystack = [err.message, err.details, err.hint, err.code]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  if (!haystack) return false;

  const mentionsMissingColumn =
    haystack.includes("does not exist") ||
    haystack.includes("could not find") ||
    haystack.includes("schema cache") ||
    haystack.includes("column");
  if (!mentionsMissingColumn) return false;

  if (!columnName) return true;

  const normalizedColumn = columnName.toLowerCase();
  const bareColumn = normalizedColumn.includes(".")
    ? normalizedColumn.slice(normalizedColumn.lastIndexOf(".") + 1)
    : normalizedColumn;
  return haystack.includes(normalizedColumn) || haystack.includes(bareColumn);
}

export function isMissingSchemaObjectError(error: unknown, objectName?: string) {
  if (!error || typeof error !== "object") return false;
  const err = error as DbErrorLike;
  const haystack = [err.message, err.details, err.hint, err.code]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  if (!haystack) return false;

  const mentionsMissingObject =
    (haystack.includes("could not find the table") && haystack.includes("schema cache")) ||
    (haystack.includes("relation") && haystack.includes("does not exist")) ||
    haystack.includes("does not exist");
  if (!mentionsMissingObject) return false;

  if (!objectName) return true;
  const normalizedObject = objectName.toLowerCase();
  const bareObject = normalizedObject.includes(".")
    ? normalizedObject.slice(normalizedObject.lastIndexOf(".") + 1)
    : normalizedObject;
  return haystack.includes(normalizedObject) || haystack.includes(bareObject);
}
