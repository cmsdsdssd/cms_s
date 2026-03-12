import { isMissingSchemaObjectError } from "@/lib/shop/admin";

type AdminClient = NonNullable<ReturnType<typeof import("@/lib/shop/admin").getShopAdminClient>>;

type BasePublishRow = {
  channel_product_id?: string | null;
  channel_id?: string | null;
  master_item_id?: string | null;
  external_product_no?: string | null;
  publish_version?: string | null;
  target_price_raw_krw?: number | null;
  published_base_price_krw?: number | null;
  published_total_price_krw?: number | null;
  computed_at?: string | null;
};

type VariantPublishRow = {
  channel_product_id?: string | null;
  channel_id?: string | null;
  master_item_id?: string | null;
  external_product_no?: string | null;
  external_variant_code?: string | null;
  publish_version?: string | null;
  target_price_raw_krw?: number | null;
  published_base_price_krw?: number | null;
  published_additional_amount_krw?: number | null;
  published_total_price_krw?: number | null;
  computed_at?: string | null;
};

export type PublishedPriceStateRow = {
  channelProductId: string;
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
  externalVariantCode: string;
  publishVersion: string;
  targetPriceRawKrw: number | null;
  publishedBasePriceKrw: number;
  publishedAdditionalAmountKrw: number;
  publishedTotalPriceKrw: number;
  computedAt: string | null;
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

const normalizeInt = (value: unknown): number | null => {
  const n = Number(value ?? Number.NaN);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const normalizeBaseRow = (row: BasePublishRow): PublishedPriceStateRow | null => {
  const channelProductId = String(row.channel_product_id ?? "").trim();
  const channelId = String(row.channel_id ?? "").trim();
  const masterItemId = String(row.master_item_id ?? "").trim();
  const externalProductNo = String(row.external_product_no ?? "").trim();
  const publishVersion = String(row.publish_version ?? "").trim();
  const publishedBasePriceKrw = normalizeInt(row.published_base_price_krw);
  const publishedTotalPriceKrw = normalizeInt(row.published_total_price_krw);
  if (!channelProductId || !channelId || !masterItemId || !externalProductNo || !publishVersion) return null;
  if (publishedBasePriceKrw === null || publishedTotalPriceKrw === null) return null;
  return {
    channelProductId,
    channelId,
    masterItemId,
    externalProductNo,
    externalVariantCode: "",
    publishVersion,
    targetPriceRawKrw: normalizeInt(row.target_price_raw_krw),
    publishedBasePriceKrw,
    publishedAdditionalAmountKrw: 0,
    publishedTotalPriceKrw,
    computedAt: String(row.computed_at ?? "").trim() || null,
  };
};

const normalizeVariantRow = (row: VariantPublishRow): PublishedPriceStateRow | null => {
  const channelProductId = String(row.channel_product_id ?? "").trim();
  const channelId = String(row.channel_id ?? "").trim();
  const masterItemId = String(row.master_item_id ?? "").trim();
  const externalProductNo = String(row.external_product_no ?? "").trim();
  const externalVariantCode = String(row.external_variant_code ?? "").trim();
  const publishVersion = String(row.publish_version ?? "").trim();
  const publishedBasePriceKrw = normalizeInt(row.published_base_price_krw);
  const publishedAdditionalAmountKrw = normalizeInt(row.published_additional_amount_krw);
  const publishedTotalPriceKrw = normalizeInt(row.published_total_price_krw);
  if (!channelProductId || !channelId || !masterItemId || !externalProductNo || !externalVariantCode || !publishVersion) return null;
  if (publishedBasePriceKrw === null || publishedAdditionalAmountKrw === null || publishedTotalPriceKrw === null) return null;
  return {
    channelProductId,
    channelId,
    masterItemId,
    externalProductNo,
    externalVariantCode,
    publishVersion,
    targetPriceRawKrw: normalizeInt(row.target_price_raw_krw),
    publishedBasePriceKrw,
    publishedAdditionalAmountKrw,
    publishedTotalPriceKrw,
    computedAt: String(row.computed_at ?? "").trim() || null,
  };
};

export async function loadPublishedBaseStateByMasterIds(args: {
  sb: AdminClient;
  channelId: string;
  masterItemIds: string[];
  publishVersion: string;
}) {
  const { sb, channelId } = args;
  const publishVersion = String(args.publishVersion ?? "").trim();
  const masterItemIds = Array.from(new Set(args.masterItemIds.map((v) => String(v ?? "").trim()).filter(Boolean)));
  const rowsByMasterAndProduct = new Map<string, PublishedPriceStateRow>();
  if (!publishVersion || masterItemIds.length === 0) return { available: true, rows: [] as PublishedPriceStateRow[] };

  for (const chunk of chunkArray(masterItemIds, 500)) {
    const res = await sb
      .from("product_price_publish_base_v1")
      .select("channel_product_id, channel_id, master_item_id, external_product_no, publish_version, target_price_raw_krw, published_base_price_krw, published_total_price_krw, computed_at")
      .eq("channel_id", channelId)
      .eq("publish_version", publishVersion)
      .in("master_item_id", chunk)
      .order("computed_at", { ascending: false });
    if (res.error && isMissingSchemaObjectError(res.error, "product_price_publish_base_v1")) {
      return { available: false, rows: [] as PublishedPriceStateRow[] };
    }
    if (res.error) throw new Error(res.error.message ?? "published base by master lookup failed");
    for (const raw of res.data ?? []) {
      const row = normalizeBaseRow(raw as BasePublishRow);
      if (!row) continue;
      const key = `${row.masterItemId}::${row.externalProductNo}`;
      if (rowsByMasterAndProduct.has(key)) continue;
      rowsByMasterAndProduct.set(key, row);
    }
  }

  return { available: true, rows: Array.from(rowsByMasterAndProduct.values()) };
}

export async function loadPublishedPriceStateByChannelProducts(args: {
  sb: AdminClient;
  channelId: string;
  channelProductIds: string[];
  publishVersions?: string[];
}) {
  const { sb, channelId } = args;
  const channelProductIds = Array.from(new Set(args.channelProductIds.map((v) => String(v ?? "").trim()).filter(Boolean)));
  const publishVersions = Array.from(new Set((args.publishVersions ?? []).map((v) => String(v ?? "").trim()).filter(Boolean)));
  const rowsByChannelProduct = new Map<string, PublishedPriceStateRow>();
  if (channelProductIds.length === 0) return { available: true, rowsByChannelProduct };

  for (const chunk of chunkArray(channelProductIds, 500)) {
    const baseQuery = sb
      .from("product_price_publish_base_v1")
      .select("channel_product_id, channel_id, master_item_id, external_product_no, publish_version, target_price_raw_krw, published_base_price_krw, published_total_price_krw, computed_at")
      .eq("channel_id", channelId)
      .in("channel_product_id", chunk)
      .order("computed_at", { ascending: false });
    const variantQuery = sb
      .from("product_price_publish_variant_v1")
      .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, publish_version, target_price_raw_krw, published_base_price_krw, published_additional_amount_krw, published_total_price_krw, computed_at")
      .eq("channel_id", channelId)
      .in("channel_product_id", chunk)
      .order("computed_at", { ascending: false });
    if (publishVersions.length > 0) {
      baseQuery.in("publish_version", publishVersions);
      variantQuery.in("publish_version", publishVersions);
    }

    const [baseRes, variantRes] = await Promise.all([baseQuery, variantQuery]);
    if (baseRes.error && isMissingSchemaObjectError(baseRes.error, "product_price_publish_base_v1")) {
      return { available: false, rowsByChannelProduct: new Map<string, PublishedPriceStateRow>() };
    }
    if (variantRes.error && isMissingSchemaObjectError(variantRes.error, "product_price_publish_variant_v1")) {
      return { available: false, rowsByChannelProduct: new Map<string, PublishedPriceStateRow>() };
    }
    if (baseRes.error) throw new Error(baseRes.error.message ?? "published base lookup failed");
    if (variantRes.error) throw new Error(variantRes.error.message ?? "published variant lookup failed");

    for (const raw of baseRes.data ?? []) {
      const row = normalizeBaseRow(raw as BasePublishRow);
      if (!row || rowsByChannelProduct.has(row.channelProductId)) continue;
      rowsByChannelProduct.set(row.channelProductId, row);
    }
    for (const raw of variantRes.data ?? []) {
      const row = normalizeVariantRow(raw as VariantPublishRow);
      if (!row || rowsByChannelProduct.has(row.channelProductId)) continue;
      rowsByChannelProduct.set(row.channelProductId, row);
    }
  }

  return { available: true, rowsByChannelProduct };
}

export async function loadPublishedPriceStateByVersion(args: {
  sb: AdminClient;
  channelId: string;
  publishVersion: string;
}) {
  const { sb, channelId } = args;
  const publishVersion = String(args.publishVersion ?? "").trim();
  const rowsByChannelProduct = new Map<string, PublishedPriceStateRow>();
  if (!publishVersion) return { available: true, rowsByChannelProduct };

  const [baseRes, variantRes] = await Promise.all([
    sb
      .from("product_price_publish_base_v1")
      .select("channel_product_id, channel_id, master_item_id, external_product_no, publish_version, target_price_raw_krw, published_base_price_krw, published_total_price_krw, computed_at")
      .eq("channel_id", channelId)
      .eq("publish_version", publishVersion)
      .order("computed_at", { ascending: false }),
    sb
      .from("product_price_publish_variant_v1")
      .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, publish_version, target_price_raw_krw, published_base_price_krw, published_additional_amount_krw, published_total_price_krw, computed_at")
      .eq("channel_id", channelId)
      .eq("publish_version", publishVersion)
      .order("computed_at", { ascending: false }),
  ]);

  if (baseRes.error && isMissingSchemaObjectError(baseRes.error, "product_price_publish_base_v1")) {
    return { available: false, rowsByChannelProduct: new Map<string, PublishedPriceStateRow>() };
  }
  if (variantRes.error && isMissingSchemaObjectError(variantRes.error, "product_price_publish_variant_v1")) {
    return { available: false, rowsByChannelProduct: new Map<string, PublishedPriceStateRow>() };
  }
  if (baseRes.error) throw new Error(baseRes.error.message ?? "published base by version lookup failed");
  if (variantRes.error) throw new Error(variantRes.error.message ?? "published variant by version lookup failed");

  for (const raw of baseRes.data ?? []) {
    const row = normalizeBaseRow(raw as BasePublishRow);
    if (!row || rowsByChannelProduct.has(row.channelProductId)) continue;
    rowsByChannelProduct.set(row.channelProductId, row);
  }
  for (const raw of variantRes.data ?? []) {
    const row = normalizeVariantRow(raw as VariantPublishRow);
    if (!row || rowsByChannelProduct.has(row.channelProductId)) continue;
    rowsByChannelProduct.set(row.channelProductId, row);
  }

  return { available: true, rowsByChannelProduct };
}
