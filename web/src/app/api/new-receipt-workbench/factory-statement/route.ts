import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractStatementLike(value: unknown): { rows: unknown[]; note?: string | null } | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const rows = rec.rows;
  if (!Array.isArray(rows)) return null;
  const note = typeof rec.note === "string" ? rec.note : null;
  return { rows, note };
}

function extractFromRow(row: Record<string, unknown>) {
  const candidates = [
    row.statement,
    row.statement_json,
    row.factory_statement,
    row.factory_statement_json,
    row.payload,
    row.data,
    row.p_statement,
  ];

  for (const candidate of candidates) {
    const statement = extractStatementLike(candidate);
    if (statement) {
      return {
        statement,
        note: statement.note ?? (typeof row.note === "string" ? row.note : null),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      };
    }
  }
  return null;
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const receiptId = String(searchParams.get("receipt_id") ?? "").trim();
  if (!receiptId) {
    return NextResponse.json({ error: "receipt_id required" }, { status: 400 });
  }

  const sourceAttempts: Array<{ table: string; orderByUpdatedAt?: boolean }> = [
    { table: "cms_receipt_factory_statement", orderByUpdatedAt: true },
    { table: "cms_factory_receipt_statement", orderByUpdatedAt: true },
    { table: "cms_receipt_inbox", orderByUpdatedAt: false },
  ];

  for (const source of sourceAttempts) {
    try {
      let query = supabase.from(source.table).select("*").eq("receipt_id", receiptId).limit(1);
      if (source.orderByUpdatedAt) {
        query = query.order("updated_at", { ascending: false });
      }
      const { data, error } = await query.maybeSingle();
      if (error) continue;
      const row = asRecord(data);
      if (!row) continue;
      const extracted = extractFromRow(row);
      if (!extracted) continue;
      return NextResponse.json({ data: extracted });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ data: null });
}
