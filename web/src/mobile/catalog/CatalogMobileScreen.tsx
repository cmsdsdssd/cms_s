"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { NumberText } from "@/components/ui/number-text";
import { Sheet } from "@/components/ui/sheet";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { cn } from "@/lib/utils";
import { buildMaterialFactorMap, getMaterialFactor, type MaterialFactorConfigRow } from "@/lib/material-factors";

type CatalogRow = {
  master_id?: string;
  model_name?: string;
  created_at?: string | null;
  image_url?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  material_price?: number | null;
  weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  labor_total_sell?: number | null;
  labor_base_sell?: number | null;
  labor_center_sell?: number | null;
  labor_sub1_sell?: number | null;
  labor_sub2_sell?: number | null;
  plating_price_sell_default?: number | null;
  deduction_weight_default_g?: number | null;
};

type MasterAbsorbLaborItem = {
  master_id?: string | null;
  absorb_item_id?: string;
  bucket?: "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
  reason?: string | null;
  amount_krw?: number | null;
  is_active?: boolean | null;
  note?: string | null;
  labor_class?: string | null;
  material_qty_per_unit?: number | null;
};

type MarketTicksPayload = {
  data?: {
    gold?: number | null;
    silverOriginal?: number | null;
  };
};

type DecorLineLite = {
  product_master_id: string;
  component_master_id: string;
  component_master_model_name: string | null;
  qty_per_unit: number;
};

const PAGE_SIZE = 20;

const ABSORB_STONE_ROLE_PREFIX = "STONE_ROLE:";
const BOM_DECOR_REASON_PREFIX = "장식:";
const BOM_MATERIAL_NOTE_PREFIX = "BOM_MATERIAL_LINE:";
const BOM_MATERIAL_REASON_PREFIX = "기타-소재:";
const ACCESSORY_ETC_REASON_KEYWORD = "부속공임";
const ABSORB_AUTO_EXCLUDED_REASONS = new Set(["BOM_AUTO_TOTAL", "ACCESSORY_LABOR", "ACCESSORY LABOR"]);

function getMaterialBgColor(materialCode: string) {
  if (materialCode === "925") return "bg-gradient-to-br from-[var(--panel)] to-[var(--panel-hover)]";
  if (materialCode === "14" || materialCode === "18") return "bg-gradient-to-br from-[var(--danger-soft)] to-[var(--panel)]";
  if (materialCode === "24") return "bg-gradient-to-br from-[var(--warning-soft)] to-[var(--panel)]";
  return "bg-[var(--panel)]";
}

function getMaterialChipColorClass(materialCode: string) {
  if (materialCode === "925") return "bg-slate-200 text-slate-800";
  if (materialCode === "14") return "bg-amber-100 text-amber-900";
  if (materialCode === "18") return "bg-yellow-100 text-yellow-900";
  if (materialCode === "24") return "bg-orange-100 text-orange-900";
  return "bg-[var(--chip)] text-[var(--muted)]";
}

function roundUpDisplayHundred(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return Math.round(value);
  return Math.ceil(value / 100) * 100;
}

function computeMaterialPriceFromWeight(args: {
  netWeightG: number;
  tickPriceKrwPerG: number;
  materialCode: string;
  factors: ReturnType<typeof buildMaterialFactorMap>;
}) {
  const netWeight = Number(args.netWeightG ?? 0);
  const tickPrice = Number(args.tickPriceKrwPerG ?? 0);
  if (!Number.isFinite(netWeight) || !Number.isFinite(tickPrice) || netWeight <= 0 || tickPrice <= 0) return 0;
  const effectiveFactor = getMaterialFactor({
    materialCode: args.materialCode,
    factors: args.factors,
  }).effectiveFactor;
  const adjustedWeight = netWeight * effectiveFactor;
  return Math.round(adjustedWeight * tickPrice);
}

function parseAbsorbStoneRole(note: string | null | undefined): "CENTER" | "SUB1" | "SUB2" | null {
  const text = String(note ?? "").trim().toUpperCase();
  if (!text.startsWith(ABSORB_STONE_ROLE_PREFIX)) return null;
  const value = text.slice(ABSORB_STONE_ROLE_PREFIX.length);
  if (value === "CENTER" || value === "SUB1" || value === "SUB2") return value;
  return null;
}

function isMaterialAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  return String(item.bucket ?? "") === "ETC" && String(item.labor_class ?? "").toUpperCase() === "MATERIAL";
}

function normalizeReasonKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

type AbsorbImpactSummary = {
  baseLaborUnit: number;
  stoneCenterUnit: number;
  stoneSub1Unit: number;
  stoneSub2Unit: number;
  platingUnit: number;
  etcUnit: number;
};

function computeAbsorbImpactSummary(
  items: MasterAbsorbLaborItem[],
  centerQty: number,
  sub1Qty: number,
  sub2Qty: number
): AbsorbImpactSummary {
  const summary: AbsorbImpactSummary = {
    baseLaborUnit: 0,
    stoneCenterUnit: 0,
    stoneSub1Unit: 0,
    stoneSub2Unit: 0,
    platingUnit: 0,
    etcUnit: 0,
  };

  const centerQtySafe = Math.max(Number(centerQty || 0), 0);
  const sub1QtySafe = Math.max(Number(sub1Qty || 0), 0);
  const sub2QtySafe = Math.max(Number(sub2Qty || 0), 0);

  items.forEach((item) => {
    if (item.is_active === false) return;
    if (shouldExcludeAbsorbItem(item)) return;
    const baseAmount = Number(item.amount_krw ?? 0);
    if (!Number.isFinite(baseAmount) || baseAmount === 0) return;

    const bucket = String(item.bucket ?? "ETC").trim();
    const role = parseAbsorbStoneRole(item.note);
    if (bucket === "BASE_LABOR") {
      summary.baseLaborUnit += baseAmount;
      return;
    }
    if (bucket === "STONE_LABOR") {
      if (role === "SUB1") summary.stoneSub1Unit += baseAmount;
      else if (role === "SUB2") summary.stoneSub2Unit += baseAmount;
      else summary.stoneCenterUnit += baseAmount;
      return;
    }
    if (bucket === "PLATING") {
      summary.platingUnit += baseAmount;
      return;
    }

    if (bucket === "ETC" && isMaterialAbsorbItem(item)) {
      const qtyPerUnit = Math.max(Number(item.material_qty_per_unit ?? 1), 0);
      summary.etcUnit += baseAmount * qtyPerUnit;
      return;
    }
    summary.etcUnit += baseAmount;
  });

  // Expand stone units to per-product totals by count
  summary.stoneCenterUnit = summary.stoneCenterUnit * Math.max(centerQtySafe, 1);
  summary.stoneSub1Unit = summary.stoneSub1Unit * Math.max(sub1QtySafe, 1);
  summary.stoneSub2Unit = summary.stoneSub2Unit * Math.max(sub2QtySafe, 1);
  return summary;
}

function computeMasterLaborSellWithAbsorb(row: CatalogRow | undefined, absorbItems: MasterAbsorbLaborItem[]) {
  if (!row) return 0;
  const centerQty = Math.max(Number(row.center_qty_default ?? 0), 0);
  const sub1Qty = Math.max(Number(row.sub1_qty_default ?? 0), 0);
  const sub2Qty = Math.max(Number(row.sub2_qty_default ?? 0), 0);

  const baseSell =
    Number(row.labor_base_sell ?? 0) +
    Number(row.labor_center_sell ?? 0) * centerQty +
    Number(row.labor_sub1_sell ?? 0) * sub1Qty +
    Number(row.labor_sub2_sell ?? 0) * sub2Qty +
    Number(row.plating_price_sell_default ?? 0);

  const absorb = computeAbsorbImpactSummary(absorbItems, centerQty, sub1Qty, sub2Qty);
  return baseSell + absorb.baseLaborUnit + absorb.stoneCenterUnit + absorb.stoneSub1Unit + absorb.stoneSub2Unit + absorb.platingUnit + absorb.etcUnit;
}

function toKaratCode(materialCode: string) {
  const raw = String(materialCode).trim().toUpperCase();
  if (raw === "14" || raw === "14K") return "14";
  if (raw === "18" || raw === "18K") return "18";
  if (raw === "24" || raw === "24K") return "24";
  return raw;
}

function getDisplayNetWeightForMaterialPrice(
  materialCode: string,
  grossWeight: number,
  deductionWeight: number,
  convert14To18 = false
) {
  const karat = toKaratCode(materialCode);
  if (karat === "14" && convert14To18) {
    return Math.max(grossWeight * 1.2 - deductionWeight, 0);
  }
  return Math.max(grossWeight - deductionWeight, 0);
}

function shouldExcludeAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  const rawReason = String(item.reason ?? "").trim();
  const rawNote = String(item.note ?? "").trim();
  const normalizedReason = normalizeReasonKey(rawReason);
  if (ABSORB_AUTO_EXCLUDED_REASONS.has(normalizedReason)) return true;
  if (rawReason.toUpperCase().includes("ACCESSORY LABOR")) return true;
  if (rawReason.startsWith(BOM_DECOR_REASON_PREFIX)) return true;
  if (rawReason.startsWith(BOM_MATERIAL_REASON_PREFIX)) return true;
  if (rawNote.startsWith(BOM_MATERIAL_NOTE_PREFIX)) return true;
  if (rawReason.includes(ACCESSORY_ETC_REASON_KEYWORD)) return true;
  return false;
}

function getAbsorbToneClass(bucket: string) {
  if (bucket === "BASE_LABOR") return "bg-lime-50 border-lime-200";
  if (bucket === "STONE_LABOR") return "bg-green-50 border-green-200";
  if (bucket === "PLATING") return "bg-[var(--subtle-bg)] border-[var(--panel-border)]";
  return "bg-blue-50 border-blue-200";
}

export function CatalogMobileScreen() {
  const [keyword, setKeyword] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<CatalogRow | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [includeAccessory, setIncludeAccessory] = useState(false);
  const [sortByCreatedDesc, setSortByCreatedDesc] = useState(true);
  const [force18KViewFor14, setForce18KViewFor14] = useState(false);

  const query = useQuery({
    queryKey: ["cms", "catalog_mobile"],
    queryFn: async () => {
      const response = await fetch("/api/master-items", { cache: "no-store" });
      const json = (await response.json()) as { data?: CatalogRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "카탈로그 조회 실패");
      return json.data ?? [];
    },
  });

  const marketTicksQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_market_ticks"],
    queryFn: async () => {
      const response = await fetch("/api/market-ticks", { cache: "no-store" });
      const json = (await response.json()) as MarketTicksPayload & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "시세 조회 실패");
      return json.data ?? {};
    },
  });

  const materialFactorQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_material_factor_config"],
    queryFn: async () => {
      const response = await fetch("/api/material-factor-config", { cache: "no-store" });
      const json = (await response.json()) as { data?: MaterialFactorConfigRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "소재 팩터 조회 실패");
      return json.data ?? [];
    },
    staleTime: 60_000,
  });

  const materialFactorMap = useMemo(
    () => buildMaterialFactorMap(materialFactorQuery.data ?? null),
    [materialFactorQuery.data]
  );

  const absorbLaborItemsQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_absorb_labor", selected?.master_id ?? ""],
    enabled: Boolean(selected?.master_id),
    queryFn: async () => {
      const targetMasterId = String(selected?.master_id ?? "").trim();
      if (!targetMasterId) return [] as MasterAbsorbLaborItem[];
      const response = await fetch(`/api/master-absorb-labor-items?master_id=${encodeURIComponent(targetMasterId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "공임항목 조회 실패");
      return json.data ?? [];
    },
  });

  const cardAbsorbLaborQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_absorb_labor_cards", (query.data ?? []).map((row) => String(row.master_id ?? "").trim()).filter(Boolean).slice(0, 600).join("|")],
    enabled: (query.data ?? []).length > 0,
    queryFn: async () => {
      const masterIds = Array.from(new Set((query.data ?? []).map((row) => String(row.master_id ?? "").trim()).filter(Boolean))).slice(0, 600);
      if (masterIds.length === 0) return new Map<string, MasterAbsorbLaborItem[]>();
      const response = await fetch(`/api/master-absorb-labor-items?master_ids=${encodeURIComponent(masterIds.join(","))}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: Array<MasterAbsorbLaborItem & { master_id?: string | null }>; error?: string };
      if (!response.ok) throw new Error(json.error ?? "카드 공임항목 조회 실패");

      const map = new Map<string, MasterAbsorbLaborItem[]>();
      (json.data ?? []).forEach((row) => {
        const masterId = String((row as { master_id?: string | null }).master_id ?? "").trim();
        if (!masterId) return;
        const bucket = map.get(masterId) ?? [];
        bucket.push(row);
        map.set(masterId, bucket);
      });
      return map;
    },
    staleTime: 300_000,
  });

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    let base = query.data ?? [];
    if (!includeAccessory) {
      base = base.filter((row) => String(row.category_code ?? "").toUpperCase() !== "ACCESSORY");
    }
    if (k) {
      base = base.filter((row) => String(row.model_name ?? "").toLowerCase().includes(k));
    }
    if (sortByCreatedDesc) {
      return [...base].sort((a, b) => {
        const ta = Date.parse(String(a.created_at ?? ""));
        const tb = Date.parse(String(b.created_at ?? ""));
        const safeA = Number.isFinite(ta) ? ta : 0;
        const safeB = Number.isFinite(tb) ? tb : 0;
        return safeB - safeA;
      });
    }
    return base;
  }, [query.data, keyword, includeAccessory, sortByCreatedDesc]);

  const pageItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const productMasterIdsForDecor = useMemo(() => {
    const ids = new Set<string>();
    pageItems.forEach((row) => {
      const id = String(row.master_id ?? "").trim();
      if (id) ids.add(id);
    });
    const selectedId = String(selected?.master_id ?? "").trim();
    if (selectedId) ids.add(selectedId);
    return Array.from(ids).slice(0, 60);
  }, [pageItems, selected?.master_id]);

  const decorLinesQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_decor_lines", productMasterIdsForDecor.join("|")],
    enabled: productMasterIdsForDecor.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/bom-decor-lines?product_master_ids=${encodeURIComponent(productMasterIdsForDecor.join(","))}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: DecorLineLite[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "장식 라인 조회 실패");
      return json.data ?? [];
    },
    staleTime: 60_000,
  });

  const decorLinesByProductId = useMemo(() => {
    const map = new Map<string, DecorLineLite[]>();
    (decorLinesQuery.data ?? []).forEach((line) => {
      const productId = String(line.product_master_id ?? "").trim();
      if (!productId) return;
      const rows = map.get(productId) ?? [];
      rows.push(line);
      map.set(productId, rows);
    });
    return map;
  }, [decorLinesQuery.data]);

  const decorComponentMasterIds = useMemo(() => {
    const ids = new Set<string>();
    (decorLinesQuery.data ?? []).forEach((line) => {
      const id = String(line.component_master_id ?? "").trim();
      if (id) ids.add(id);
    });
    return Array.from(ids).slice(0, 300);
  }, [decorLinesQuery.data]);

  const decorComponentRowsQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_decor_components", decorComponentMasterIds.join("|")],
    enabled: decorComponentMasterIds.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/master-items?master_ids=${encodeURIComponent(decorComponentMasterIds.join(","))}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: CatalogRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "장식 마스터 조회 실패");
      return json.data ?? [];
    },
    staleTime: 300_000,
  });

  const masterRowsById = useMemo(() => {
    const map = new Map<string, CatalogRow>();
    (query.data ?? []).forEach((row) => {
      const id = String(row.master_id ?? "").trim();
      if (id) map.set(id, row);
    });
    (decorComponentRowsQuery.data ?? []).forEach((row) => {
      const id = String(row.master_id ?? "").trim();
      if (id) map.set(id, row);
    });
    return map;
  }, [query.data, decorComponentRowsQuery.data]);

  const detailSummary = useMemo(() => {
    if (!selected) {
      return {
        totalSell: 0,
        laborTotalSell: 0,
        netWeight: 0,
        materialPrice: 0,
        marketPrice: 0,
      };
    }

    const materialCode = String(selected.material_code_default ?? "").trim();
    const karatCode = toKaratCode(materialCode);
    const canPromote14To18 = karatCode === "14";
    const show18KView = canPromote14To18 && force18KViewFor14;
    const materialCodeForPricing = show18KView ? "18" : materialCode;
    const materialLabel = canPromote14To18
      ? (show18KView ? "18K" : "14K")
      : karatCode === "18"
        ? "18K"
        : karatCode === "24"
          ? "24K"
          : karatCode === "925"
            ? "925"
            : karatCode === "999"
              ? "999"
              : "00";
    const normalizedCodeForPricing = toKaratCode(materialCodeForPricing);
    const isSilver = normalizedCodeForPricing === "925" || normalizedCodeForPricing === "999";
    const silverTickOriginal = Number(marketTicksQuery.data?.silverOriginal ?? 0);
    const marketPrice = Math.ceil(Number(isSilver ? silverTickOriginal : marketTicksQuery.data?.gold) || 0);
    const grossWeight = Number(selected.weight_default_g ?? 0);
    const deductionWeight = Number(selected.deduction_weight_default_g ?? 0);
    const netWeight = Math.max(0, grossWeight - deductionWeight);
    const materialWeight = getDisplayNetWeightForMaterialPrice(
      materialCode,
      grossWeight,
      deductionWeight,
      show18KView
    );
    const computedMaterialPrice = computeMaterialPriceFromWeight({
      netWeightG: materialWeight,
      tickPriceKrwPerG: marketPrice,
      materialCode: materialCodeForPricing,
      factors: materialFactorMap,
    });
    const materialPrice = normalizedCodeForPricing === "00" ? 0 : computedMaterialPrice;

    const baseLaborSell = computeMasterLaborSellWithAbsorb(selected, absorbLaborItemsQuery.data ?? []);
    const decorLines = decorLinesByProductId.get(String(selected.master_id ?? "").trim()) ?? [];
    const decorLaborSell = decorLines.reduce((sum, line) => {
      const componentId = String(line.component_master_id ?? "").trim();
      if (!componentId) return sum;
      const qty = Math.max(Number(line.qty_per_unit ?? 0), 0);
      if (!Number.isFinite(qty) || qty <= 0) return sum;
      const componentRow = masterRowsById.get(componentId);
      if (!componentRow) return sum;
      const componentAbsorb = cardAbsorbLaborQuery.data?.get(componentId) ?? [];
      return sum + computeMasterLaborSellWithAbsorb(componentRow, componentAbsorb) * qty;
    }, 0);

    const laborTotalSell = baseLaborSell + decorLaborSell;
    const materialPriceDisplay = roundUpDisplayHundred(materialPrice);
    const laborTotalSellDisplay = roundUpDisplayHundred(laborTotalSell);
    const totalSellDisplay = roundUpDisplayHundred(materialPrice + laborTotalSell);

    return {
      totalSell: totalSellDisplay,
      laborTotalSell: laborTotalSellDisplay,
      netWeight: materialWeight,
      baseNetWeight: netWeight,
      materialPrice: materialPriceDisplay,
      marketPrice,
      canPromote14To18,
      is18KView: show18KView,
      materialLabel,
    };
  }, [selected, marketTicksQuery.data, absorbLaborItemsQuery.data, decorLinesByProductId, masterRowsById, cardAbsorbLaborQuery.data, materialFactorMap, force18KViewFor14]);

  const detailLaborGroups = useMemo(() => {
    type Row = { key: string; label: string; amount: number; bucket: string };
    if (!selected) return [] as Array<{ title: string; tone: string; rows: Row[] }>;

    const centerQty = Math.max(Number(selected.center_qty_default ?? 0), 0);
    const sub1Qty = Math.max(Number(selected.sub1_qty_default ?? 0), 0);
    const sub2Qty = Math.max(Number(selected.sub2_qty_default ?? 0), 0);

    const baseRows: Row[] = [];
    const stoneRows: Row[] = [];
    const platingRows: Row[] = [];
    const materialRows: Row[] = [];

    const baseLabor = Number(selected.labor_base_sell ?? 0);
    if (baseLabor !== 0) baseRows.push({ key: "base", label: "기본공임", amount: baseLabor, bucket: "BASE_LABOR" });

    const centerLabor = Number(selected.labor_center_sell ?? 0) * centerQty;
    if (centerLabor !== 0) stoneRows.push({ key: "stone-center", label: "알공임(중심)", amount: centerLabor, bucket: "STONE_LABOR" });
    const sub1Labor = Number(selected.labor_sub1_sell ?? 0) * sub1Qty;
    if (sub1Labor !== 0) stoneRows.push({ key: "stone-sub1", label: "알공임(보조1)", amount: sub1Labor, bucket: "STONE_LABOR" });
    const sub2Labor = Number(selected.labor_sub2_sell ?? 0) * sub2Qty;
    if (sub2Labor !== 0) stoneRows.push({ key: "stone-sub2", label: "알공임(보조2)", amount: sub2Labor, bucket: "STONE_LABOR" });

    const platingLabor = Number(selected.plating_price_sell_default ?? 0);
    if (platingLabor !== 0) platingRows.push({ key: "plating", label: "도금공임", amount: platingLabor, bucket: "PLATING" });

    const decorLines = decorLinesByProductId.get(String(selected.master_id ?? "").trim()) ?? [];
    decorLines.forEach((line, index) => {
      const componentId = String(line.component_master_id ?? "").trim();
      if (!componentId) return;
      const qty = Math.max(Number(line.qty_per_unit ?? 0), 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      const componentRow = masterRowsById.get(componentId);
      if (!componentRow) return;
      const componentAbsorb = cardAbsorbLaborQuery.data?.get(componentId) ?? [];
      const amount = computeMasterLaborSellWithAbsorb(componentRow, componentAbsorb) * qty;
      if (!Number.isFinite(amount) || amount === 0) return;
      const name = String(line.component_master_model_name ?? componentRow.model_name ?? `장식${index + 1}`);
      materialRows.push({ key: `decor-${componentId}-${index}`, label: `${name} x ${qty}`, amount, bucket: "ETC" });
    });

    (absorbLaborItemsQuery.data ?? [])
      .filter((item) => item.is_active !== false)
      .filter((item) => !shouldExcludeAbsorbItem(item))
      .forEach((item, index) => {
        const bucket = String(item.bucket ?? "ETC").trim();
        const reason = String(item.reason ?? "").trim();
        const role = parseAbsorbStoneRole(item.note);
        const rawAmount = Number(item.amount_krw ?? 0);
        if (!Number.isFinite(rawAmount) || rawAmount === 0) return;

        let amount = rawAmount;
        let label = reason || "흡수공임";

        if (bucket === "STONE_LABOR") {
          if (role === "SUB1") {
            amount = rawAmount * Math.max(sub1Qty, 1);
            label = reason || "알공임 흡수(보조1)";
          } else if (role === "SUB2") {
            amount = rawAmount * Math.max(sub2Qty, 1);
            label = reason || "알공임 흡수(보조2)";
          } else {
            amount = rawAmount * Math.max(centerQty, 1);
            label = reason || "알공임 흡수(중심)";
          }
        }

        if (bucket === "ETC" && isMaterialAbsorbItem(item)) {
          const qtyPerUnit = Math.max(Number(item.material_qty_per_unit ?? 1), 0);
          amount = rawAmount * qtyPerUnit;
          label = reason || "소재공임 흡수";
        }

        const row: Row = {
          key: String(item.absorb_item_id ?? `${bucket}-${index}`),
          label,
          amount,
          bucket,
        };

        if (bucket === "BASE_LABOR") baseRows.push(row);
        else if (bucket === "STONE_LABOR") stoneRows.push(row);
        else if (bucket === "PLATING") platingRows.push(row);
        else materialRows.push(row);
      });

    return [
      { title: "기본공임", tone: getAbsorbToneClass("BASE_LABOR"), rows: baseRows },
      { title: "알공임", tone: getAbsorbToneClass("STONE_LABOR"), rows: stoneRows },
      { title: "도금공임", tone: getAbsorbToneClass("PLATING"), rows: platingRows },
      { title: "소재공임", tone: getAbsorbToneClass("ETC"), rows: materialRows },
    ].filter((group) => group.rows.some((row) => row.amount !== 0));
  }, [selected, absorbLaborItemsQuery.data, decorLinesByProductId, masterRowsById, cardAbsorbLaborQuery.data]);

  return (
    <MobilePage title="카탈로그" subtitle="웹 갤러리 스타일 · 2열 고정">
      <div className="sticky top-[calc(88px+env(safe-area-inset-top,0px))] z-20 -mx-1 space-y-2 bg-[var(--background)]/95 px-1 pb-2 backdrop-blur">
        <div className="text-[10px] text-[var(--muted)]">
          한국 금시세 <span className="font-semibold text-[var(--foreground)]"><NumberText value={Math.ceil(Number(marketTicksQuery.data?.gold ?? 0))} />원/g</span>
          <span className="mx-2">|</span>
          한국 은시세 <span className="font-semibold text-[var(--foreground)]"><NumberText value={Math.ceil(Number(marketTicksQuery.data?.silverOriginal ?? 0))} />원/g</span>
        </div>

        <Input
          placeholder="모델명 검색"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setIncludeAccessory((prev) => !prev);
              setVisibleCount(PAGE_SIZE);
            }}
            className={cn(
              "rounded-[10px] border px-3 py-2 text-left text-xs font-semibold",
              includeAccessory
                ? "border-[var(--primary)] bg-[var(--active-bg)] text-[var(--primary)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--muted)]"
            )}
          >
            장식 포함 {includeAccessory ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setSortByCreatedDesc((prev) => !prev)}
            className={cn(
              "rounded-[10px] border px-3 py-2 text-left text-xs font-semibold",
              sortByCreatedDesc
                ? "border-[var(--primary)] bg-[var(--active-bg)] text-[var(--primary)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--muted)]"
            )}
          >
            생성일 내림차순 {sortByCreatedDesc ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {pageItems.map((item, index) => (
          (() => {
            const materialCode = String(item.material_code_default ?? "").trim() || "00";
            const materialLabel = materialCode || "-";
            const grossWeight = Number(item.weight_default_g ?? 0);
            const deductionWeight = Number(item.deduction_weight_default_g ?? 0);
            const netWeight = Math.max(0, grossWeight - deductionWeight);
            const materialWeight = getDisplayNetWeightForMaterialPrice(materialCode, grossWeight, deductionWeight);
            const normalizedMaterialCode = toKaratCode(materialCode);
            const isSilver = normalizedMaterialCode === "925" || normalizedMaterialCode === "999";
            const silverTickOriginal = Number(marketTicksQuery.data?.silverOriginal ?? 0);
            const marketPrice = Math.ceil(Number(isSilver ? silverTickOriginal : marketTicksQuery.data?.gold) || 0);
            const materialPriceComputed = computeMaterialPriceFromWeight({
              netWeightG: materialWeight,
              tickPriceKrwPerG: marketPrice,
              materialCode,
              factors: materialFactorMap,
            });
            const materialPrice = materialCode === "00" ? 0 : materialPriceComputed;
            const cardAbsorbItems = cardAbsorbLaborQuery.data?.get(String(item.master_id ?? "").trim()) ?? [];
            const baseLaborSell = computeMasterLaborSellWithAbsorb(item, cardAbsorbItems);
            const decorLines = decorLinesByProductId.get(String(item.master_id ?? "").trim()) ?? [];
            const decorLaborSell = decorLines.reduce((sum, line) => {
              const componentId = String(line.component_master_id ?? "").trim();
              if (!componentId) return sum;
              const qty = Math.max(Number(line.qty_per_unit ?? 0), 0);
              if (!Number.isFinite(qty) || qty <= 0) return sum;
              const componentRow = masterRowsById.get(componentId);
              if (!componentRow) return sum;
              const componentAbsorb = cardAbsorbLaborQuery.data?.get(componentId) ?? [];
              return sum + computeMasterLaborSellWithAbsorb(componentRow, componentAbsorb) * qty;
            }, 0);

            const laborSell = baseLaborSell + decorLaborSell;
            const laborSellDisplay = roundUpDisplayHundred(laborSell);
            const totalSell = roundUpDisplayHundred(materialPrice + laborSell);

            return (
              <div
                key={String(item.master_id ?? item.model_name ?? `row-${index}`)}
                className={cn(
                  "group relative overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel)] text-left transition-all hover:ring-2 hover:ring-[var(--primary)]",
                  getMaterialBgColor(materialCode)
                )}
              >
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(item.image_url ?? null)}
                  className="relative block aspect-square w-full bg-[var(--white)] dark:bg-[var(--black)]"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.model_name ?? "catalog-item"}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--subtle-bg)] text-[var(--muted)]">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                  <span className={cn("absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm", getMaterialChipColorClass(materialCode))}>
                    {materialLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForce18KViewFor14(false);
                    setSelected(item);
                  }}
                  className="block w-full border-t border-[var(--panel-border)] bg-[var(--panel)] p-2.5 text-left"
                >
                  <div className="truncate text-[13px] font-medium text-[var(--foreground)]">{item.model_name ?? "-"}</div>

                  <div className="mt-1 space-y-1 text-[11px] text-[var(--foreground)]" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
                    <div className="rounded border border-green-400 bg-[var(--primary-soft)] px-2 py-1.5">
                      <div className="text-[10px] text-[var(--muted)]">총가격(판매)</div>
                      <div className="text-right text-sm font-extrabold tabular-nums">
                        <NumberText value={totalSell} /> 원
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-1">
                        <div className="text-[10px] font-semibold text-[var(--muted)]">총공임(판매)</div>
                        <div className="text-right font-bold tabular-nums">
                          <NumberText value={laborSellDisplay} /> 원
                        </div>
                      </div>
                      <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-1">
                        <div className="text-[10px] font-semibold text-[var(--muted)]">총중량</div>
                        <div className="text-right font-bold tabular-nums">
                          <NumberText value={netWeight} /> g
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })()
        ))}
      </div>

      {visibleCount < filtered.length ? (
        <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
          더보기 ({filtered.length - visibleCount})
        </Button>
      ) : null}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title="상품 상세">
        <div className="flex h-full flex-col p-4">
          {selected ? (
            <>
              <div className="aspect-square w-full overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--subtle-bg)]">
                {selected.image_url ? (
                  <button type="button" className="block h-full w-full" onClick={() => setPreviewImageUrl(selected.image_url ?? null)}>
                    <img src={selected.image_url} alt={selected.model_name ?? "catalog-item"} className="h-full w-full object-contain" />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-xs text-[var(--muted)]">총가격(판매)</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-[var(--foreground)]">
                    <NumberText value={detailSummary.totalSell} />원
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">총공임(판매)</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.laborTotalSell} />원
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                      <span>총중량</span>
                      {detailSummary.canPromote14To18 ? (
                        <button
                          type="button"
                          onClick={() => setForce18KViewFor14((prev) => !prev)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            detailSummary.is18KView
                              ? "border border-amber-600 bg-amber-200 text-amber-950"
                              : "border border-amber-400 bg-amber-100 text-amber-900"
                          )}
                          title="클릭하여 14K/18K 보기 전환"
                        >
                          {detailSummary.materialLabel}
                        </button>
                      ) : (
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", getMaterialChipColorClass(String(selected.material_code_default ?? "00")))}>
                          {detailSummary.materialLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.netWeight} />g
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">소재가격</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.materialPrice} />원
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">시세</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        <NumberText value={detailSummary.marketPrice} />원/g
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                  <div className="mb-2 text-xs font-semibold text-[var(--muted)]">공임항목</div>
                  <div className="space-y-2">
                    {detailLaborGroups.length === 0 ? (
                      <div className="text-xs text-[var(--muted)]">표시할 공임항목이 없습니다.</div>
                    ) : (
                      detailLaborGroups.map((group) => (
                        <div key={group.title} className={cn("rounded-md border px-2 py-2", group.tone)}>
                          <div className="mb-1 text-[11px] font-semibold text-[var(--foreground)]">
                            {group.title}
                            <span className="ml-1 tabular-nums text-[var(--muted)]">
                              (합계 <NumberText value={roundUpDisplayHundred(group.rows.reduce((sum, row) => sum + row.amount, 0))} />원)
                            </span>
                          </div>
                          <div className="space-y-1">
                            {group.rows.map((row) => (
                              <div key={row.key} className="flex items-center justify-between rounded-md bg-white/60 px-2 py-1.5 text-xs">
                                <span className="text-[var(--foreground)]">{row.label}</span>
                                <span className="tabular-nums font-semibold text-[var(--foreground)]">
                                  <NumberText value={roundUpDisplayHundred(row.amount)} />원
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>닫기</Button>
                <Link href="/catalog">
                  <Button className="w-full">상세 편집 이동</Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </Sheet>

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[70] bg-black/90" onClick={() => setPreviewImageUrl(null)}>
          <div className="flex h-full w-full items-center justify-center p-4">
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <img
                src={previewImageUrl}
                alt="확대 이미지"
                className="max-h-[92vh] max-w-[96vw] object-contain"
              />
              <a
                href={previewImageUrl}
                download
                className="absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow-lg"
                aria-label="이미지 다운로드"
                title="다운로드"
              >
                <Download className="h-5 w-5" />
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-5 right-5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white"
          >
            닫기
          </button>
        </div>
      ) : null}
    </MobilePage>
  );
}
