import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type BuyMarginProfileRow = {
  profile_id: string;
  profile_name: string;
  margin_center_krw: number;
  margin_sub1_krw: number;
  margin_sub2_krw: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

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

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cms_buy_margin_profile_v1")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as BuyMarginProfileRow[] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const profileName = String(body.profile_name ?? "").trim();
  const marginCenter = toNumber(body.margin_center_krw);
  const marginSub1 = toNumber(body.margin_sub1_krw);
  const marginSub2 = toNumber(body.margin_sub2_krw);

  if (!profileName) {
    return NextResponse.json({ error: "profile_name 값이 필요합니다." }, { status: 400 });
  }
  if (marginCenter === null || marginCenter < 0) {
    return NextResponse.json({ error: "margin_center_krw는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (marginSub1 === null || marginSub1 < 0) {
    return NextResponse.json({ error: "margin_sub1_krw는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (marginSub2 === null || marginSub2 < 0) {
    return NextResponse.json({ error: "margin_sub2_krw는 0 이상이어야 합니다." }, { status: 400 });
  }

  const profileId = toNullableText(body.profile_id) ?? crypto.randomUUID();
  const payload = {
    profile_id: profileId,
    profile_name: profileName,
    margin_center_krw: marginCenter,
    margin_sub1_krw: marginSub1,
    margin_sub2_krw: marginSub2,
    is_active: body.is_active === false ? false : true,
    note: toNullableText(body.note),
  };

  const { data, error } = await supabase
    .from("cms_buy_margin_profile_v1")
    .upsert(payload, { onConflict: "profile_id" })
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
  const profileId = searchParams.get("profile_id")?.trim() ?? "";
  if (!profileId) {
    return NextResponse.json({ error: "profile_id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("cms_buy_margin_profile_v1")
    .delete()
    .eq("profile_id", profileId);

  if (error) {
    return NextResponse.json({ error: error.message ?? "삭제 실패" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
