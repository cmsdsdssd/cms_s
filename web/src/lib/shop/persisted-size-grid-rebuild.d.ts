import { getShopAdminClient } from "./admin";

export type PersistedSizeGridScope = {
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
};

type ShopAdminClient = NonNullable<ReturnType<typeof getShopAdminClient>>;

type SizeRuleRow = {
  channel_id?: string | null;
  master_item_id?: string | null;
  external_product_no?: string | null;
  category_key?: string | null;
  scope_material_code?: string | null;
  is_active?: boolean | null;
};

export function collectAffectedSizeGridScopes(
  rows: Array<SizeRuleRow | null | undefined>,
  materialCodes?: string[] | null,
): PersistedSizeGridScope[];

export function loadSizeGridMarketContext(sb: ShopAdminClient): Promise<{
  goldTickKrwPerG: number;
  silverTickKrwPerG: number;
  materialFactors: Record<string, unknown>;
}>;

export function syncPersistedSizeGridForScope(args: PersistedSizeGridScope & {
  sb: ShopAdminClient;
  marketContext?: {
    goldTickKrwPerG: number;
    silverTickKrwPerG: number;
    materialFactors: Record<string, unknown>;
  };
}): Promise<void>;

export function listAffectedSizeGridScopes(args: {
  sb: ShopAdminClient;
  materialCodes?: string[] | null;
}): Promise<PersistedSizeGridScope[]>;

export function rebuildAffectedSizeGridsForSourceChange(args: {
  sb: ShopAdminClient;
  materialCodes?: string[] | null;
}): Promise<{ scopes: PersistedSizeGridScope[]; rebuiltCount: number }>;
