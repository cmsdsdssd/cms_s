import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { isBaseVariantCode, shouldPreferCanonicalProductNo } from "@/lib/shop/canonical-mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MappingRow = {
  channel_product_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const [mappingRes, masterRes] = await Promise.all([
    sb
      .from("sales_channel_product")
      .select("channel_product_id, master_item_id, external_product_no, external_variant_code")
      .eq("channel_id", channelId)
      .eq("is_active", true),
    sb
      .from("cms_master_item")
      .select("master_item_id", { count: "exact", head: true }),
  ]);

  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);
  if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 카운트 조회 실패", 500);

  const rows = (mappingRes.data ?? []) as MappingRow[];
  const byMaster = new Map<string, {
    master_item_id: string;
    product_nos: Set<string>;
    variant_count: number;
    base_row_count: number;
    base_row_count_raw: number;
    base_product_no: string;
  }>();

  for (const row of rows) {
    const masterItemId = String(row.master_item_id ?? "").trim();
    if (!masterItemId) continue;
    const productNo = String(row.external_product_no ?? "").trim();
    const variant = String(row.external_variant_code ?? "").trim();

    const acc = byMaster.get(masterItemId) ?? {
      master_item_id: masterItemId,
      product_nos: new Set<string>(),
      variant_count: 0,
      base_row_count: 0,
      base_row_count_raw: 0,
      base_product_no: "",
    };
    if (productNo) acc.product_nos.add(productNo);
    if (!isBaseVariantCode(variant)) acc.variant_count += 1;
    else {
      acc.base_row_count_raw += 1;
      if (shouldPreferCanonicalProductNo(acc.base_product_no, productNo)) {
        acc.base_product_no = productNo;
      }
    }
    acc.base_row_count = acc.base_row_count_raw > 0 ? 1 : 0;
    byMaster.set(masterItemId, acc);
  }

  const mappedMasters = Array.from(byMaster.values()).map((row) => ({
    master_item_id: row.master_item_id,
    product_nos: Array.from(row.product_nos.values()),
    variant_count: row.variant_count,
    base_row_count: row.base_row_count,
    base_row_count_raw: row.base_row_count,
    base_product_no: row.base_product_no || null,
  }));

  const totalMasterCount = Number(masterRes.count ?? 0);
  const mappedMasterCount = mappedMasters.length;
  const unmappedMasterCount = Math.max(0, totalMasterCount - mappedMasterCount);

  return NextResponse.json(
    {
      data: {
        channel_id: channelId,
        active_mapping_rows: rows.length,
        mapped_master_count: mappedMasterCount,
        total_master_count: totalMasterCount,
        unmapped_master_count: unmappedMasterCount,
        mapped_masters: mappedMasters,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
