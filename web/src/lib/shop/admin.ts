import { createClient } from "@supabase/supabase-js";

export function getShopAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
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
