import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AbsorbBucket = "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";

type MasterAbsorbLaborItemRow = {
  absorb_item_id: string;
  master_id: string;
  bucket: AbsorbBucket;
  reason: string;
  amount_krw: number;
  is_per_piece: boolean;
  vendor_party_id: string | null;
  priority: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

const BUCKETS = new Set<AbsorbBucket>(["BASE_LABOR", "STONE_LABOR", "PLATING", "ETC"]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const masterId = searchParams.get("master_id")?.trim() ?? "";
  if (!masterId) {
    return NextResponse.json({ error: "master_id가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_master_absorb_labor_item_v1")
    .select("*")
    .eq("master_id", masterId)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as MasterAbsorbLaborItemRow[] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const masterId = String(body.master_id ?? "").trim();
  const bucket = String(body.bucket ?? "").trim() as AbsorbBucket;
  const reason = String(body.reason ?? "").trim();
  const amount = toNumber(body.amount_krw);
  const priorityValue = toNumber(body.priority);

  if (!masterId) {
    return NextResponse.json({ error: "master_id 값이 필요합니다." }, { status: 400 });
  }
  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "bucket 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason 값이 필요합니다." }, { status: 400 });
  }
  if (amount === null || amount < 0) {
    return NextResponse.json({ error: "amount_krw는 0 이상이어야 합니다." }, { status: 400 });
  }

  const absorbItemId = toNullableText(body.absorb_item_id) ?? crypto.randomUUID();
  const payload = {
    absorb_item_id: absorbItemId,
    master_id: masterId,
    bucket,
    reason,
    amount_krw: amount,
    is_per_piece: body.is_per_piece === false ? false : true,
    vendor_party_id: toNullableText(body.vendor_party_id),
    priority: Number.isInteger(priorityValue) ? Number(priorityValue) : 100,
    is_active: body.is_active === false ? false : true,
    note: toNullableText(body.note),
  };

  const { data, error } = await supabase
    .from("cms_master_absorb_labor_item_v1")
    .upsert(payload, { onConflict: "absorb_item_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "저장 실패" }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const absorbItemId = searchParams.get("absorb_item_id")?.trim() ?? "";
  if (!absorbItemId) {
    return NextResponse.json({ error: "absorb_item_id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("cms_master_absorb_labor_item_v1")
    .delete()
    .eq("absorb_item_id", absorbItemId);

  if (error) {
    return NextResponse.json({ error: error.message ?? "삭제 실패" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
