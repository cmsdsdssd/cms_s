import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { ensureValidCafe24AccessToken, loadCafe24Account, cafe24GetProductPrice, cafe24ListProductVariants } from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const stripPriceDeltaSuffix = (text: string): string =>
  String(text ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

const fmtDelta = (delta: number): string => {
  const rounded = Math.round(Number(delta ?? 0));
  if (!Number.isFinite(rounded) || rounded === 0) return "0";
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded).toLocaleString("ko-KR")}`;
};

const pickRepresentativeDelta = (deltas: Set<number>): number => {
  const values = Array.from(deltas.values())
    .map((v) => Math.round(Number(v)))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const value of values) freq.set(value, (freq.get(value) ?? 0) + 1);
  const ranked = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const absDiff = Math.abs(a[0]) - Math.abs(b[0]);
    if (absDiff !== 0) return absDiff;
    return a[0] - b[0];
  });
  return ranked[0]?.[0] ?? 0;
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

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return withCors(jsonError("cafe24 account missing", 422));

  let token: string;
  try {
    token = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return withCors(jsonError(e instanceof Error ? e.message : "token refresh failed", 422));
  }

  let basePriceRes = await cafe24GetProductPrice(account, token, productNo);
  if (!basePriceRes.ok && basePriceRes.status === 401) {
    try {
      token = await ensureValidCafe24AccessToken(sb, account);
      basePriceRes = await cafe24GetProductPrice(account, token, productNo);
    } catch {
      // Keep original error result.
    }
  }
  if (!basePriceRes.ok || basePriceRes.currentPriceKrw == null || !Number.isFinite(Number(basePriceRes.currentPriceKrw))) {
    return withCors(jsonError(basePriceRes.error ?? "base product price read failed", 422, {
      status: basePriceRes.status,
    }));
  }
  const basePrice = Math.round(Number(basePriceRes.currentPriceKrw));

  let variantsRes = await cafe24ListProductVariants(account, token, productNo);
  if (!variantsRes.ok && variantsRes.status === 401) {
    try {
      token = await ensureValidCafe24AccessToken(sb, account);
      variantsRes = await cafe24ListProductVariants(account, token, productNo);
    } catch {
      // Keep original error result.
    }
  }
  if (!variantsRes.ok) {
    return withCors(jsonError(variantsRes.error ?? "variant list failed", 422, {
      status: variantsRes.status,
    }));
  }

  const variants = variantsRes.variants;
  if (variants.length === 0) {
    return withCors(NextResponse.json({
      ok: false,
      channel_id: channelId,
      mall_id: mallId,
      product_no: productNo,
      resolved_product_no: variantsRes.resolvedProductNo,
      reason: "NO_VARIANTS",
      data: null,
    }, { headers: { "Cache-Control": "no-store" } }));
  }
  const firstAxisName = String(variants.find((v) => v.options.length > 0)?.options[0]?.name ?? "").trim();
  const secondAxisName = String(variants.find((v) => v.options.length > 1)?.options[1]?.name ?? "").trim();

  const variantAxis = new Map<string, { first: string; second: string; totalDelta: number }>();
  for (const variant of variants) {
    const code = String(variant.variantCode ?? "").trim();
    if (!code) continue;
    const firstRaw = variant.options.find((o) => String(o.name ?? "").trim() === firstAxisName)?.value ?? "";
    const secondRaw = variant.options.find((o) => String(o.name ?? "").trim() === secondAxisName)?.value ?? "";
    const first = stripPriceDeltaSuffix(String(firstRaw));
    const second = stripPriceDeltaSuffix(String(secondRaw));
    const totalDelta = Math.round(Number(variant.additionalAmount ?? 0));
    variantAxis.set(code, { first, second, totalDelta });
  }

  const firstAxisBaseDeltaByValue = new Map<string, number>();
  for (const row of variantAxis.values()) {
    if (!row.first) continue;
    const prev = firstAxisBaseDeltaByValue.get(row.first);
    if (prev == null || row.totalDelta < prev) {
      firstAxisBaseDeltaByValue.set(row.first, row.totalDelta);
    }
  }

  const secondResidualByValue = new Map<string, Set<number>>();
  for (const row of variantAxis.values()) {
    if (!row.first || !row.second) continue;
    const firstDelta = firstAxisBaseDeltaByValue.get(row.first);
    if (firstDelta == null) continue;
    const residual = row.totalDelta - firstDelta;
    const prev = secondResidualByValue.get(row.second) ?? new Set<number>();
    prev.add(residual);
    secondResidualByValue.set(row.second, prev);
  }

  const secondAxisDeltaByValue = new Map<string, number>();
  for (const [value, deltas] of secondResidualByValue.entries()) {
    secondAxisDeltaByValue.set(value, pickRepresentativeDelta(deltas));
  }

  const response = {
    ok: true,
    channel_id: channelId,
    mall_id: mallId,
    product_no: productNo,
    resolved_product_no: variantsRes.resolvedProductNo,
    base_price_krw: basePrice,
    axis: {
      first: {
        name: firstAxisName,
        values: Array.from(firstAxisBaseDeltaByValue.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, delta]) => ({ label, delta_krw: delta, delta_display: fmtDelta(delta) })),
      },
      second: {
        name: secondAxisName,
        values: Array.from(secondAxisDeltaByValue.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, delta]) => ({ label, delta_krw: delta, delta_display: fmtDelta(delta) })),
      },
    },
    by_variant: Array.from(variantAxis.entries())
      .map(([variantCode, row]) => ({
        variant_code: variantCode,
        first_value: row.first,
        second_value: row.second,
        total_delta_krw: row.totalDelta,
      }))
      .sort((a, b) => a.variant_code.localeCompare(b.variant_code)),
    generated_at: new Date().toISOString(),
  };

  return withCors(NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  }));
}
