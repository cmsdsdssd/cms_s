import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const fnName = process.env.NEXT_PUBLIC_MS_FN_MASTER_UPSERT ?? "";
  if (!fnName) {
    return NextResponse.json({ error: "저장 RPC가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const requiredKeys = [
    "p_master_item_id",
    "p_model_name",
    "p_actor_type",
    "p_actor_id",
    "p_correlation_id",
    "p_idempotency_key",
  ];
  for (const key of requiredKeys) {
    if (!body[key]) {
      return NextResponse.json({ error: `${key} 값이 필요합니다.` }, { status: 400 });
    }
  }

  const { data, error } = await supabase.schema("ms_s").rpc(fnName, body);
  if (error) {
    return NextResponse.json({ error: error.message ?? "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? {});
}
