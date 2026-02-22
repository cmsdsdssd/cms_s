import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PRODUCT_MASTER_IDS = 60;

type BomRecipeWorklistRow = {
  bom_id: string;
  product_master_id: string;
  variant_key?: string | null;
};

type BomRecipeLineEnrichedRow = {
  bom_id: string;
  bom_line_id: string;
  line_no: number;
  component_ref_type?: "MASTER" | "PART" | null;
  component_master_id?: string | null;
  component_master_model_name?: string | null;
  qty_per_unit?: number | null;
  note?: string | null;
};

type DecorLineLite = {
  product_master_id: string;
  bom_id: string;
  bom_line_id: string;
  component_master_id: string;
  component_master_model_name: string | null;
  qty_per_unit: number;
  note: string | null;
  line_no: number;
};

function getSupabaseAdmin(): SupabaseClient<unknown> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeVariantKey(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isDecorLine(note: string | null | undefined): boolean {
  return String(note ?? "").trim().toUpperCase().startsWith("LINE_KIND:DECOR");
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase server env missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
        hint: "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in server env (.env.local on dev).",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawIds = String(searchParams.get("product_master_ids") ?? "").trim();
  const productMasterIds = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];

  if (productMasterIds.length === 0) {
    return NextResponse.json({ error: "product_master_ids is required" }, { status: 400 });
  }

  if (productMasterIds.length > MAX_PRODUCT_MASTER_IDS) {
    return NextResponse.json(
      { error: `product_master_ids supports up to ${MAX_PRODUCT_MASTER_IDS} items` },
      { status: 400 }
    );
  }

  const { data: recipesRaw, error: recipesError } = await supabase
    .from(CONTRACTS.views.bomRecipeWorklist)
    .select("bom_id, product_master_id, variant_key")
    .in("product_master_id", productMasterIds)
    .order("variant_key", { ascending: true });

  if (recipesError) {
    return NextResponse.json({ error: recipesError.message ?? "BOM 레시피 조회 실패" }, { status: 500 });
  }

  const recipes = (recipesRaw ?? []) as BomRecipeWorklistRow[];
  const recipesByProductId = new Map<string, BomRecipeWorklistRow[]>();
  recipes.forEach((row) => {
    const productId = String(row.product_master_id ?? "").trim();
    if (!productId) return;
    const existing = recipesByProductId.get(productId) ?? [];
    existing.push(row);
    recipesByProductId.set(productId, existing);
  });

  const selectedRecipeByProductId = new Map<string, BomRecipeWorklistRow>();
  productMasterIds.forEach((productId) => {
    const rows = recipesByProductId.get(productId) ?? [];
    if (rows.length === 0) return;
    const defaultRow = rows.find((row) => normalizeVariantKey(row.variant_key) === "") ?? rows[0];
    if (defaultRow) {
      selectedRecipeByProductId.set(productId, defaultRow);
    }
  });

  const selectedBomIds = [...new Set(
    [...selectedRecipeByProductId.values()]
      .map((row) => String(row.bom_id ?? "").trim())
      .filter(Boolean)
  )];

  if (selectedBomIds.length === 0) {
    return NextResponse.json({ data: [] as DecorLineLite[] }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: linesRaw, error: linesError } = await supabase
    .from(CONTRACTS.views.bomRecipeLinesEnriched)
    .select("bom_id, bom_line_id, line_no, component_ref_type, component_master_id, component_master_model_name, qty_per_unit, note")
    .in("bom_id", selectedBomIds)
    .eq("is_void", false)
    .order("line_no", { ascending: true });

  if (linesError) {
    return NextResponse.json({ error: linesError.message ?? "BOM 라인 조회 실패" }, { status: 500 });
  }

  const lines = (linesRaw ?? []) as BomRecipeLineEnrichedRow[];
  const productIdByBomId = new Map<string, string>();
  selectedRecipeByProductId.forEach((recipe, productId) => {
    const bomId = String(recipe.bom_id ?? "").trim();
    if (bomId) productIdByBomId.set(bomId, productId);
  });

  const data: DecorLineLite[] = lines
    .filter((line) => isDecorLine(line.note))
    .filter((line) => String(line.component_ref_type ?? "").trim().toUpperCase() === "MASTER")
    .map((line) => {
      const bomId = String(line.bom_id ?? "").trim();
      const productMasterId = productIdByBomId.get(bomId) ?? "";
      const componentMasterId = String(line.component_master_id ?? "").trim();
      if (!productMasterId || !bomId || !componentMasterId) return null;
      return {
        product_master_id: productMasterId,
        bom_id: bomId,
        bom_line_id: String(line.bom_line_id ?? "").trim(),
        component_master_id: componentMasterId,
        component_master_model_name: line.component_master_model_name ? String(line.component_master_model_name) : null,
        qty_per_unit: Number(line.qty_per_unit ?? 0),
        note: line.note ? String(line.note) : null,
        line_no: Number(line.line_no ?? 0),
      } satisfies DecorLineLite;
    })
    .filter((line): line is DecorLineLite => line !== null);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
