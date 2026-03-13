import { isMissingSchemaObjectError } from "./admin.ts";

const DEFAULT_MARKET_TICK_CONFIG = Object.freeze({
  fx_markup: 1.03,
  cs_correction_factor: 1.2,
  silver_kr_correction_factor: 1.2,
});

const toTrimmed = (value) => String(value ?? "").trim();
const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const readMetaNumber = (meta, key) => {
  if (!meta || typeof meta !== "object") return null;
  return toPositiveNumber(meta[key]);
};

export const buildEffectiveMarketTicksFromSources = ({
  configRow,
  latestGoldSilverRow,
  roleRows,
  latestBySymbolRows,
}) => {
  const fxMarkup = Number(configRow?.fx_markup ?? DEFAULT_MARKET_TICK_CONFIG.fx_markup);
  const csCorrectionFactor = Number(configRow?.cs_correction_factor ?? DEFAULT_MARKET_TICK_CONFIG.cs_correction_factor);
  const silverKrCorrectionFactor = Number(
    configRow?.silver_kr_correction_factor ?? DEFAULT_MARKET_TICK_CONFIG.silver_kr_correction_factor,
  );

  const latestBySymbolMap = new Map(
    (Array.isArray(latestBySymbolRows) ? latestBySymbolRows : [])
      .map((row) => [toTrimmed(row?.symbol).toUpperCase(), row])
      .filter(([symbol]) => symbol.length > 0),
  );
  const activeRoleRows = (Array.isArray(roleRows) ? roleRows : []).filter((row) => row?.is_active !== false);
  const goldRoleSymbol = toTrimmed(
    activeRoleRows.find((row) => toTrimmed(row?.role_code).toUpperCase() === "GOLD")?.symbol,
  ).toUpperCase();
  const silverRoleSymbol = toTrimmed(
    activeRoleRows.find((row) => toTrimmed(row?.role_code).toUpperCase() === "SILVER")?.symbol,
  ).toUpperCase();

  const cmsGoldTick = toPositiveNumber(latestGoldSilverRow?.gold_price_krw_per_g);
  const cmsSilverTick = toPositiveNumber(latestGoldSilverRow?.silver_price_krw_per_g);
  const krxGoldTick = toPositiveNumber(latestBySymbolMap.get("KRX_GOLD_TICK")?.price_krw_per_g);
  const goldRoleTick = goldRoleSymbol ? toPositiveNumber(latestBySymbolMap.get(goldRoleSymbol)?.price_krw_per_g) : null;

  const silverRoleRow = silverRoleSymbol ? latestBySymbolMap.get(silverRoleSymbol) ?? null : null;
  const silverRoleTick = toPositiveNumber(silverRoleRow?.price_krw_per_g);
  const silverFactorInMeta = readMetaNumber(silverRoleRow?.meta ?? null, "silver_kr_correction_factor")
    ?? readMetaNumber(silverRoleRow?.meta ?? null, "krx_correction_factor");
  const silverBaseTick = silverRoleTick
    ? (silverFactorInMeta ? silverRoleTick / silverFactorInMeta : silverRoleTick)
    : cmsSilverTick;

  return {
    fxMarkup,
    csCorrectionFactor,
    silverKrCorrectionFactor,
    goldTickKrwPerG: krxGoldTick ?? goldRoleTick ?? cmsGoldTick ?? 0,
    silverTickKrwPerG: silverBaseTick ? silverBaseTick * silverKrCorrectionFactor : 0,
    silverBaseTickKrwPerG: silverBaseTick ?? 0,
    tickSource: {
      gold: krxGoldTick ? "KRX_GOLD_TICK" : (goldRoleSymbol || "cms_v_market_tick_latest_gold_silver_ops_v1"),
      silver: silverRoleSymbol || "cms_v_market_tick_latest_gold_silver_ops_v1",
    },
  };
};

export const loadEffectiveMarketTicks = async (sb) => {
  const [configRes, latestGoldSilverRes, roleRes] = await Promise.all([
    sb
      .from("cms_market_tick_config")
      .select("fx_markup, cs_correction_factor, silver_kr_correction_factor")
      .eq("config_key", "DEFAULT")
      .maybeSingle(),
    sb
      .from("cms_v_market_tick_latest_gold_silver_ops_v1")
      .select("gold_price_krw_per_g, silver_price_krw_per_g")
      .maybeSingle(),
    sb
      .from("cms_v_market_symbol_role_v1")
      .select("role_code, symbol, is_active")
      .in("role_code", ["GOLD", "SILVER"]),
  ]);

  if (configRes.error) throw new Error(configRes.error.message ?? "시장 설정 조회 실패");
  if (latestGoldSilverRes.error) throw new Error(latestGoldSilverRes.error.message ?? "시세 조회 실패");
  if (roleRes.error && !isMissingSchemaObjectError(roleRes.error)) {
    throw new Error(roleRes.error.message ?? "시장 심볼 역할 조회 실패");
  }

  const roleRows = roleRes.error ? [] : (roleRes.data ?? []);
  const symbols = Array.from(new Set([
    "KRX_GOLD_TICK",
    ...roleRows.map((row) => toTrimmed(row?.symbol).toUpperCase()).filter(Boolean),
  ]));

  const latestBySymbolRes = symbols.length > 0
    ? await sb
      .from("cms_v_market_tick_latest_by_symbol_ops_v1")
      .select("symbol, price_krw_per_g, meta")
      .in("symbol", symbols)
    : { data: [], error: null };

  if (latestBySymbolRes.error && !isMissingSchemaObjectError(latestBySymbolRes.error)) {
    throw new Error(latestBySymbolRes.error.message ?? "심볼별 시세 조회 실패");
  }

  return buildEffectiveMarketTicksFromSources({
    configRow: configRes.data ?? DEFAULT_MARKET_TICK_CONFIG,
    latestGoldSilverRow: latestGoldSilverRes.data ?? null,
    roleRows,
    latestBySymbolRows: latestBySymbolRes.error ? [] : (latestBySymbolRes.data ?? []),
  });
};
