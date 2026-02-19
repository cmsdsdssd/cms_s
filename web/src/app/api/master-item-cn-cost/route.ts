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

  const updatePayload: Record<string, unknown> = {
    cn_labor_basic_cny_per_g: basicCny,
    cn_labor_extra_items: extraItems,
  };

  const { error } = await supabase
    .from("cms_master_item")
    .update(updatePayload)
    .eq("master_id", masterId);

  if (error) {
    return NextResponse.json({ error: error.message ?? "저장에 실패했습니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
