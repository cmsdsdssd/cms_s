import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import {
  buildOptionAxisFromCanonicalRows,
  buildOptionAxisFromPublishedEntries,
  buildVariantBreakdownFromCanonicalRows,
  buildVariantBreakdownFromPublishedEntries,
} from "@/lib/shop/single-sot-pricing.js";
import { loadPublishedPriceStateByChannelProducts } from "@/lib/shop/publish-price-state";
import { GET as getChannelProductVariants } from "@/app/api/channel-products/variants/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(res: NextResponse | Response): NextResponse {
  const out = new NextResponse(res.body, res);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => out.headers.set(k, v));
  return out;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return withCors(jsonError("Supabase server env missing", 500));

  const url = new URL(request.url);
  const mallId = String(url.searchParams.get("mall_id") ?? "").trim().toLowerCase();
  const productNo = String(url.searchParams.get("product_no") ?? "").trim();
  const secret = String(url.searchParams.get("token") ?? "").trim();
  const requiredSecret = String(process.env.STOREFRONT_BREAKDOWN_PUBLIC_TOKEN ?? "").trim();

  if (!mallId || !productNo) {
    return withCors(jsonError("mall_id and product_no are required", 400));
  }
  if (requiredSecret && secret !== requiredSecret) {
    return withCors(jsonError("forbidden", 403));
  }

  const accountRes = await sb
    .from("sales_channel_account")
    .select("channel_id, mall_id")
    .eq("mall_id", mallId)
    .limit(1)
    .maybeSingle();
  if (accountRes.error) return withCors(jsonError(accountRes.error.message ?? "channel lookup failed", 500));
  if (!accountRes.data?.channel_id) return withCors(jsonError("channel not found", 404));
  const channelId = String(accountRes.data.channel_id);

  const activeMapRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, external_variant_code")
    .eq("channel_id", channelId)
    .eq("external_product_no", productNo)
    .eq("is_active", true);
  if (activeMapRes.error) return withCors(jsonError(activeMapRes.error.message ?? "active mapping lookup failed", 500));
  const activeMapRows = activeMapRes.data ?? [];
  if (activeMapRows.length === 0) {
    return withCors(jsonError("published mapping not found for product", 404));
  }

  const channelProductIds = Array.from(new Set(
    activeMapRows.map((row) => String(row.channel_product_id ?? "").trim()).filter(Boolean),
  ));
  const baseMapping = activeMapRows.find((row) => String(row.external_variant_code ?? "").trim().length === 0) ?? null;
  const baseChannelProductId = String(baseMapping?.channel_product_id ?? "").trim();

  let publishVersion: string | null = null;
  let publishedByChannelProduct = new Map<string, {
    finalTargetPriceKrw: number;
    deltaTotalKrw: number;
    publishVersion: string | null;
  }>();

  const latestPublishRes = await loadPublishedPriceStateByChannelProducts({
    sb,
    channelId,
    channelProductIds: baseChannelProductId ? [baseChannelProductId] : channelProductIds,
  });
  if (latestPublishRes.available) {
    const latestBase = latestPublishRes.rowsByChannelProduct.get(baseChannelProductId) ?? null;
    if (latestBase?.publishVersion) {
      publishVersion = latestBase.publishVersion;
      const versionedPublishRes = await loadPublishedPriceStateByChannelProducts({
        sb,
        channelId,
        channelProductIds,
        publishVersions: [publishVersion],
      });
      if (versionedPublishRes.available) {
        const basePriceByMasterProduct = new Map<string, number>();
        for (const row of versionedPublishRes.rowsByChannelProduct.values()) {
          if (!row.externalVariantCode) {
            basePriceByMasterProduct.set(`${row.masterItemId}::${row.externalProductNo}`, row.publishedBasePriceKrw);
          }
        }
        for (const row of versionedPublishRes.rowsByChannelProduct.values()) {
          const basePrice = row.externalVariantCode
            ? basePriceByMasterProduct.get(`${row.masterItemId}::${row.externalProductNo}`) ?? row.publishedBasePriceKrw
            : row.publishedBasePriceKrw;
          publishedByChannelProduct.set(row.channelProductId, {
            finalTargetPriceKrw: row.externalVariantCode
              ? basePrice + row.publishedAdditionalAmountKrw
              : row.publishedBasePriceKrw,
            deltaTotalKrw: row.publishedAdditionalAmountKrw,
            publishVersion: row.publishVersion,
          });
        }
      }
    }
  }

  if (publishedByChannelProduct.size === 0) {
    return withCors(jsonError("published price rows missing for product", 422, {
      code: "PUBLISHED_PRICE_ROWS_MISSING",
      channel_id: channelId,
      product_no: productNo,
    }));
  }

  const basePublished = baseChannelProductId ? publishedByChannelProduct.get(baseChannelProductId) ?? null : null;
  let previewAxis = null;
  let breakdown = { byVariant: [] as Array<Record<string, unknown>> };
  let previewSource = "published_entries";
  let optionEntryRows: Array<Record<string, unknown>> = [];
  let canonicalOptionRows: Array<Record<string, unknown>> = [];
  let optionDetailAllowlist: Record<string, unknown> | null = null;

  if (String(baseMapping?.master_item_id ?? "").trim()) {
    const variantsUrl = new URL("http://local/api/channel-products/variants");
    variantsUrl.searchParams.set("channel_id", channelId);
    variantsUrl.searchParams.set("external_product_no", productNo);
    variantsUrl.searchParams.set("master_item_id", String(baseMapping?.master_item_id ?? "").trim());
    try {
      const variantsRes = await getChannelProductVariants(new Request(variantsUrl.toString(), { method: "GET" }));
      if (variantsRes.ok) {
        const variantsPayload = await variantsRes.json();
        const variantsData = variantsPayload?.data ?? null;
        const adminVariants = Array.isArray(variantsData?.variants) ? variantsData.variants : [];
        canonicalOptionRows = Array.isArray(variantsData?.canonical_option_rows) ? variantsData.canonical_option_rows : [];
        optionDetailAllowlist = variantsData?.option_detail_allowlist && typeof variantsData.option_detail_allowlist === "object"
          ? variantsData.option_detail_allowlist
          : null;
        const canonicalAxis = buildOptionAxisFromCanonicalRows(canonicalOptionRows);
        if (canonicalAxis.axes.length > 0) {
          previewAxis = canonicalAxis;
          breakdown = buildVariantBreakdownFromCanonicalRows({
            variants: adminVariants,
            canonicalRows: canonicalOptionRows,
          });
          previewSource = "canonical_rows";
        }
      }
    } catch {
      // fall back to published entries below
    }
  }

  if (publishVersion && baseMapping?.master_item_id) {
    const optionEntryRes = await sb
      .from("product_price_publish_option_entry_v1")
      .select("option_axis_index, option_name, option_value, published_delta_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", String(baseMapping.master_item_id))
      .eq("external_product_no", productNo)
      .eq("publish_version", publishVersion)
      .order("option_axis_index", { ascending: true })
      .order("option_name", { ascending: true })
      .order("option_value", { ascending: true });
    if (!optionEntryRes.error && (optionEntryRes.data ?? []).length > 0) {
      optionEntryRows = optionEntryRes.data ?? [];
      if (!previewAxis) {
        previewAxis = buildOptionAxisFromPublishedEntries(optionEntryRows);
        breakdown = buildVariantBreakdownFromPublishedEntries(optionEntryRows);
        previewSource = "published_entries";
      }
    }
  }
  if (!basePublished) {
    return withCors(jsonError("published base price missing for product", 422, {
      code: "PUBLISHED_BASE_PRICE_MISSING",
      channel_id: channelId,
      product_no: productNo,
    }));
  }
  if (publishVersion && !previewAxis) {
    return withCors(jsonError("published option entry rows missing for product", 422, {
      code: "PUBLISHED_OPTION_ENTRY_MISSING",
      channel_id: channelId,
      product_no: productNo,
      publish_version: publishVersion,
    }));
  }

  for (const row of activeMapRows) {
    const variantCode = String(row.external_variant_code ?? "").trim();
    if (!variantCode) continue;
    const channelProductId = String(row.channel_product_id ?? "").trim();
    const published = channelProductId ? publishedByChannelProduct.get(channelProductId) ?? null : null;
    if (!published) {
      return withCors(jsonError("published variant price missing", 422, {
        code: "PUBLISHED_VARIANT_PRICE_MISSING",
        channel_id: channelId,
        product_no: productNo,
        channel_product_id: channelProductId,
        publish_version: publishVersion,
      }));
    }
  }

  return withCors(NextResponse.json({
    ok: true,
    channel_id: channelId,
    mall_id: mallId,
    product_no: productNo,
    resolved_product_no: productNo,
    publish_version: publishVersion,
    base_price_krw: basePublished.finalTargetPriceKrw,
    publish_version_sources: publishVersion ? [publishVersion] : [],
    axis: previewAxis,
    by_variant: breakdown.byVariant,
    option_detail_allowlist: optionDetailAllowlist,
    canonical_option_rows: canonicalOptionRows,
    preview_source: previewSource,
    generated_at: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "no-store" },
  }));
}
