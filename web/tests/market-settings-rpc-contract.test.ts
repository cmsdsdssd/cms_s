import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const marketPageSource = readFileSync(resolve(testDir, "../src/app/(app)/market/page.tsx"), "utf8");
const mobileSettingsSource = readFileSync(resolve(testDir, "../src/mobile/settings/SettingsAdvancedMobileScreen.tsx"), "utf8");

test("desktop market config save uses marketTickConfigUpsert RPC contract", () => {
  assert.equal(marketPageSource.includes("const upsertMarketConfigMutation = useRpcMutation<{ ok?: boolean }>({"), true);
  assert.equal(marketPageSource.includes("fn: CONTRACTS.functions.marketTickConfigUpsert"), true);
  assert.equal(marketPageSource.includes("upsertMarketConfigMutation.mutateAsync({"), true);
  assert.equal(marketPageSource.includes("p_fx_markup: fx"), true);
  assert.equal(marketPageSource.includes("p_cs_correction_factor: corr"), true);
  assert.equal(marketPageSource.includes('.eq("config_key", "DEFAULT")'), true);
  assert.equal(marketPageSource.includes("const [csFxMarkupDirty, setCsFxMarkupDirty] = useState(false);"), true);
  assert.equal(marketPageSource.includes("const [csCorrectionFactorDirty, setCsCorrectionFactorDirty] = useState(false);"), true);
  assert.equal(marketPageSource.includes("if (csConfigData.fx_markup != null && !csFxMarkupDirty) setCsFxMarkup(String(csConfigData.fx_markup));"), true);
  assert.equal(marketPageSource.includes("if (csConfigData.cs_correction_factor != null && !csCorrectionFactorDirty) setCsCorrectionFactor(String(csConfigData.cs_correction_factor));"), true);
  assert.equal(marketPageSource.includes('client.from("cms_market_tick_config")'), false);
  assert.equal(marketPageSource.includes(".upsert({"), false);
});

test("mobile market config read and save stay on the same config contract", () => {
  assert.equal(mobileSettingsSource.includes("const upsertMarketMutation = useRpcMutation<{ ok?: boolean }>({"), true);
  assert.equal(mobileSettingsSource.includes("fn: CONTRACTS.functions.marketTickConfigUpsert"), true);
  assert.equal(mobileSettingsSource.includes('.eq("config_key", "DEFAULT")'), true);
  assert.equal(mobileSettingsSource.includes('const [roundUnit, setRoundUnit] = useState("");'), true);
  assert.equal(mobileSettingsSource.includes("const [roundUnitDirty, setRoundUnitDirty] = useState(false);"), true);
  assert.equal(mobileSettingsSource.includes("round: roundUnitDirty ? roundUnit : String(currentConfig?.rule_rounding_unit_krw ?? 0),"), true);
  assert.equal(mobileSettingsSource.includes("onChange={(event) => { setRoundUnitDirty(true); setRoundUnit(event.target.value); }}"), true);
  assert.equal(mobileSettingsSource.includes("const parsedFxMarkup = Number(marketValues.fx);"), true);
  assert.equal(mobileSettingsSource.includes("const parsedCsFactor = Number(marketValues.cs);"), true);
  assert.equal(mobileSettingsSource.includes("const parsedSilverFactor = Number(marketValues.silver);"), true);
  assert.equal(mobileSettingsSource.includes("if (!Number.isFinite(parsedFxMarkup) || parsedFxMarkup <= 0) {"), true);
  assert.equal(mobileSettingsSource.includes("if (!Number.isFinite(parsedRoundUnit) || parsedRoundUnit < 0) {"), true);
  assert.equal(mobileSettingsSource.includes("p_rounding_unit_krw: parsedRoundUnit"), true);
  assert.equal(mobileSettingsSource.includes("p_fx_markup: parsedFxMarkup"), true);
  assert.equal(mobileSettingsSource.includes("p_cs_correction_factor: parsedCsFactor"), true);
  assert.equal(mobileSettingsSource.includes("p_silver_kr_correction_factor: parsedSilverFactor"), true);
  assert.equal(mobileSettingsSource.includes("Number(marketValues.round) || 0"), false);
});
