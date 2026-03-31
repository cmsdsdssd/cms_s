import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BaseLaborSellMode = "RULE" | "MULTIPLIER";

type BaseLaborSellConfigRow = {
  base_labor_sell_mode?: string | null;
  base_labor_sell_multiplier?: number | null;
  updated_at?: string | null;
};

const DEFAULT_CONFIG = {
  base_labor_sell_mode: "RULE" as const,
  base_labor_sell_multiplier: null,
  updated_at: null,
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key).schema("public");
}

function normalizeConfig(row: BaseLaborSellConfigRow | null | undefined) {
  const mode = row?.base_labor_sell_mode === "MULTIPLIER" ? "MULTIPLIER" : "RULE";
  const multiplier = Number(row?.base_labor_sell_multiplier ?? Number.NaN);

  if (mode === "MULTIPLIER" && Number.isFinite(multiplier) && multiplier > 0) {
    return {
      base_labor_sell_mode: "MULTIPLIER" as const,
      base_labor_sell_multiplier: multiplier,
      updated_at: row?.updated_at ?? null,
    };
  }

  return {
    ...DEFAULT_CONFIG,
    updated_at: row?.updated_at ?? null,
  };
}

function parseMode(value: unknown): BaseLaborSellMode {
  return String(value ?? "RULE").trim().toUpperCase() === "MULTIPLIER" ? "MULTIPLIER" : "RULE";
}

function parseMultiplier(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("base_labor_sell_multiplier must be > 0 when mode is MULTIPLIER");
  }
  return multiplier;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cms_market_tick_config")
    .select("base_labor_sell_mode, base_labor_sell_multiplier, updated_at")
    .eq("config_key", "DEFAULT")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "base labor sell config read failed" }, { status: 500 });
  }

  return NextResponse.json(
    { data: normalizeConfig((data ?? null) as BaseLaborSellConfigRow | null) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const mode = parseMode(raw.base_labor_sell_mode);
  let multiplier: number | null;
  try {
    multiplier = parseMultiplier(raw.base_labor_sell_multiplier);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid multiplier" }, { status: 400 });
  }

  if (mode === "MULTIPLIER" && multiplier === null) {
    return NextResponse.json({ error: "base_labor_sell_multiplier must be > 0 when mode is MULTIPLIER" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_market_tick_config")
    .upsert(
      {
        config_key: "DEFAULT",
        base_labor_sell_mode: mode,
        base_labor_sell_multiplier: mode === "MULTIPLIER" ? multiplier : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "config_key" }
    )
    .select("base_labor_sell_mode, base_labor_sell_multiplier, updated_at")
    .eq("config_key", "DEFAULT")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "base labor sell config save failed" }, { status: 500 });
  }

  return NextResponse.json(
    { data: normalizeConfig(data as BaseLaborSellConfigRow) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
