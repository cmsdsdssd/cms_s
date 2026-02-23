import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type HeaderRow = {
  shipment_id: string;
  ship_date?: string | null;
  status?: string | null;
  customer?: { name?: string | null } | null;
};

type LineRow = {
  shipment_line_id: string;
  shipment_id: string;
  model_name?: string | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  memo?: string | null;
  net_weight_g?: number | null;
  measured_weight_g?: number | null;
  deduction_weight_g?: number | null;
  base_labor_krw?: number | null;
  labor_total_sell_krw?: number | null;
  extra_labor_krw?: number | null;
  extra_labor_items?: unknown;
  created_at?: string | null;
};

const IMAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "master_images";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function normalizeImagePath(path: string, bucket: string) {
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  if (path.startsWith("storage/v1/object/public/")) {
    return path.replace("storage/v1/object/public/", "").split("/").slice(1).join("/");
  }
  return path;
}

async function fetchLines(supabase: AdminClient, shipmentIds: string[]) {
  const fullSelect =
    "shipment_line_id, shipment_id, model_name, material_code, color, size, memo, net_weight_g, measured_weight_g, deduction_weight_g, base_labor_krw, labor_total_sell_krw, extra_labor_krw, extra_labor_items, created_at";
  const fallbackSelect =
    "shipment_line_id, shipment_id, model_name, material_code, size, net_weight_g, measured_weight_g, deduction_weight_g, base_labor_krw, labor_total_sell_krw, extra_labor_krw, created_at";

  const { data: fullData, error: fullError } = await supabase
    .from("cms_shipment_line")
    .select(fullSelect)
    .in("shipment_id", shipmentIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (!fullError) return (fullData ?? []) as LineRow[];

  const { data: liteData, error: liteError } = await supabase
    .from("cms_shipment_line")
    .select(fallbackSelect)
    .in("shipment_id", shipmentIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (liteError) throw liteError;
  return (liteData ?? []) as LineRow[];
}

async function enrichLines(supabase: AdminClient, lines: LineRow[]) {
  const modelNames = Array.from(
    new Set(lines.map((line) => String(line.model_name ?? "").trim()).filter(Boolean))
  );
  const imageByModel = new Map<string, string | null>();
  const vendorIdByModel = new Map<string, string | null>();

  if (modelNames.length > 0) {
    const { data: masterData, error: masterError } = await supabase
      .from("cms_master_item")
      .select("model_name,image_path,vendor_party_id")
      .in("model_name", modelNames);
    if (!masterError && masterData) {
      for (const row of masterData as Array<{ model_name?: string | null; image_path?: string | null; vendor_party_id?: string | null }>) {
        const modelName = String(row.model_name ?? "").trim();
        if (!modelName) continue;
        const path = String(row.image_path ?? "").trim();
        if (path) {
          const normalized = normalizeImagePath(path, IMAGE_BUCKET);
          const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(normalized);
          imageByModel.set(modelName, data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null);
        } else {
          imageByModel.set(modelName, null);
        }
        vendorIdByModel.set(modelName, String(row.vendor_party_id ?? "").trim() || null);
      }
    }
  }

  const vendorIds = Array.from(new Set(Array.from(vendorIdByModel.values()).filter(Boolean))) as string[];
  const vendorById = new Map<string, string>();

  if (vendorIds.length > 0) {
    const { data: vendorData, error: vendorError } = await supabase
      .from("cms_party")
      .select("party_id,name")
      .in("party_id", vendorIds);
    if (!vendorError && vendorData) {
      for (const row of vendorData as Array<{ party_id?: string | null; name?: string | null }>) {
        const id = String(row.party_id ?? "").trim();
        if (!id) continue;
        vendorById.set(id, String(row.name ?? "").trim() || id);
      }
    }
  }

  return lines.map((line) => {
    const modelName = String(line.model_name ?? "").trim();
    const vendorId = vendorIdByModel.get(modelName) ?? null;
    return {
      ...line,
      image_url: modelName ? (imageByModel.get(modelName) ?? null) : null,
      vendor_name: vendorId ? (vendorById.get(vendorId) ?? vendorId) : null,
    };
  });
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase server env missing" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const shipmentId = String(searchParams.get("shipment_id") ?? "").trim();
    const shipmentIdsRaw = String(searchParams.get("shipment_ids") ?? "").trim();

    if (shipmentId) {
      const { data: headerData, error: headerError } = await supabase
        .from("cms_shipment_header")
        .select("shipment_id, ship_date, status, customer:cms_party(name)")
        .eq("shipment_id", shipmentId)
        .maybeSingle();
      if (headerError) throw headerError;

      const lines = await fetchLines(supabase, [shipmentId]);
      const enriched = await enrichLines(supabase, lines);
      return NextResponse.json({ header: (headerData ?? null) as HeaderRow | null, lines: enriched });
    }

    if (shipmentIdsRaw) {
      const shipmentIds = Array.from(
        new Set(
          shipmentIdsRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        )
      );
      if (shipmentIds.length === 0) return NextResponse.json({ preview: {} });

      const lines = await fetchLines(supabase, shipmentIds);
      const preview: Record<string, { model_name?: string | null; material_code?: string | null; color?: string | null; size?: string | null; memo?: string | null }> = {};
      for (const line of lines) {
        const sid = String(line.shipment_id ?? "").trim();
        if (!sid || preview[sid]) continue;
        preview[sid] = {
          model_name: line.model_name ?? null,
          material_code: line.material_code ?? null,
          color: line.color ?? null,
          size: line.size ?? null,
          memo: line.memo ?? null,
        };
      }
      return NextResponse.json({ preview });
    }

    return NextResponse.json({ error: "shipment_id 또는 shipment_ids가 필요합니다." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "모바일 출고확정 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
