import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const productMasterId = String(searchParams.get("product_master_id") ?? "").trim();
  const variantKeyRaw = searchParams.get("variant_key");

  if (!productMasterId) {
    return NextResponse.json({ error: "product_master_id 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cms_fn_bom_flatten_active_v1", {
    p_product_master_id: productMasterId,
    p_variant_key: variantKeyRaw && variantKeyRaw.trim() ? variantKeyRaw.trim() : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "BOM 펼침 조회 실패" }, { status: 400 });
  }

  type FlattenRawRow = {
    depth?: number | null;
    path?: unknown;
    qty_per_product_unit?: number | null;
    leaf_ref_type?: "MASTER" | "PART" | string | null;
    leaf_master_id?: string | null;
    leaf_part_id?: string | null;
  };

  const rawRows = Array.isArray(data) ? (data as FlattenRawRow[]) : [];
  const masterIds = Array.from(
    new Set(
      rawRows
        .map((row) => (typeof row.leaf_master_id === "string" ? row.leaf_master_id.trim() : ""))
        .filter(Boolean)
    )
  );
  const partIds = Array.from(
    new Set(
      rawRows
        .map((row) => (typeof row.leaf_part_id === "string" ? row.leaf_part_id.trim() : ""))
        .filter(Boolean)
    )
  );

  const masterNameById = new Map<string, string>();
  const partInfoById = new Map<string, { part_name: string | null; unit_default: string | null }>();

  if (masterIds.length > 0) {
    const { data: masters, error: masterError } = await supabase
      .from("cms_master_item")
      .select("master_id, model_name")
      .in("master_id", masterIds);
    if (masterError) {
      return NextResponse.json({ error: masterError.message ?? "마스터 구성품 조회 실패" }, { status: 400 });
    }
    (masters ?? []).forEach((row) => {
      const id = String(row.master_id ?? "").trim();
      if (!id) return;
      masterNameById.set(id, row.model_name ? String(row.model_name) : "");
    });
  }

  if (partIds.length > 0) {
    const { data: parts, error: partError } = await supabase
      .from("cms_part_item")
      .select("part_id, part_name, unit_default")
      .in("part_id", partIds);
    if (partError) {
      return NextResponse.json({ error: partError.message ?? "파트 구성품 조회 실패" }, { status: 400 });
    }
    (parts ?? []).forEach((row) => {
      const id = String(row.part_id ?? "").trim();
      if (!id) return;
      partInfoById.set(id, {
        part_name: row.part_name ? String(row.part_name) : null,
        unit_default: row.unit_default ? String(row.unit_default) : null,
      });
    });
  }

  const enrichedRows = rawRows.map((row) => {
    const componentRefType = row.leaf_ref_type === "MASTER" || row.leaf_ref_type === "PART" ? row.leaf_ref_type : null;
    const componentMasterId = typeof row.leaf_master_id === "string" && row.leaf_master_id.trim() ? row.leaf_master_id.trim() : null;
    const componentPartId = typeof row.leaf_part_id === "string" && row.leaf_part_id.trim() ? row.leaf_part_id.trim() : null;
    const partInfo = componentPartId ? partInfoById.get(componentPartId) : undefined;
    const pathArray = Array.isArray(row.path)
      ? row.path.map((segment) => String(segment ?? "").trim()).filter(Boolean)
      : [];

    return {
      depth: row.depth ?? null,
      path: pathArray.length > 0 ? pathArray.join(" > ") : null,
      qty_per_product_unit: row.qty_per_product_unit ?? null,
      component_ref_type: componentRefType,
      component_master_id: componentMasterId,
      component_master_model_name: componentMasterId ? (masterNameById.get(componentMasterId) ?? null) : null,
      component_part_id: componentPartId,
      component_part_name: partInfo?.part_name ?? null,
      unit: componentRefType === "MASTER" ? "EA" : (partInfo?.unit_default ?? "EA"),
    };
  });

  return NextResponse.json(enrichedRows, { headers: { "Cache-Control": "no-store" } });
}
