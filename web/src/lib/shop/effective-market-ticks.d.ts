export type EffectiveMarketTicks = {
  fxMarkup: number;
  csCorrectionFactor: number;
  silverKrCorrectionFactor: number;
  goldTickKrwPerG: number;
  silverTickKrwPerG: number;
  silverBaseTickKrwPerG: number;
  tickSource: {
    gold: string;
    silver: string;
  };
};

export declare function buildEffectiveMarketTicksFromSources(args: {
  configRow?: {
    fx_markup?: number | null;
    cs_correction_factor?: number | null;
    silver_kr_correction_factor?: number | null;
  } | null;
  latestGoldSilverRow?: {
    gold_price_krw_per_g?: number | null;
    silver_price_krw_per_g?: number | null;
  } | null;
  roleRows?: Array<{ role_code?: string | null; symbol?: string | null; is_active?: boolean | null }> | null;
  latestBySymbolRows?: Array<{ symbol?: string | null; price_krw_per_g?: number | null; meta?: Record<string, unknown> | null }> | null;
}): EffectiveMarketTicks;

export declare function loadEffectiveMarketTicks(sb: {
  from(table: string): {
    select(columns: string): any;
  };
}): Promise<EffectiveMarketTicks>;
