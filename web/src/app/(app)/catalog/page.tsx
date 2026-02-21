"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { NumberText } from "@/components/ui/number-text";
import { Modal } from "@/components/ui/modal";
import { Grid2x2, List, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-utils";
import { deriveCategoryCodeFromModelName } from "@/lib/model-name";
import { roundUpToUnit } from "@/lib/number";
import {
  buildMaterialFactorMap,
  calcMaterialAmountSellKrw,
  type MaterialFactorConfigRow,
} from "@/lib/material-factors";
import { CatalogGalleryGrid } from "@/components/catalog/CatalogGalleryGrid";
import { ChinaCostPanel, type ChinaExtraLaborItem } from "../../../components/catalog/ChinaCostPanel";
/* eslint-disable @next/next/no-img-element */

type CatalogItem = {
  id: string;
  model: string;
  name: string;
  date: string;
  status: string;
  tone: "neutral" | "active" | "warning";
  weight: string;
  material: string;
  stone: string;
  vendor: string;
  color: string;
  cost: string;
  grades: string[];
  imageUrl?: string | null;
  masterKind: "MODEL" | "PART" | "STONE" | "BUNDLE";
};

type CatalogDetail = {
  masterKind: "MODEL" | "PART" | "STONE" | "BUNDLE";
  categoryCode: string;
  materialCode: string;
  weight: string;
  deductionWeight: string;
  centerQty: number;
  sub1Qty: number;
  sub2Qty: number;
  centerStoneName: string;
  sub1StoneName: string;
  sub2StoneName: string;
  laborBaseSell: number;
  laborCenterSell: number;
  laborSub1Sell: number;
  laborSub2Sell: number;
  laborTotalSell: number;
  laborBaseCost: number;
  laborCenterCost: number;
  laborSub1Cost: number;
  laborSub2Cost: number;
  laborTotalCost: number;
  platingSell: number;
  platingCost: number;
  laborProfileMode: string;
  laborBandCode: string;
  settingAddonMarginKrwPerPiece: number;
  stoneAddonMarginKrwPerPiece: number;
  note: string;
  releaseDate: string;
  modifiedDate: string;
};

type AbsorbLaborBucket = "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
type AbsorbLaborClass = "GENERAL" | "MATERIAL";

type MasterAbsorbLaborItem = {
  absorb_item_id: string;
  master_id: string;
  bucket: AbsorbLaborBucket;
  reason: string;
  amount_krw: number;
  is_per_piece: boolean;
  vendor_party_id: string | null;
  priority: number;
  is_active: boolean;
  note: string | null;
  labor_class?: AbsorbLaborClass | null;
  material_qty_per_unit?: number | null;
  material_cost_krw?: number | null;
};

type AbsorbStoneRole = "CENTER" | "SUB1" | "SUB2";
type BomLineKind = "ACCESSORY" | "DECOR";

const ACCESSORY_BASE_REASON = "ACCESSORY_LABOR";
const BOM_LINE_KIND_PREFIX = "LINE_KIND:";
const BOM_DECOR_NOTE_PREFIX = "BOM_DECOR_LINE:";
const BOM_MATERIAL_NOTE_PREFIX = "BOM_MATERIAL_LINE:";
const BOM_DECOR_REASON_PREFIX = "장식:";
const BOM_MATERIAL_REASON_PREFIX = "기타-소재:";
const CN_BASIC_BASIS_META_LABEL = "__CN_BASIC_BASIS__";

type CnRawLaborBasis = "PER_G" | "PER_PIECE";

type CnRawEntryState = {
  id: string;
  analysisDate: string;
  totalPriceCny: string;
  silverPriceCny: string;
  laborBasis: CnRawLaborBasis;
};

type CnRawEntryComputed = {
  id: string;
  analysisDate: string;
  laborBasis: CnRawLaborBasis;
  totalPriceCny: number;
  silverPriceCny: number;
  silverAmountCny: number;
  laborBaseCny: number;
  laborCny: number;
  totalCostKrw: number;
  silverPriceKrwPerG: number;
  laborKrw: number;
};

type CnRawSnapshotRow = {
  snapshot_id?: string;
  analysis_date?: string | null;
  labor_basis?: string | null;
  total_price_cny?: number | null;
  silver_price_cny_per_g?: number | null;
  labor_cny_snapshot?: number | null;
  total_cost_krw_snapshot?: number | null;
  cny_krw_rate_snapshot?: number | null;
  silver_price_krw_per_g_snapshot?: number | null;
  labor_krw_snapshot?: number | null;
  created_at?: string | null;
};

type CnRawHistoryRow = {
  id: string;
  analysisDate: string;
  laborBasis: CnRawLaborBasis;
  totalPriceCny: number;
  silverPriceCny: number;
  laborCny: number;
  totalCostKrw: number;
  silverPriceKrwPerG: number;
  laborKrw: number;
  createdAt: string;
};

function createEmptyCnRawEntry(overrides?: Partial<CnRawEntryState>): CnRawEntryState {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    analysisDate: overrides?.analysisDate ?? "",
    totalPriceCny: overrides?.totalPriceCny ?? "",
    silverPriceCny: overrides?.silverPriceCny ?? "",
    laborBasis: overrides?.laborBasis ?? "PER_G",
  };
}

function normalizeCnRawLaborBasis(value: unknown): CnRawLaborBasis {
  return String(value ?? "PER_G").trim().toUpperCase() === "PER_PIECE" ? "PER_PIECE" : "PER_G";
}

function sortCnRawEntriesAsc<T extends { analysisDate: string; id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aDate = /^\d{4}-\d{2}-\d{2}$/.test(a.analysisDate) ? a.analysisDate : "9999-12-31";
    const bDate = /^\d{4}-\d{2}-\d{2}$/.test(b.analysisDate) ? b.analysisDate : "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.id.localeCompare(b.id);
  });
}

function normalizeCnRawHistoryRows(rows: CnRawSnapshotRow[]): CnRawHistoryRow[] {
  return rows
    .map((row) => {
      const analysisDate = String(row.analysis_date ?? "").trim();
      const laborBasis = normalizeCnRawLaborBasis(row.labor_basis);
      const totalPriceCny = Math.max(Number(row.total_price_cny ?? 0), 0);
      const silverPriceCny = Math.max(Number(row.silver_price_cny_per_g ?? 0), 0);
      const laborCny = Number(row.labor_cny_snapshot ?? 0);
      const totalCostKrw = Math.max(Number(row.total_cost_krw_snapshot ?? 0), 0);
      const cnyRate = Math.max(Number(row.cny_krw_rate_snapshot ?? 0), 0);
      const silverPriceKrwPerG =
        Math.max(Number(row.silver_price_krw_per_g_snapshot ?? Number.NaN), 0) || silverPriceCny * cnyRate;
      const laborKrw = Number(row.labor_krw_snapshot ?? Number.NaN);
      const resolvedLaborKrw = Number.isFinite(laborKrw) ? laborKrw : laborCny * cnyRate;
      const createdAt = String(row.created_at ?? "").trim();
      return {
        id: String(row.snapshot_id ?? crypto.randomUUID()),
        analysisDate,
        laborBasis,
        totalPriceCny,
        silverPriceCny,
        laborCny,
        totalCostKrw,
        silverPriceKrwPerG,
        laborKrw: resolvedLaborKrw,
        createdAt,
      };
    })
    .sort((a, b) => {
      const aDate = /^\d{4}-\d{2}-\d{2}$/.test(a.analysisDate) ? a.analysisDate : "9999-12-31";
      const bDate = /^\d{4}-\d{2}-\d{2}$/.test(b.analysisDate) ? b.analysisDate : "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      const aCreatedAt = a.createdAt || "9999-12-31T23:59:59.999Z";
      const bCreatedAt = b.createdAt || "9999-12-31T23:59:59.999Z";
      if (aCreatedAt !== bCreatedAt) return aCreatedAt.localeCompare(bCreatedAt);
      return a.id.localeCompare(b.id);
    });
}

function parseBomLineKind(note: string | null | undefined): BomLineKind {
  const text = String(note ?? "").trim().toUpperCase();
  if (text.startsWith(`${BOM_LINE_KIND_PREFIX}DECOR`)) return "DECOR";
  return "ACCESSORY";
}

function buildBomLineKindNote(kind: BomLineKind): string {
  return `${BOM_LINE_KIND_PREFIX}${kind}`;
}

function buildDecorAbsorbNote(bomLineId: string, qtyPerUnit: number): string {
  return `${BOM_DECOR_NOTE_PREFIX}${bomLineId};QTY_PER_UNIT:${qtyPerUnit}`;
}

function buildMaterialAbsorbNote(bomLineId: string, qtyPerUnit: number): string {
  return `${BOM_MATERIAL_NOTE_PREFIX}${bomLineId};QTY_PER_UNIT:${qtyPerUnit}`;
}

function parseManagedAbsorbSourceLineId(note: string | null | undefined, prefix: string): string | null {
  const text = String(note ?? "").trim();
  if (!text.startsWith(prefix)) return null;
  const body = text.slice(prefix.length);
  const [lineId] = body.split(";", 1);
  const normalized = String(lineId ?? "").trim();
  return normalized || null;
}

function isManagedDecorAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  const note = String(item.note ?? "").trim();
  return note.startsWith(BOM_DECOR_NOTE_PREFIX);
}

function isManagedMaterialAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  const note = String(item.note ?? "").trim();
  return note.startsWith(BOM_MATERIAL_NOTE_PREFIX);
}

type MasterSummary = {
  master_id: string;
  model_name: string;
  category_code?: string | null;
  material_code_default?: string | null;
  image_url?: string | null;
};

type PartSummary = {
  part_id: string;
  part_name: string;
  unit_default?: string | null;
  part_kind?: string | null;
  family_name?: string | null;
  spec_text?: string | null;
};

type BomRecipeRow = {
  bom_id: string;
  product_master_id: string;
  product_model_name: string;
  variant_key?: string | null;
  is_active: boolean;
  note?: string | null;
  meta?: Record<string, unknown> | null;
  line_count: number;
};

type BomFlattenLeafRow = {
  depth?: number | null;
  path?: string | null;
  qty_per_product_unit?: number | null;
  component_ref_type?: "MASTER" | "PART" | null;
  component_master_id?: string | null;
  component_master_model_name?: string | null;
  component_part_id?: string | null;
  component_part_name?: string | null;
  unit?: string | null;
};

type BomLineRow = {
  bom_id: string;
  bom_line_id: string;
  line_no: number;
  component_ref_type: "MASTER" | "PART";
  component_master_id?: string | null;
  component_master_model_name?: string | null;
  component_part_id?: string | null;
  component_part_name?: string | null;
  qty_per_unit: number;
  unit: string;
  note?: string | null;
  is_void: boolean;
  void_reason?: string | null;
  created_at: string;
};


// pageSize is dynamic based on view

const categoryOptions = [
  { label: "팔찌", value: "BRACELET" },
  { label: "발찌", value: "ANKLET" },     // ✅ 추가
  { label: "목걸이", value: "NECKLACE" },
  { label: "귀걸이", value: "EARRING" },
  { label: "반지", value: "RING" },
  { label: "피어싱", value: "PIERCING" },
  { label: "펜던트", value: "PENDANT" },
  { label: "시계", value: "WATCH" },
  { label: "키링", value: "KEYRING" },
  { label: "상징", value: "SYMBOL" },
  { label: "부속", value: "ACCESSORY" }, // ✅ 추가
  { label: "기타", value: "ETC" },
];

const materialOptions = [
  { label: "14K", value: "14" },
  { label: "18K", value: "18" },
  { label: "24K", value: "24" },
  { label: "925", value: "925" },
  { label: "999", value: "999" },
  { label: "00", value: "00" },
];

type VendorOption = { label: string; value: string };

const FORCED_LABOR_PROFILE_MODE = "BAND";
const FORCED_LABOR_BAND_CODE = "DEFAULT";

const stoneSourceOptions = [
  { label: "자입", value: "SELF" },
  { label: "공입", value: "FACTORY" },
] as const;

type CatalogStoneSource = "SELF" | "FACTORY";

const absorbBucketOptions: Array<{ label: string; value: AbsorbLaborBucket }> = [
  { label: "기본공임", value: "BASE_LABOR" },
  { label: "알공임", value: "STONE_LABOR" },
  { label: "도금", value: "PLATING" },
  { label: "기타", value: "ETC" },
];

const absorbStoneRoleOptions: Array<{ label: string; value: AbsorbStoneRole }> = [
  { label: "중심", value: "CENTER" },
  { label: "보조1", value: "SUB1" },
  { label: "보조2", value: "SUB2" },
];

const absorbLaborClassOptions: Array<{ label: string; value: AbsorbLaborClass }> = [
  { label: "일반", value: "GENERAL" },
  { label: "소재", value: "MATERIAL" },
];

const ABSORB_STONE_ROLE_PREFIX = "STONE_ROLE:";
const LEGACY_BOM_AUTO_REASON = "BOM_AUTO_TOTAL";
const ACCESSORY_ETC_REASON_KEYWORD = "부속공임";
const ABSORB_AUTO_EXCLUDED_REASONS = new Set([LEGACY_BOM_AUTO_REASON, ACCESSORY_BASE_REASON]);

function shouldExcludeEtcAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  const normalizedReason = String(item.reason ?? "").trim().toUpperCase();
  if (ABSORB_AUTO_EXCLUDED_REASONS.has(normalizedReason)) return true;
  if (item.bucket !== "ETC") return false;
  const rawReason = String(item.reason ?? "").trim();
  const rawNote = String(item.note ?? "").trim();
  if (rawNote.startsWith(BOM_DECOR_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_DECOR_REASON_PREFIX)) return true;
  if (rawNote.startsWith(BOM_MATERIAL_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_MATERIAL_REASON_PREFIX)) return true;
  return rawReason.includes(ACCESSORY_ETC_REASON_KEYWORD);
}

function parseAbsorbStoneRole(note: string | null | undefined): AbsorbStoneRole | null {
  const text = String(note ?? "").trim().toUpperCase();
  if (!text.startsWith(ABSORB_STONE_ROLE_PREFIX)) return null;
  const value = text.slice(ABSORB_STONE_ROLE_PREFIX.length);
  if (value === "CENTER" || value === "SUB1" || value === "SUB2") return value;
  return null;
}

function buildAbsorbNote(bucket: AbsorbLaborBucket, stoneRole: AbsorbStoneRole | null): string | null {
  if (bucket !== "STONE_LABOR") return null;
  const role = stoneRole ?? "CENTER";
  return `${ABSORB_STONE_ROLE_PREFIX}${role}`;
}

function getAbsorbBucketLabel(bucket: AbsorbLaborBucket): string {
  return absorbBucketOptions.find((option) => option.value === bucket)?.label ?? bucket;
}

function getAbsorbBucketDisplayLabel(item: MasterAbsorbLaborItem): string {
  const bucketLabel = getAbsorbBucketLabel(item.bucket);
  if (item.bucket !== "STONE_LABOR") return bucketLabel;
  const roleLabel = getAbsorbStoneRoleLabel(item.note);
  return roleLabel !== "-" ? `${bucketLabel}(${roleLabel})` : bucketLabel;
}

function getAbsorbBucketToneClass(bucket: AbsorbLaborBucket): string {
  if (bucket === "BASE_LABOR") return "bg-lime-50";
  if (bucket === "STONE_LABOR") return "bg-green-50";
  return "bg-[var(--subtle-bg)]";
}

function getAbsorbStoneRoleLabel(note: string | null | undefined): string {
  const role = parseAbsorbStoneRole(note);
  if (!role) return "-";
  return absorbStoneRoleOptions.find((option) => option.value === role)?.label ?? role;
}

function normalizeAbsorbLaborClass(value: unknown): AbsorbLaborClass {
  return String(value ?? "GENERAL").trim().toUpperCase() === "MATERIAL" ? "MATERIAL" : "GENERAL";
}

function isMaterialAbsorbItem(item: MasterAbsorbLaborItem): boolean {
  return item.bucket === "ETC" && normalizeAbsorbLaborClass(item.labor_class) === "MATERIAL";
}

type AbsorbImpactSummary = {
  baseLaborUnit: number;
  stoneCenterUnit: number;
  stoneSub1Unit: number;
  stoneSub2Unit: number;
  platingUnit: number;
  etcUnit: number;
  baseLabor: number;
  stoneCenter: number;
  stoneSub1: number;
  stoneSub2: number;
  plating: number;
  etc: number;
  total: number;
};

function createEmptyAbsorbSummary(): AbsorbImpactSummary {
  return {
    baseLaborUnit: 0,
    stoneCenterUnit: 0,
    stoneSub1Unit: 0,
    stoneSub2Unit: 0,
    platingUnit: 0,
    etcUnit: 0,
    baseLabor: 0,
    stoneCenter: 0,
    stoneSub1: 0,
    stoneSub2: 0,
    plating: 0,
    etc: 0,
    total: 0,
  };
}

function computeAbsorbImpactSummary(
  items: MasterAbsorbLaborItem[],
  centerQty: number,
  sub1Qty: number,
  sub2Qty: number
): AbsorbImpactSummary {
  const centerQtySafe = Math.max(Number(centerQty || 0), 0);
  const sub1QtySafe = Math.max(Number(sub1Qty || 0), 0);
  const sub2QtySafe = Math.max(Number(sub2Qty || 0), 0);

  const summary = createEmptyAbsorbSummary();
  items.forEach((item) => {
    if (!item.is_active) return;
    const baseAmount = Number(item.amount_krw ?? 0);
    if (!Number.isFinite(baseAmount) || baseAmount === 0) return;

    let applied = baseAmount;
    const role = parseAbsorbStoneRole(item.note);
    if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") applied = baseAmount * Math.max(sub1QtySafe, 1);
      else if (role === "SUB2") applied = baseAmount * Math.max(sub2QtySafe, 1);
      else applied = baseAmount * Math.max(centerQtySafe, 1);
    }

    if (item.bucket === "BASE_LABOR") {
      summary.baseLaborUnit += baseAmount;
      summary.baseLabor += applied;
    }
    else if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") {
        summary.stoneSub1Unit += baseAmount;
        summary.stoneSub1 += applied;
      }
      else if (role === "SUB2") {
        summary.stoneSub2Unit += baseAmount;
        summary.stoneSub2 += applied;
      }
      else {
        summary.stoneCenterUnit += baseAmount;
        summary.stoneCenter += applied;
      }
    }
    else if (item.bucket === "PLATING") {
      summary.platingUnit += baseAmount;
      summary.plating += applied;
    }
    else {
      if (isMaterialAbsorbItem(item)) {
        const qtyPerUnit = Math.max(Number(item.material_qty_per_unit ?? 1), 0);
        const materialApplied = applied * qtyPerUnit;
        summary.etcUnit += baseAmount * qtyPerUnit;
        summary.etc += materialApplied;
      } else {
        summary.etcUnit += baseAmount;
        summary.etc += applied;
      }
    }
    summary.total += applied;
  });

  return summary;
}

function computeMasterLaborTotalsWithAbsorb(
  masterRow: Record<string, unknown> | undefined,
  absorbItems: MasterAbsorbLaborItem[]
): { sellPerUnit: number; costPerUnit: number } {
  if (!masterRow) {
    return { sellPerUnit: 0, costPerUnit: 0 };
  }

  const centerQty = Math.max(Number(masterRow.center_qty_default ?? 0), 0);
  const sub1Qty = Math.max(Number(masterRow.sub1_qty_default ?? 0), 0);
  const sub2Qty = Math.max(Number(masterRow.sub2_qty_default ?? 0), 0);

  const baseSell =
    Number(masterRow.labor_base_sell ?? 0) +
    Number(masterRow.labor_center_sell ?? 0) * centerQty +
    Number(masterRow.labor_sub1_sell ?? 0) * sub1Qty +
    Number(masterRow.labor_sub2_sell ?? 0) * sub2Qty +
    Number(masterRow.plating_price_sell_default ?? 0);

  const baseCost =
    Number(masterRow.labor_base_cost ?? 0) +
    Number(masterRow.labor_center_cost ?? 0) * centerQty +
    Number(masterRow.labor_sub1_cost ?? 0) * sub1Qty +
    Number(masterRow.labor_sub2_cost ?? 0) * sub2Qty +
    Number(masterRow.plating_price_cost_default ?? 0);

  const activeAbsorbItems = absorbItems.filter((item) => {
    if (item.is_active === false) return false;
    if (shouldExcludeEtcAbsorbItem(item)) return false;
    return true;
  });

  const absorbSummary = computeAbsorbImpactSummary(activeAbsorbItems, centerQty, sub1Qty, sub2Qty);
  const absorbMaterialCost = activeAbsorbItems.reduce((sum, item) => {
    if (!isMaterialAbsorbItem(item)) return sum;
    const qtyPerUnit = Math.max(Number(item.material_qty_per_unit ?? 1), 0);
    const costPerMaterial = Math.max(Number(item.material_cost_krw ?? 0), 0);
    return sum + costPerMaterial * qtyPerUnit;
  }, 0);

  const absorbSell =
    absorbSummary.baseLaborUnit +
    absorbSummary.stoneCenterUnit * centerQty +
    absorbSummary.stoneSub1Unit * sub1Qty +
    absorbSummary.stoneSub2Unit * sub2Qty +
    absorbSummary.platingUnit +
    absorbSummary.etc;

  return {
    sellPerUnit: baseSell + absorbSell,
    costPerUnit: baseCost + absorbMaterialCost,
  };
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      {children}
    </div>
  );
}

function ReadonlyNumberCell({
  value,
  suffix = "원",
  extraText,
  valueClassName,
  extraTextClassName,
  className,
}: {
  value: number;
  suffix?: string;
  extraText?: string;
  valueClassName?: string;
  extraTextClassName?: string;
  className?: string;
}) {
  const displayValue = roundUpToUnit(value, 100);
  return (
    <div
      className={cn(
        "col-span-3 flex h-10 items-center justify-center rounded-[var(--radius)] border border-[var(--panel-border)] bg-[var(--panel)] px-3 text-center text-sm",
        className
      )}
    >
      <NumberText
        value={displayValue}
        className={cn("tabular-nums text-sm font-semibold text-[var(--foreground)]", valueClassName)}
      />
      {suffix ? <span className="ml-1 text-xs text-[var(--muted)]">{suffix}</span> : null}
      {extraText ? <span className={cn("ml-1 text-sm text-[var(--muted)]", extraTextClassName)}>{extraText}</span> : null}
    </div>
  );
}


function getMaterialBgColor(materialCode: string): string {
  if (materialCode === "925") return "bg-gradient-to-br from-[var(--panel)] to-[var(--panel-hover)]";
  if (materialCode === "14" || materialCode === "18") return "bg-gradient-to-br from-[var(--danger-soft)] to-[var(--panel)]";
  if (materialCode === "24") return "bg-gradient-to-br from-[var(--warning-soft)] to-[var(--panel)]";
  if (materialCode === "00") return "bg-[var(--panel)]";
  return "bg-[var(--panel)]";
}

function toNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatWeightNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function materialCodeFromLabel(label: string) {
  if (label.includes("14K")) return "14";
  if (label.includes("18K")) return "18";
  if (label.includes("24K")) return "24";
  if (label.includes("925")) return "925";
  if (label.includes("999")) return "999";
  if (label.includes("00")) return "00";
  return "";
}

function supportsChinaCostPanel(materialCode: string) {
  void materialCode;
  return true;
}

export default function CatalogPage() {
  const [catalogItemsState, setCatalogItemsState] = useState<CatalogItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [view, setView] = useState<"list" | "gallery">("gallery");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"model" | "modified">("model");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [masterId, setMasterId] = useState("");
  const [modelName, setModelName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [vendorPrefixMap, setVendorPrefixMap] = useState<Record<string, string>>({});
  const [masterRowsById, setMasterRowsById] = useState<Record<string, Record<string, unknown>>>({});
  const [categoryCode, setCategoryCode] = useState("");
  const [masterKind, setMasterKind] = useState<"MODEL" | "PART" | "STONE" | "BUNDLE">("MODEL");
  const [materialCode, setMaterialCode] = useState("");
  const [weightDefault, setWeightDefault] = useState("");
  const [deductionWeight, setDeductionWeight] = useState("");
  const [platingSell, setPlatingSell] = useState(0);
  const [platingCost, setPlatingCost] = useState(0);
  const [laborProfileMode, setLaborProfileMode] = useState(FORCED_LABOR_PROFILE_MODE);
  const [laborBandCode, setLaborBandCode] = useState(FORCED_LABOR_BAND_CODE);
  const [settingAddonMarginKrwPerPiece, setSettingAddonMarginKrwPerPiece] = useState(0);
  const [stoneAddonMarginKrwPerPiece, setStoneAddonMarginKrwPerPiece] = useState(0);
  const [note, setNote] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [modifiedDate, setModifiedDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [centerQty, setCenterQty] = useState(0);
  const [sub1Qty, setSub1Qty] = useState(0);
  const [sub2Qty, setSub2Qty] = useState(0);
  const [centerStoneName, setCenterStoneName] = useState("");
  const [sub1StoneName, setSub1StoneName] = useState("");
  const [sub2StoneName, setSub2StoneName] = useState("");
  const [centerStoneSourceDefault, setCenterStoneSourceDefault] = useState<CatalogStoneSource>("FACTORY");
  const [sub1StoneSourceDefault, setSub1StoneSourceDefault] = useState<CatalogStoneSource>("FACTORY");
  const [sub2StoneSourceDefault, setSub2StoneSourceDefault] = useState<CatalogStoneSource>("FACTORY");
  const [laborBaseSell, setLaborBaseSell] = useState(0);
  const [laborCenterSell, setLaborCenterSell] = useState(0);
  const [laborSub1Sell, setLaborSub1Sell] = useState(0);
  const [laborSub2Sell, setLaborSub2Sell] = useState(0);
  const [laborBaseCost, setLaborBaseCost] = useState(0);
  const [laborCenterCost, setLaborCenterCost] = useState(0);
  const [laborSub1Cost, setLaborSub1Cost] = useState(0);
  const [laborSub2Cost, setLaborSub2Cost] = useState(0);
  const [centerSelfMargin, setCenterSelfMargin] = useState(0);
  const [sub1SelfMargin, setSub1SelfMargin] = useState(0);
  const [sub2SelfMargin, setSub2SelfMargin] = useState(0);
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [absorbLaborItems, setAbsorbLaborItems] = useState<MasterAbsorbLaborItem[]>([]);
  const [absorbBucket, setAbsorbBucket] = useState<AbsorbLaborBucket>("BASE_LABOR");
  const [absorbLaborClass, setAbsorbLaborClass] = useState<AbsorbLaborClass>("GENERAL");
  const [absorbStoneRole, setAbsorbStoneRole] = useState<AbsorbStoneRole>("CENTER");
  const [absorbReason, setAbsorbReason] = useState("");
  const [absorbAmount, setAbsorbAmount] = useState("0");
  const [absorbMaterialQtyPerUnit, setAbsorbMaterialQtyPerUnit] = useState("1");
  const [absorbMaterialCostKrw, setAbsorbMaterialCostKrw] = useState("0");
  const [absorbIsPerPiece, setAbsorbIsPerPiece] = useState(true);
  const [absorbVendorId, setAbsorbVendorId] = useState("");
  const [absorbIsActive, setAbsorbIsActive] = useState(true);
  const [editingAbsorbItemId, setEditingAbsorbItemId] = useState<string | null>(null);
  const [goldPrice, setGoldPrice] = useState(0);
  const [silverModifiedPrice, setSilverModifiedPrice] = useState(0);
  const [cnyAdRate, setCnyAdRate] = useState(0);
  const [cnyFxAsOf, setCnyFxAsOf] = useState("");
  const [csOriginalKrwPerG, setCsOriginalKrwPerG] = useState(0);
  const [cnLaborBasicCnyPerG, setCnLaborBasicCnyPerG] = useState("");
  const [cnLaborBasicBasis, setCnLaborBasicBasis] = useState<"PER_G" | "PER_PIECE">("PER_G");
  const [cnLaborExtraItems, setCnLaborExtraItems] = useState<ChinaExtraLaborItem[]>([]);
  const [cnRawEntries, setCnRawEntries] = useState<CnRawEntryState[]>([createEmptyCnRawEntry()]);
  const [cnRawHistoryByMasterId, setCnRawHistoryByMasterId] = useState<Record<string, CnRawHistoryRow[]>>({});
  const [isUnitPricing, setIsUnitPricing] = useState(false);

  const [showBomPanel, setShowBomPanel] = useState(false);
  const [showAbsorbPanel, setShowAbsorbPanel] = useState(false);
  const [recipeVariantKey, setRecipeVariantKey] = useState("");
  const [recipeNote, setRecipeNote] = useState("");
  const [recipeSellAdjustRate, setRecipeSellAdjustRate] = useState("1");
  const [recipeSellAdjustKrw, setRecipeSellAdjustKrw] = useState("0");
  const [recipeRoundUnitKrw, setRecipeRoundUnitKrw] = useState("1000");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [componentType, setComponentType] = useState<"PART" | "MASTER">("MASTER");
  const [showAdvancedComponents, setShowAdvancedComponents] = useState(false);
  const [componentQuery, setComponentQuery] = useState("");
  const [debouncedComponentQuery, setDebouncedComponentQuery] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [componentLineKind, setComponentLineKind] = useState<BomLineKind>("ACCESSORY");
  const [showComponentResults, setShowComponentResults] = useState(false);
  const [qtyPerUnit, setQtyPerUnit] = useState("1");
  const [lastAddedLineHint, setLastAddedLineHint] = useState<{ componentMasterId: string; qty: number } | null>(null);
  const [bomPreviewQtyInput, setBomPreviewQtyInput] = useState("1");
  const [unit, setUnit] = useState<"EA" | "G" | "M">("EA");
  const [lineNote, setLineNote] = useState("");
  const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null);
  const bomToastRef = useRef(false);
  const bomAutoSyncRef = useRef<string>("");
  const cnRawAutoSaveBusyRef = useRef(false);
  const absorbLaborCacheRef = useRef<Map<string, MasterAbsorbLaborItem[]>>(new Map());
  const selectedItemIdRef = useRef<string | null>(null);
  const absorbLaborAbortRef = useRef<AbortController | null>(null);
  const absorbLaborRequestSeqRef = useRef(0);

  const schema = getSchemaClient();
  const queryClient = useQueryClient();
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    return () => {
      absorbLaborAbortRef.current?.abort();
    };
  }, []);

  const loadAbsorbLaborItems = useCallback(async (targetMasterId: string, options?: { forceRefresh?: boolean }) => {
    if (!targetMasterId) {
      absorbLaborAbortRef.current?.abort();
      setAbsorbLaborItems([]);
      return;
    }
    if (!options?.forceRefresh && absorbLaborCacheRef.current.has(targetMasterId)) {
      if (selectedItemIdRef.current === targetMasterId) {
        setAbsorbLaborItems(absorbLaborCacheRef.current.get(targetMasterId) ?? []);
      }
      return;
    }

    absorbLaborAbortRef.current?.abort();
    const requestSeq = absorbLaborRequestSeqRef.current + 1;
    absorbLaborRequestSeqRef.current = requestSeq;
    const controller = new AbortController();
    absorbLaborAbortRef.current = controller;

    let response: Response;
    try {
      response = await fetch(`/api/master-absorb-labor-items?master_id=${encodeURIComponent(targetMasterId)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
    const json = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
    if (!response.ok) throw new Error(json.error ?? "흡수공임 조회 실패");
    if (controller.signal.aborted) return;
    if (requestSeq !== absorbLaborRequestSeqRef.current) return;

    const rows = json.data ?? [];
    absorbLaborCacheRef.current.set(targetMasterId, rows);
    if (selectedItemIdRef.current === targetMasterId) {
      setAbsorbLaborItems(rows);
    }
  }, []);

  const fetchFlattenRows = useCallback(async (targetMasterId: string, variantKey?: string | null) => {
    if (!targetMasterId) return [] as BomFlattenLeafRow[];
    const params = new URLSearchParams();
    params.set("product_master_id", targetMasterId);
    if (variantKey) params.set("variant_key", variantKey);
    const response = await fetch(`/api/bom-flatten?${params.toString()}`, { cache: "no-store" });
    const json = (await response.json()) as BomFlattenLeafRow[] | { error?: string };
    if (!response.ok) throw new Error((json as { error?: string }).error ?? "BOM 펼침 조회 실패");
    return (Array.isArray(json) ? json : []) as BomFlattenLeafRow[];
  }, []);

  const fetchBomRecipes = useCallback(async (targetMasterId: string) => {
    if (!targetMasterId) return [] as BomRecipeRow[];
    const response = await fetch(
      `/api/bom-recipes?product_master_id=${encodeURIComponent(targetMasterId)}`,
      { cache: "no-store" }
    );
    const json = (await response.json()) as { data?: BomRecipeRow[]; error?: string };
    if (!response.ok) throw new Error(json.error ?? "BOM 레시피 조회 실패");
    return (json.data ?? []) as BomRecipeRow[];
  }, []);

  const fetchBomLines = useCallback(async (targetBomId: string) => {
    if (!targetBomId) return [] as BomLineRow[];
    const response = await fetch(`/api/bom-lines?bom_id=${encodeURIComponent(targetBomId)}`, {
      cache: "no-store",
    });
    const json = (await response.json()) as { data?: BomLineRow[]; error?: string };
    if (!response.ok) throw new Error(json.error ?? "BOM 라인 조회 실패");
    return (json.data ?? []) as BomLineRow[];
  }, []);

  const prefetchMasterDetailFastPath = useCallback((targetMasterId: string) => {
    if (!targetMasterId) return;
    void queryClient.prefetchQuery({
      queryKey: ["bom", "flatten", targetMasterId, null],
      queryFn: () => fetchFlattenRows(targetMasterId, null),
      staleTime: 60_000,
      gcTime: 300_000,
    });
    void queryClient
      .prefetchQuery({
        queryKey: ["bom", "recipes", targetMasterId],
        queryFn: () => fetchBomRecipes(targetMasterId),
        staleTime: 60_000,
        gcTime: 300_000,
      })
      .then(async () => {
        const recipes = (queryClient.getQueryData(["bom", "recipes", targetMasterId]) ?? []) as BomRecipeRow[];
        const defaultRecipe = recipes.find((row) => !String(row.variant_key ?? "").trim()) ?? recipes[0];
        const bomId = String(defaultRecipe?.bom_id ?? "").trim();
        if (!bomId) return;
        await queryClient.prefetchQuery({
          queryKey: ["bom", "lines", bomId],
          queryFn: () => fetchBomLines(bomId),
          staleTime: 60_000,
          gcTime: 300_000,
        });
      })
      .catch(() => undefined);
    if (!absorbLaborCacheRef.current.has(targetMasterId)) {
      void fetch(`/api/master-absorb-labor-items?master_id=${encodeURIComponent(targetMasterId)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const json = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
          if (!response.ok) return;
          absorbLaborCacheRef.current.set(targetMasterId, json.data ?? []);
        })
        .catch(() => undefined);
    }
  }, [fetchBomLines, fetchBomRecipes, fetchFlattenRows, queryClient]);

  const loadCnRawHistory = useCallback(async (targetMasterId: string, options?: { syncEditor?: boolean }) => {
    if (!targetMasterId || !isUuid(targetMasterId)) return;
    const response = await fetch(`/api/master-item-cn-cost?master_id=${encodeURIComponent(targetMasterId)}`, {
      cache: "no-store",
    });
    const json = (await response.json()) as { data?: CnRawSnapshotRow[]; error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "RAW 분석 이력 조회 실패");
    }

    const normalizedRows = normalizeCnRawHistoryRows(Array.isArray(json.data) ? json.data : []);
    setCnRawHistoryByMasterId((prev) => ({
      ...prev,
      [targetMasterId]: normalizedRows,
    }));

    if (options?.syncEditor && normalizedRows.length > 0) {
      setCnRawEntries(
        sortCnRawEntriesAsc(
          normalizedRows.map((row) =>
            createEmptyCnRawEntry({
              id: row.id,
              analysisDate: toIsoDateInputValue(row.analysisDate),
              totalPriceCny: row.totalPriceCny > 0 ? String(row.totalPriceCny) : "",
              silverPriceCny: row.silverPriceCny > 0 ? String(row.silverPriceCny) : "",
              laborBasis: row.laborBasis,
            })
          )
        )
      );
    }
  }, []);

  // Fetch market prices
  const refreshMarketTicks = useCallback(async () => {
    try {
      const response = await fetch("/api/market-ticks");
      const result = await response.json();
      if (result.data) {
        setGoldPrice(result.data.gold);
        setSilverModifiedPrice(result.data.silver);
        setCnyAdRate(Number(result.data.cnyAd ?? 0));
        setCnyFxAsOf(String(result.data.fxAsOf ?? result.data.asof ?? new Date().toISOString()));
        setCsOriginalKrwPerG(Number(result.data.csTick ?? result.data.cs ?? 0));
      }
    } catch (error) {
      console.error("Failed to fetch market ticks:", error);
    }
  }, []);

  useEffect(() => {
    void refreshMarketTicks();
  }, [refreshMarketTicks]);

  const materialFactorQuery = useQuery({
    queryKey: ["cms", "material-factor-config", "catalog"],
    queryFn: async () => {
      if (!schema) throw new Error("Supabase env is missing");
      const { data, error } = await schema
        .from("cms_material_factor_config")
        .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis");
      if (error) throw error;
      return (data ?? []) as MaterialFactorConfigRow[];
    },
    staleTime: 60_000,
  });

  const materialFactorMap = useMemo(
    () => buildMaterialFactorMap(materialFactorQuery.data ?? null),
    [materialFactorQuery.data]
  );

  // Reset saving state when modal opens/closes to prevent stuck state
  useEffect(() => {
    if (!registerOpen) {
      setIsSaving(false);
    }
  }, [registerOpen]);
  // ✅ [추가] 배경 더블클릭 시 닫기 로직
  // Modal 컴포넌트가 배경 이벤트를 지원하지 않으므로, 문서 전체에서 감지합니다.
  useEffect(() => {
    if (!registerOpen) return;

    const handleBackdropDoubleClick = () => {
      setRegisterOpen(false);
      setIsSaving(false);
      setUploadError(null);
      setUploadingImage(false);
    };

    // 내부 div에서 e.stopPropagation()을 했기 때문에,
    // document까지 이벤트가 올라왔다면 '배경'을 더블클릭했다는 뜻입니다.
    document.addEventListener("dblclick", handleBackdropDoubleClick);
    return () => document.removeEventListener("dblclick", handleBackdropDoubleClick);
  }, [registerOpen]);
  const canSave = true;

  const today = new Date().toISOString().slice(0, 10);
  const applyVendorFromModelName = useCallback((value: string) => {
    if (!value || vendorId) return;
    const prefix = value.split("-")[0]?.trim().toUpperCase();
    if (!prefix) return;
    const matchedVendorId = vendorPrefixMap[prefix];
    if (matchedVendorId) {
      setVendorId(matchedVendorId);
    }
  }, [vendorId, vendorPrefixMap]);
  useEffect(() => {
    if (!vendorId && modelName && Object.keys(vendorPrefixMap).length > 0) {
      applyVendorFromModelName(modelName);
    }
  }, [vendorId, modelName, vendorPrefixMap, applyVendorFromModelName]);
  const totalLaborSell =
    laborBaseSell + laborCenterSell * centerQty + laborSub1Sell * sub1Qty + laborSub2Sell * sub2Qty;
  const totalLaborCost =
    laborBaseCost + laborCenterCost * centerQty + laborSub1Cost * sub1Qty + laborSub2Cost * sub2Qty;
  const manualAbsorbLaborItems = useMemo(
    () =>
      absorbLaborItems.filter(
        (item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item)
      ),
    [absorbLaborItems]
  );
  const visibleAbsorbLaborItems = useMemo(
    () => absorbLaborItems.filter((item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item)),
    [absorbLaborItems]
  );

  const absorbImpactSummary = useMemo(
    () => computeAbsorbImpactSummary(manualAbsorbLaborItems, centerQty, sub1Qty, sub2Qty),
    [manualAbsorbLaborItems, centerQty, sub1Qty, sub2Qty]
  );
  const laborBaseSellWithAbsorb = laborBaseSell + absorbImpactSummary.baseLaborUnit;
  const laborCenterSellWithAbsorb = laborCenterSell + absorbImpactSummary.stoneCenterUnit;
  const laborSub1SellWithAbsorb = laborSub1Sell + absorbImpactSummary.stoneSub1Unit;
  const laborSub2SellWithAbsorb = laborSub2Sell + absorbImpactSummary.stoneSub2Unit;
  const platingSellWithAbsorb = platingSell + absorbImpactSummary.platingUnit;

  const totalLaborSellForEdit =
    laborBaseSellWithAbsorb +
    laborCenterSellWithAbsorb * centerQty +
    laborSub1SellWithAbsorb * sub1Qty +
    laborSub2SellWithAbsorb * sub2Qty +
    platingSellWithAbsorb +
    absorbImpactSummary.etc;
  const totalLaborCostForEdit = totalLaborCost + platingCost;
  const isCenterQtyZero = Number(centerQty || 0) === 0;
  const isSub1QtyZero = Number(sub1Qty || 0) === 0;
  const isSub2QtyZero = Number(sub2Qty || 0) === 0;
  // 1. 필터 상태 추가 (검색어, 재질, 카테고리)
  const [filterQuery, setFilterQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [includeAccessory, setIncludeAccessory] = useState(false);

  // 2. 필터링 및 정렬 로직 구현 (기존 sortedCatalogItems 교체)
  const sortedCatalogItems = useMemo(() => {
    let filtered = [...catalogItemsState];

    // (0) 부속(ACCESSORY) 기본 제외
    if (!includeAccessory) {
      filtered = filtered.filter((item) => {
        const row = masterRowsById[item.id];
        return String(row?.category_code ?? "") !== "ACCESSORY";
      });
    }

    // (1) 재질 필터
    if (filterMaterial) {
      filtered = filtered.filter((item) => item.material === filterMaterial);
    }

    // (2) 카테고리 필터 (CatalogItem에는 없으므로 원본 데이터 masterRowsById 참조)
    if (filterCategory) {
      filtered = filtered.filter((item) => {
        const row = masterRowsById[item.id];
        return String(row?.category_code ?? "") === filterCategory;
      });
    }

    // (3) 검색어 필터 (모델명 또는 이름)
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.model.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      );
    }

    // (4) 정렬 (기존 로직 유지)
    filtered.sort((a, b) => {
      if (sortBy === "model") {
        return sortOrder === "asc"
          ? a.model.localeCompare(b.model)
          : b.model.localeCompare(a.model);
      } else {
        return sortOrder === "asc"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }
    });

    return filtered;
  }, [catalogItemsState, sortBy, sortOrder, masterRowsById, filterMaterial, filterCategory, filterQuery, includeAccessory]);
  const activePageSize = view === "gallery" ? 24 : 20;
  const totalPages = Math.max(1, Math.ceil(sortedCatalogItems.length / activePageSize));
  const totalCount = sortedCatalogItems.length;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * activePageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * activePageSize, totalCount);
  const pageItems = useMemo(() => {
    const start = (page - 1) * activePageSize;
    return sortedCatalogItems.slice(start, start + activePageSize);
  }, [sortedCatalogItems, page, activePageSize]);

  useEffect(() => {
    if (pageItems.length === 0) return;
    const ids = pageItems.slice(0, 8).map((item) => item.id).filter(Boolean);
    if (ids.length === 0) return;

    const timer = window.setTimeout(() => {
      ids.forEach((id) => prefetchMasterDetailFastPath(id));
    }, 60);

    return () => window.clearTimeout(timer);
  }, [pageItems, prefetchMasterDetailFastPath]);


  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedItem = useMemo(
    () => catalogItemsState.find((item) => item.id === selectedItemId) ?? null,
    [catalogItemsState, selectedItemId]
  );
  const vendorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    vendorOptions.forEach((option) => {
      if (option.value) {
        map.set(option.value, option.label);
      }
    });
    return map;
  }, [vendorOptions]);
  const selectedVendorName = useMemo(() => {
    if (!selectedItem?.vendor) return "";
    const matched = vendorOptions.find((option) => option.value === selectedItem.vendor);
    return matched?.label ?? selectedItem.vendor;
  }, [selectedItem?.vendor, vendorOptions]);
  const selectedMasterId = selectedItem?.id ?? null;

  // Calculate material price based on material code
  const calculateMaterialPrice = useCallback((material: string, weight: number, deduction: number) => {
    const netWeight = Math.max(0, weight - deduction);
    const isSilver = material === "925" || material === "999";
    return calcMaterialAmountSellKrw({
      netWeightG: netWeight,
      tickPriceKrwPerG: isSilver ? silverModifiedPrice : goldPrice,
      materialCode: material,
      factors: materialFactorMap,
    });
  }, [goldPrice, materialFactorMap, silverModifiedPrice]);

  function roundUpToThousand(value: number) {
    return Math.ceil(value / 1000) * 1000;
  }

  function roundUpDisplayHundred(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return Math.round(value);
    return roundUpToUnit(value, 100);
  }

  function formatDisplayKrw(value: number) {
    return new Intl.NumberFormat("ko-KR").format(Math.round(value));
  }

  function formatLaborDisplayKrw(value: number) {
    return new Intl.NumberFormat("ko-KR").format(roundUpDisplayHundred(value));
  }

  function formatDisplayCny(value: number) {
    if (!Number.isFinite(value)) return "0";
    return new Intl.NumberFormat("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function toCompactYyMmDd(value: string | null | undefined) {
    const text = String(value ?? "").trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[1].slice(2)}${isoMatch[2]}${isoMatch[3]}`;
    const compactMatch = text.match(/^\d{6}$/);
    if (compactMatch) return text;
    return "";
  }

  function toIsoDateInputValue(value: string | null | undefined) {
    const text = String(value ?? "").trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return text;
    const compactMatch = text.match(/^\d{6}$/);
    if (compactMatch) {
      const yy = Number(text.slice(0, 2));
      const mm = Number(text.slice(2, 4));
      const dd = Number(text.slice(4, 6));
      if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
      return `20${String(yy).padStart(2, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    return "";
  }

  function toIsoDateFromCompact(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) return null;
    const yy = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const dd = Number(digits.slice(4, 6));
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const yyyy = 2000 + yy;
    return `${String(yyyy)}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  function formatSharePercent(value: number, total: number) {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "";
    return `${((value / total) * 100).toFixed(1)}%`;
  }


  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/vendors");
      const result = (await response.json()) as {
        data?: { party_id?: string; name?: string }[];
        prefixes?: { prefix?: string; vendor_party_id?: string }[];
        error?: string;
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "공급처 조회 실패");
      }
      setVendorOptions(
        result.data.map((row) => ({
          label: row.name ?? "-",
          value: row.party_id ?? "",
        }))
      );
      const nextPrefixMap: Record<string, string> = {};
      result.prefixes?.forEach((row) => {
        const prefix = String(row.prefix ?? "").trim();
        const vendorPartyId = String(row.vendor_party_id ?? "").trim();
        if (prefix && vendorPartyId) {
          nextPrefixMap[prefix.toUpperCase()] = vendorPartyId;
        }
      });
      setVendorPrefixMap(nextPrefixMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : "공급처 조회 실패";
      toast.error("처리 실패", { description: message });
    }
  }, []);

  const fetchCatalogItems = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const response = await fetch("/api/master-items", { cache: "no-store" });
      const result = (await response.json()) as { data?: Record<string, unknown>[]; error?: string };
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "데이터 조회 실패");
      }

      const mapped = result.data.map((row: Record<string, unknown>) => {
        const modelName = String(row.model_name ?? "-");
        const masterId = String(row.master_id ?? modelName);
        const createdAt = String(row.created_at ?? "");
        const materialCodeValue = String(row.material_code_default ?? "-");
        const grossWeight = Number(row.weight_default_g);
        const deductionValue = Number(row.deduction_weight_default_g);
        const hasWeight = Number.isFinite(grossWeight);
        const safeDeduction = Number.isFinite(deductionValue) ? deductionValue : 0;
        const netWeight = hasWeight ? grossWeight - safeDeduction : 0;
        const weight = hasWeight
          ? `${formatWeightNumber(netWeight)} g (+${formatWeightNumber(grossWeight)} g)(-${formatWeightNumber(safeDeduction)} g)`
          : "-";
        const centerQty = Number(row.center_qty_default ?? 0);
        const sub1Qty = Number(row.sub1_qty_default ?? 0);
        const sub2Qty = Number(row.sub2_qty_default ?? 0);
        const laborTotal =
          Number(row.labor_base_cost ?? 0) +
          Number(row.labor_center_cost ?? 0) * centerQty +
          Number(row.labor_sub1_cost ?? 0) * sub1Qty +
          Number(row.labor_sub2_cost ?? 0) * sub2Qty;
        const cost =
          typeof laborTotal === "number" ? `₩${new Intl.NumberFormat("ko-KR").format(laborTotal)}` : "-";
        const active = "판매 중";

        return {
          id: masterId,
          model: modelName,
          name: String(row.name ?? modelName),
          date: createdAt ? createdAt.slice(0, 10) : "-",
          status: active,
          tone: "active" as const,
          weight,
          material: materialCodeValue,
          stone: "없음",
          vendor: String(row.vendor_party_id ?? "-") as string,
          color: "-",
          cost,
          grades: ["-", "-", "-"],
          imageUrl: row.image_url ? String(row.image_url) : null,
          masterKind: String(row.master_kind ?? "MODEL") as "MODEL" | "PART" | "STONE" | "BUNDLE",
        } as CatalogItem;
      });

      const rowsById: Record<string, Record<string, unknown>> = {};
      result.data.forEach((row) => {
        const id = String(row.master_id ?? row.model_name ?? "");
        if (id) rowsById[id] = row;
      });

      setCatalogItemsState(mapped);
      setMasterRowsById(rowsById);

      setSelectedItemId((prev) => {
        if (mapped.length === 0) return null;
        if (prev && mapped.some((it) => it.id === prev)) return prev;
        return mapped[0].id;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "데이터 조회 실패";
      toast.error("처리 실패", { description: message });
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogItems();
  }, [fetchCatalogItems]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const selectedDetail: CatalogDetail | null = useMemo(() => {
    if (!selectedItem) return null;
    const row = masterRowsById[selectedItem.id];
    if (!row) {
      const materialCodeValue = materialCodeFromLabel(selectedItem.material);
      return {
        masterKind: "MODEL",
        categoryCode: "",
        materialCode: materialCodeValue,
        weight: selectedItem.weight,
        deductionWeight: "",
        centerQty: selectedItem.stone === "없음" ? 0 : 1,
        sub1Qty: 0,
        sub2Qty: 0,
        centerStoneName: "",
        sub1StoneName: "",
        sub2StoneName: "",
        laborBaseSell: 0,
        laborCenterSell: 0,
        laborSub1Sell: 0,
        laborSub2Sell: 0,
        laborTotalSell: 0,
        laborBaseCost: 0,
        laborCenterCost: 0,
        laborSub1Cost: 0,
        laborSub2Cost: 0,
        laborTotalCost: 0,
        platingSell: 0,
        platingCost: 0,
        laborProfileMode: "MANUAL",
        laborBandCode: "",
        settingAddonMarginKrwPerPiece: 0,
        stoneAddonMarginKrwPerPiece: 0,
        note: "",
        releaseDate: selectedItem.date,
        modifiedDate: "",
      };
    }

    const centerQty = Number(row.center_qty_default ?? 0);
    const sub1Qty = Number(row.sub1_qty_default ?? 0);
    const sub2Qty = Number(row.sub2_qty_default ?? 0);
    const laborTotalSellValue =
      Number(row.labor_base_sell ?? 0) +
      Number(row.labor_center_sell ?? 0) * centerQty +
      Number(row.labor_sub1_sell ?? 0) * sub1Qty +
      Number(row.labor_sub2_sell ?? 0) * sub2Qty;
    const laborTotalCostValue =
      Number(row.labor_base_cost ?? 0) +
      Number(row.labor_center_cost ?? 0) * centerQty +
      Number(row.labor_sub1_cost ?? 0) * sub1Qty +
      Number(row.labor_sub2_cost ?? 0) * sub2Qty;

    return {
      masterKind: String(row.master_kind ?? "MODEL") as "MODEL" | "PART" | "STONE" | "BUNDLE",
      categoryCode: String(row.category_code ?? ""),
      materialCode: String(row.material_code_default ?? ""),
      weight: row.weight_default_g ? `${row.weight_default_g} g` : "",
      deductionWeight: row.deduction_weight_default_g ? String(row.deduction_weight_default_g) : "",
      centerQty,
      sub1Qty,
      sub2Qty,
      centerStoneName: String(row.center_stone_name_default ?? ""),
      sub1StoneName: String(row.sub1_stone_name_default ?? ""),
      sub2StoneName: String(row.sub2_stone_name_default ?? ""),
      laborBaseSell: Number(row.labor_base_sell ?? 0),
      laborCenterSell: Number(row.labor_center_sell ?? 0),
      laborSub1Sell: Number(row.labor_sub1_sell ?? 0),
      laborSub2Sell: Number(row.labor_sub2_sell ?? 0),
      laborTotalSell: Number(laborTotalSellValue),
      laborBaseCost: Number(row.labor_base_cost ?? 0),
      laborCenterCost: Number(row.labor_center_cost ?? 0),
      laborSub1Cost: Number(row.labor_sub1_cost ?? 0),
      laborSub2Cost: Number(row.labor_sub2_cost ?? 0),
      laborTotalCost: Number(laborTotalCostValue),
      platingSell: Number(row.plating_price_sell_default ?? 0),
      platingCost: Number(row.plating_price_cost_default ?? 0),
      laborProfileMode: String(row.labor_profile_mode ?? "MANUAL"),
      laborBandCode: String(row.labor_band_code ?? ""),
      settingAddonMarginKrwPerPiece: Number(row.setting_addon_margin_krw_per_piece ?? 0),
      stoneAddonMarginKrwPerPiece: Number(row.stone_addon_margin_krw_per_piece ?? 0),
      note: String(row.note ?? ""),
      releaseDate: String(row.created_at ?? "").slice(0, 10),
      modifiedDate: String(row.updated_at ?? "").slice(0, 10),
    };
  }, [masterRowsById, selectedItem]);

  const selectedMaterialLabel = useMemo(() => {
    const code = String(selectedDetail?.materialCode ?? "");
    if (!code) return "-";
    return materialOptions.find((material) => material.value === code)?.label ?? code;
  }, [selectedDetail?.materialCode]);
  const selectedCategoryLabel = useMemo(() => {
    const code = String(selectedDetail?.categoryCode ?? "");
    if (!code) return "-";
    return categoryOptions.find((category) => category.value === code)?.label ?? code;
  }, [selectedDetail?.categoryCode]);

  useEffect(() => {
    bomAutoSyncRef.current = "";
    setShowBomPanel(false);
    setSelectedRecipeId(null);
    setRecipeVariantKey("");
    setRecipeNote("");
    setRecipeSellAdjustRate("1");
    setRecipeSellAdjustKrw("0");
    setRecipeRoundUnitKrw("1000");
    setComponentQuery("");
    setSelectedComponentId(null);
    setShowComponentResults(false);
    setComponentType("MASTER");
    setShowAdvancedComponents(false);
    setBomPreviewQtyInput("1");
  }, [selectedMasterId]);

  useEffect(() => {
    if (!selectedItemId) {
      absorbLaborAbortRef.current?.abort();
      setAbsorbLaborItems([]);
      return;
    }
    setAbsorbLaborItems([]);
    void loadAbsorbLaborItems(selectedItemId).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "흡수공임 조회 실패";
      toast.error("처리 실패", { description: message });
    });
  }, [loadAbsorbLaborItems, selectedItemId]);

  const bomPreviewQty = useMemo(() => {
    const parsed = Number(bomPreviewQtyInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.max(1, Math.floor(parsed));
  }, [bomPreviewQtyInput]);

  useEffect(() => {
    if (masterKind !== "BUNDLE") return;
    setMaterialCode("00");
  }, [masterKind]);

  const recipesQuery = useQuery({
    queryKey: ["bom", "recipes", selectedMasterId],
    enabled: Boolean(selectedMasterId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: () => fetchBomRecipes(selectedMasterId ?? ""),
  });

  const recipeOptions = useMemo(() => {
    const rows = recipesQuery.data ?? [];
    return rows.map((r) => ({
      label: `${r.variant_key ? r.variant_key : "(DEFAULT)"} · lines=${r.line_count}${r.is_active ? "" : " · INACTIVE"}`,
      value: r.bom_id,
    }));
  }, [recipesQuery.data]);

  const selectedRecipe = useMemo(() => {
    if (!selectedRecipeId) return null;
    return (recipesQuery.data ?? []).find((recipe) => recipe.bom_id === selectedRecipeId) ?? null;
  }, [recipesQuery.data, selectedRecipeId]);

  useEffect(() => {
    const rows = recipesQuery.data ?? [];
    if (rows.length === 0) {
      if (selectedRecipeId !== null) setSelectedRecipeId(null);
      return;
    }
    const defaultRecipe = rows.find((row) => !row.variant_key || !row.variant_key.trim()) ?? rows[0];
    if (defaultRecipe && selectedRecipeId !== defaultRecipe.bom_id) {
      setSelectedRecipeId(defaultRecipe.bom_id);
    }
  }, [recipesQuery.data, selectedRecipeId]);

  useEffect(() => {
    if (!selectedRecipe) return;
    setRecipeVariantKey(selectedRecipe.variant_key ?? "");
    setRecipeNote(selectedRecipe.note ?? "");

    const meta = selectedRecipe.meta ?? {};
    const sellAdjustRate = Number(meta.sell_adjust_rate ?? 1);
    const sellAdjustKrw = Number(meta.sell_adjust_krw ?? 0);
    const roundUnitKrw = Number(meta.round_unit_krw ?? 1000);

    setRecipeSellAdjustRate(String(Number.isFinite(sellAdjustRate) ? sellAdjustRate : 1));
    setRecipeSellAdjustKrw(String(Number.isFinite(sellAdjustKrw) ? sellAdjustKrw : 0));
    setRecipeRoundUnitKrw(String(Number.isFinite(roundUnitKrw) ? roundUnitKrw : 1000));
  }, [selectedRecipe]);

  const previewVariantKey = selectedRecipe?.variant_key ?? null;

  const linesQuery = useQuery({
    queryKey: ["bom", "lines", selectedRecipeId],
    enabled: Boolean(selectedRecipeId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: () => fetchBomLines(selectedRecipeId ?? ""),
  });

  const componentMasterIds = useMemo(() => {
    const ids = new Set<string>();
    ((linesQuery.data ?? []) as BomLineRow[]).forEach((line) => {
      const masterId = String(line.component_master_id ?? "").trim();
      if (!masterId) return;
      ids.add(masterId);
    });
    return [...ids];
  }, [linesQuery.data]);

  const componentAbsorbQuery = useQuery({
    queryKey: ["master-absorb-labor-items", "batch", [...componentMasterIds].sort().join("|")],
    enabled: componentMasterIds.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      if (componentMasterIds.length === 0) return [] as MasterAbsorbLaborItem[];
      const response = await fetch(
        `/api/master-absorb-labor-items?master_ids=${encodeURIComponent(componentMasterIds.join(","))}`,
        { cache: "no-store" }
      );
      const json = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "구성품 마스터 흡수공임 조회 실패");
      return (json.data ?? []) as MasterAbsorbLaborItem[];
    },
  });

  const flattenQuery = useQuery({
    queryKey: ["bom", "flatten", selectedMasterId, previewVariantKey],
    enabled: Boolean(selectedMasterId),
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchFlattenRows(selectedMasterId ?? "", previewVariantKey),
  });

  const componentSearchQuery = useQuery({
    queryKey: ["bom", "componentSearch", debouncedComponentQuery],
    enabled: showBomPanel && debouncedComponentQuery.trim().length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/master-items?model=${encodeURIComponent(debouncedComponentQuery.trim())}`);
      const json = (await res.json()) as { data?: MasterSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "마스터 검색 실패");
      return json.data ?? [];
    },
  });

  useEffect(() => {
    if (componentQuery.trim().length > 0) {
      setShowComponentResults(true);
    }
  }, [componentQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedComponentQuery(componentQuery);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [componentQuery]);

  const componentSearchResults = useMemo(() => {
    const query = componentQuery.trim().toLowerCase();
    if (!query) return [] as MasterSummary[];

    const apiRows = (componentSearchQuery.data ?? []) as MasterSummary[];
    const localRows = Object.values(masterRowsById)
      .map((row) => ({
        master_id: String(row.master_id ?? ""),
        model_name: String(row.model_name ?? ""),
        category_code: row.category_code ? String(row.category_code) : null,
        material_code_default: row.material_code_default ? String(row.material_code_default) : null,
        image_url: row.image_url ? String(row.image_url) : null,
      }))
      .filter((row) => row.master_id && row.model_name);

    const merged = [...apiRows, ...localRows];
    const dedup = new Map<string, MasterSummary>();
    merged.forEach((row) => {
      const key = String(row.master_id ?? "");
      if (!key) return;
      if (!dedup.has(key)) dedup.set(key, row);
    });

    return [...dedup.values()]
      .filter((row) => {
        const model = String(row.model_name ?? "").toLowerCase();
        const id = String(row.master_id ?? "").toLowerCase();
        const category = String(row.category_code ?? "").toLowerCase();
        return model.includes(query) || id.includes(query) || category.includes(query);
      })
      .sort((a, b) => {
        const am = String(a.model_name ?? "").toLowerCase();
        const bm = String(b.model_name ?? "").toLowerCase();
        const aStarts = am.startsWith(query) ? 0 : 1;
        const bStarts = bm.startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return am.localeCompare(bm, "ko");
      })
      .slice(0, 200);
  }, [componentQuery, componentSearchQuery.data, masterRowsById]);

  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) return null;
    const matched = componentSearchResults.find((m) => m.master_id === selectedComponentId);
    if (matched) return matched;
    const row = masterRowsById[selectedComponentId] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      master_id: String(row.master_id ?? selectedComponentId),
      model_name: String(row.model_name ?? ""),
      category_code: row.category_code ? String(row.category_code) : null,
      material_code_default: row.material_code_default ? String(row.material_code_default) : null,
      image_url: row.image_url ? String(row.image_url) : null,
    } as MasterSummary;
  }, [componentSearchResults, masterRowsById, selectedComponentId]);

  const upsertRecipeMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.bomRecipeUpsert,
      successMessage: "구성 저장 완료",
    onSuccess: (result) => {
      if (typeof result === "string") setSelectedRecipeId(result);
      recipesQuery.refetch();
    },
  });

  const setMasterUnitPricingMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.setMasterUnitPricing,
    successMessage: "저장 완료",
    onSuccess: () => {
      void fetchCatalogItems();
    },
  });

  const addLineMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.bomRecipeLineAdd,
    successMessage: "구성품 추가 완료",
    onSuccess: () => {
      setSelectedComponentId(null);
      setQtyPerUnit("1");
      setLineNote("");
      setComponentQuery("");
      setDebouncedComponentQuery("");
      setShowComponentResults(false);
      void queryClient.invalidateQueries({ queryKey: ["bom", "lines"] });
      void queryClient.invalidateQueries({ queryKey: ["bom", "recipes", selectedMasterId] });
    },
  });

  const voidLineMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.bomRecipeLineVoid,
    successMessage: "구성품 제거(VOID) 완료",
    onSuccess: () => {
      linesQuery.refetch();
      recipesQuery.refetch();
    },
  });

  const canWrite =
    Boolean(actorId) &&
    isFnConfigured(CONTRACTS.functions.bomRecipeUpsert) &&
    isFnConfigured(CONTRACTS.functions.bomRecipeLineAdd) &&
    isFnConfigured(CONTRACTS.functions.bomRecipeLineVoid);

  const isActorMissing = !actorId;

  const writeDisabledReason =
    "쓰기 기능 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 미설정 또는 CONTRACTS.functions RPC 미설정";

  const canToggleUnitPricing = Boolean(isEditMode && selectedItemId);
  const unitPricingDisabledReason = canToggleUnitPricing ? "" : "저장 후 설정 가능";
  const isAccessoryCategory = categoryCode === "ACCESSORY";

  const netWeightG = useMemo(() => {
    const w = Number(weightDefault);
    const d = Number(deductionWeight);
    const safeW = Number.isFinite(w) ? w : 0;
    const safeD = Number.isFinite(d) ? d : 0;
    return Math.max(safeW - safeD, 0);
  }, [weightDefault, deductionWeight]);
  const cnRawEntriesSorted = useMemo(() => sortCnRawEntriesAsc(cnRawEntries), [cnRawEntries]);
  const cnRawEntriesComputed = useMemo<CnRawEntryComputed[]>(() => {
    return cnRawEntriesSorted.map((entry) => {
      const totalPriceCny = Math.max(toNumber(entry.totalPriceCny), 0);
      const silverPriceCny = Math.max(toNumber(entry.silverPriceCny), 0);
      const silverAmountCny = netWeightG * silverPriceCny;
      const laborBaseCny = totalPriceCny - silverAmountCny;
      const laborCny =
        entry.laborBasis === "PER_PIECE"
          ? laborBaseCny
          : netWeightG > 0
            ? laborBaseCny / netWeightG
            : 0;
      const totalCostKrw = totalPriceCny * (Number.isFinite(cnyAdRate) ? cnyAdRate : 0);
      const silverPriceKrwPerG = silverPriceCny * (Number.isFinite(cnyAdRate) ? cnyAdRate : 0);
      const laborKrw = laborCny * (Number.isFinite(cnyAdRate) ? cnyAdRate : 0);
      return {
        id: entry.id,
        analysisDate: entry.analysisDate,
        laborBasis: entry.laborBasis,
        totalPriceCny,
        silverPriceCny,
        silverAmountCny,
        laborBaseCny,
        laborCny,
        totalCostKrw,
        silverPriceKrwPerG,
        laborKrw,
      };
    });
  }, [cnRawEntriesSorted, cnyAdRate, netWeightG]);
  const showChinaCostPanel = useMemo(() => supportsChinaCostPanel(materialCode), [materialCode]);

  const addCnExtraItem = useCallback(() => {
    setCnLaborExtraItems((prev) => [...prev, { id: crypto.randomUUID(), label: "", basis: "PER_G", cnyAmount: "" }]);
  }, []);

  const changeCnExtraItem = useCallback((id: string, patch: Partial<Pick<ChinaExtraLaborItem, "label" | "basis" | "cnyAmount">>) => {
    setCnLaborExtraItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeCnExtraItem = useCallback((id: string) => {
    setCnLaborExtraItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const addCnRawEntry = useCallback(() => {
    setCnRawEntries((prev) => sortCnRawEntriesAsc([...prev, createEmptyCnRawEntry()]));
  }, []);

  const changeCnRawEntry = useCallback((id: string, patch: Partial<Omit<CnRawEntryState, "id">>) => {
    setCnRawEntries((prev) => sortCnRawEntriesAsc(prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))));
  }, []);

  const removeCnRawEntry = useCallback((id: string) => {
    setCnRawEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      return sortCnRawEntriesAsc(next.length > 0 ? next : [createEmptyCnRawEntry()]);
    });
  }, []);

  const buildCnExtraPayload = useCallback(() => {
    const extraPayload = cnLaborExtraItems
      .map((it) => {
        const amount = Number(it.cnyAmount);
        if (it.basis === "PER_PIECE") {
          return {
            label: it.label.trim(),
            basis: "PER_PIECE" as const,
            cny_per_piece: amount,
          };
        }
        return {
          label: it.label.trim(),
          basis: "PER_G" as const,
          cny_per_g: amount,
        };
      })
      .filter((it) =>
        it.label &&
        (("cny_per_piece" in it && Number.isFinite(it.cny_per_piece ?? Number.NaN) && (it.cny_per_piece ?? -1) >= 0) ||
          ("cny_per_g" in it && Number.isFinite(it.cny_per_g ?? Number.NaN) && (it.cny_per_g ?? -1) >= 0))
      );

    extraPayload.push(
      cnLaborBasicBasis === "PER_PIECE"
        ? {
          label: CN_BASIC_BASIS_META_LABEL,
          basis: "PER_PIECE" as const,
          cny_per_piece: Number(cnLaborBasicCnyPerG || 0),
        }
        : {
          label: CN_BASIC_BASIS_META_LABEL,
          basis: "PER_G" as const,
          cny_per_g: Number(cnLaborBasicCnyPerG || 0),
        }
    );

    return extraPayload;
  }, [cnLaborBasicBasis, cnLaborBasicCnyPerG, cnLaborExtraItems]);

  const buildCnRawEntriesPayload = useCallback(() => {
    return cnRawEntriesComputed
      .map((entry) => {
        const analysisDateIso =
          /^\d{4}-\d{2}-\d{2}$/.test(entry.analysisDate)
            ? entry.analysisDate
            : toIsoDateFromCompact(entry.analysisDate);
        return {
          request_id: entry.id,
          analysis_date: analysisDateIso,
          total_price_cny: entry.totalPriceCny,
          silver_price_cny_per_g: entry.silverPriceCny,
          labor_basis: entry.laborBasis,
          net_weight_g_snapshot: netWeightG,
          silver_amount_cny_snapshot: entry.silverAmountCny,
          labor_base_cny_snapshot: entry.laborBaseCny,
          labor_cny_snapshot: entry.laborCny,
          cny_krw_rate_snapshot: cnyAdRate,
          fx_asof: cnyFxAsOf || new Date().toISOString(),
          silver_price_krw_per_g_snapshot: entry.silverPriceKrwPerG,
          labor_krw_snapshot: entry.laborKrw,
          total_cost_krw_snapshot: entry.totalCostKrw,
        };
      })
      .filter((entry) => Boolean(entry.analysis_date) || entry.total_price_cny > 0 || entry.silver_price_cny_per_g > 0);
  }, [cnRawEntriesComputed, cnyAdRate, cnyFxAsOf, netWeightG]);

  const saveCnCostPayload = useCallback(async (targetMasterId: string, options?: { silent?: boolean }) => {
    if (!targetMasterId || !isUuid(targetMasterId)) return;
    if (options?.silent && cnRawAutoSaveBusyRef.current) return;

    const extraPayload = buildCnExtraPayload();
    const cnRawEntriesPayload = buildCnRawEntriesPayload();
    const latestCnRawPayload = cnRawEntriesPayload[cnRawEntriesPayload.length - 1] ?? null;

    if (options?.silent) {
      cnRawAutoSaveBusyRef.current = true;
    }

    try {
      const cnResp = await fetch("/api/master-item-cn-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cn_request_id: latestCnRawPayload?.request_id ?? crypto.randomUUID(),
          cn_source: "catalog:web",
          cn_formula_version: 1,
          master_id: targetMasterId,
          cn_labor_basic_cny_per_g: Number(cnLaborBasicCnyPerG || 0),
          cn_labor_extra_items: extraPayload,
          cn_raw_cost_date: latestCnRawPayload?.analysis_date ?? null,
          cn_raw_total_price_cny: latestCnRawPayload?.total_price_cny ?? 0,
          cn_raw_silver_price_cny: latestCnRawPayload?.silver_price_cny_per_g ?? 0,
          cn_raw_labor_basis: latestCnRawPayload?.labor_basis ?? "PER_G",
          cn_cny_krw_rate_snapshot: cnyAdRate,
          cn_fx_asof: cnyFxAsOf || new Date().toISOString(),
          cn_net_weight_g_snapshot: netWeightG,
          cn_silver_amount_cny_snapshot: latestCnRawPayload?.silver_amount_cny_snapshot ?? 0,
          cn_labor_base_cny_snapshot: latestCnRawPayload?.labor_base_cny_snapshot ?? 0,
          cn_labor_cny_snapshot: latestCnRawPayload?.labor_cny_snapshot ?? 0,
          cn_silver_price_krw_per_g_snapshot: latestCnRawPayload?.silver_price_krw_per_g_snapshot ?? 0,
          cn_labor_krw_snapshot: latestCnRawPayload?.labor_krw_snapshot ?? 0,
          cn_total_cost_krw_snapshot: latestCnRawPayload?.total_cost_krw_snapshot ?? 0,
          cn_raw_entries: cnRawEntriesPayload,
          cn_raw_input: {
            analysis_date: latestCnRawPayload?.analysis_date ?? null,
            total_price_cny: latestCnRawPayload?.total_price_cny ?? 0,
            silver_price_cny_per_g: latestCnRawPayload?.silver_price_cny_per_g ?? 0,
            labor_basis: latestCnRawPayload?.labor_basis ?? "PER_G",
            net_weight_g: netWeightG,
          },
          cn_raw_computed: {
            formula_version: 1,
            silver_amount_cny: latestCnRawPayload?.silver_amount_cny_snapshot ?? 0,
            labor_base_cny: latestCnRawPayload?.labor_base_cny_snapshot ?? 0,
            labor_cny: latestCnRawPayload?.labor_cny_snapshot ?? 0,
            cny_krw_rate: cnyAdRate,
            silver_price_krw_per_g: latestCnRawPayload?.silver_price_krw_per_g_snapshot ?? 0,
            labor_krw: latestCnRawPayload?.labor_krw_snapshot ?? 0,
            total_cost_krw: latestCnRawPayload?.total_cost_krw_snapshot ?? 0,
          },
        }),
      });

      const cnResult = (await cnResp.json()) as {
        error?: string;
        raw_saved?: boolean;
        current_rows_saved?: boolean;
        snapshot_saved?: boolean;
        snapshot_inserted?: number;
        hint?: string;
        current_rows_hint?: string;
        snapshot_hint?: string;
      };

      if (!cnResp.ok) {
        if (!options?.silent) {
          const desc = cnResult.error ? `중국 원가 저장 실패: ${cnResult.error}` : "중국 원가 저장에 실패했습니다.";
          toast.error("부가 저장 실패", { description: desc });
        }
        return;
      }

      if (!options?.silent && cnResult.raw_saved === false && cnResult.hint) {
        toast.warning("중국 원가 부분 저장", { description: cnResult.hint });
      }
      if (!options?.silent && cnResult.current_rows_saved === false && cnResult.current_rows_hint) {
        toast.info("RAW 현재행 저장 안내", { description: cnResult.current_rows_hint });
      }
      if (!options?.silent && cnResult.snapshot_saved === false && cnResult.snapshot_hint) {
        toast.info("RAW 분석 이력 저장 안내", { description: cnResult.snapshot_hint });
      }

      await loadCnRawHistory(targetMasterId, {
        syncEditor: isEditMode && (selectedItemId === targetMasterId || masterId === targetMasterId),
      });
    } catch (err) {
      if (!options?.silent) {
        const desc = err instanceof Error ? err.message : "중국 원가 저장에 실패했습니다.";
        toast.error("부가 저장 실패", { description: desc });
      }
    } finally {
      if (options?.silent) {
        cnRawAutoSaveBusyRef.current = false;
      }
    }
  }, [
    buildCnExtraPayload,
    buildCnRawEntriesPayload,
    cnLaborBasicCnyPerG,
    cnyAdRate,
    cnyFxAsOf,
    isEditMode,
    loadCnRawHistory,
    masterId,
    netWeightG,
    selectedItemId,
  ]);


  const notifyWriteDisabled = () => {
    if (bomToastRef.current) return;
    toast.error("쓰기 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 또는 RPC 설정을 확인하세요.");
    bomToastRef.current = true;
  };

  const isDefaultBomUniqueConflict = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const payload = error as Record<string, unknown>;
    const code = String(payload.code ?? "");
    const message = String(payload.message ?? "");
    return code === "23505" && message.includes("ux_cms_bom_recipe_default_active");
  };

  useEffect(() => {
    if (!canWrite && !bomToastRef.current && showBomPanel) {
      notifyWriteDisabled();
    }
  }, [canWrite, showBomPanel]);

  const handleCreateRecipe = async () => {
    if (!selectedMasterId) return toast.error("제품(마스터)을 먼저 선택해 주세요.");
    if (!canWrite) return notifyWriteDisabled();

    const parsedSellAdjustRate = Number(recipeSellAdjustRate);
    const parsedSellAdjustKrw = Number(recipeSellAdjustKrw);
    const parsedRoundUnitKrw = Number(recipeRoundUnitKrw);

    if (!Number.isFinite(parsedSellAdjustRate) || parsedSellAdjustRate <= 0) {
      return toast.error("sell_adjust_rate는 0보다 큰 숫자여야 합니다.");
    }
    if (!Number.isFinite(parsedSellAdjustKrw)) {
      return toast.error("sell_adjust_krw를 올바르게 입력해 주세요.");
    }
    if (!Number.isFinite(parsedRoundUnitKrw) || parsedRoundUnitKrw < 0) {
      return toast.error("round_unit_krw를 올바르게 입력해 주세요.");
    }

    await upsertRecipeMutation.mutateAsync({
      p_product_master_id: selectedMasterId,
      p_variant_key: recipeVariantKey.trim() ? recipeVariantKey.trim() : null,
      p_is_active: true,
      p_note: recipeNote.trim() ? recipeNote.trim() : null,
      p_meta: {
        sell_adjust_rate: parsedSellAdjustRate,
        sell_adjust_krw: parsedSellAdjustKrw,
        round_unit_krw: parsedRoundUnitKrw,
      },
      p_bom_id: selectedRecipeId,
      p_actor_person_id: actorId,
      p_note2: "upsert from web",
    });
  };

  const handleAddLine = async () => {
    if (!selectedComponentId) return toast.error("구성품을 먼저 선택해 주세요.");
    if (!canWrite) return notifyWriteDisabled();

    const getDefaultBomId = (rows: BomRecipeRow[]) => {
      const defaultRow = rows.find((row) => !row.variant_key || !row.variant_key.trim()) ?? rows[0] ?? null;
      return defaultRow?.bom_id ?? null;
    };

    const loadDefaultBomIdWithRetry = async (): Promise<string | null> => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const refreshed = await recipesQuery.refetch();
        const bomId = getDefaultBomId((refreshed.data ?? []) as BomRecipeRow[]);
        if (bomId) return bomId;
        await new Promise((resolve) => window.setTimeout(resolve, 120 * (attempt + 1)));
      }
      return null;
    };

    try {
      let effectiveBomId: string | null = selectedRecipeId ?? getDefaultBomId(recipesQuery.data ?? []);
      if (!effectiveBomId) {
        effectiveBomId = await loadDefaultBomIdWithRetry();
      }

      if (!effectiveBomId && selectedMasterId) {
        let upsertError: unknown = null;
        try {
          const created = await upsertRecipeMutation.mutateAsync({
            p_product_master_id: selectedMasterId,
            p_variant_key: null,
            p_is_active: true,
            p_note: null,
            p_meta: {
              sell_adjust_rate: 1,
              sell_adjust_krw: 0,
              round_unit_krw: 1000,
            },
            p_bom_id: null,
            p_actor_person_id: actorId,
            p_note2: "auto default set from web",
          });
          if (typeof created === "string" && created.trim()) {
            effectiveBomId = created;
            setSelectedRecipeId(created);
          }
        } catch (error) {
          upsertError = error;
        }

        if (!effectiveBomId) {
          effectiveBomId = await loadDefaultBomIdWithRetry();
          if (effectiveBomId) {
            setSelectedRecipeId(effectiveBomId);
          } else if (upsertError && !isDefaultBomUniqueConflict(upsertError)) {
            throw upsertError;
          }
        }
      }

      if (!effectiveBomId) {
        return toast.error("기본 구성 정보를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (selectedRecipeId !== effectiveBomId) {
        setSelectedRecipeId(effectiveBomId);
      }

      const qty = Number(qtyPerUnit);
      if (Number.isNaN(qty) || qty <= 0) return toast.error("수량(1개당 사용량)은 0보다 커야 합니다.");

      const addedComponentId = selectedComponentId;
      const addedQty = qty;

      await addLineMutation.mutateAsync({
        p_bom_id: effectiveBomId,
        p_component_ref_type: "MASTER",
        p_component_master_id: selectedComponentId,
        p_component_part_id: null,
        p_qty_per_unit: qty,
        p_unit: "EA",
        p_note: buildBomLineKindNote(componentLineKind),
        p_meta: {},
        p_actor_person_id: actorId,
        p_note2: "add line from web",
      });

      await queryClient.invalidateQueries({ queryKey: ["bom", "lines", effectiveBomId] });
      await queryClient.invalidateQueries({ queryKey: ["bom", "recipes", selectedMasterId] });
      await queryClient.invalidateQueries({ queryKey: ["bom", "flatten", selectedMasterId] });

      if (selectedMasterId) {
        const refreshedLines = await linesQuery.refetch();
        await syncBomAutoAbsorbLabor(selectedMasterId, (refreshedLines.data ?? []) as BomLineRow[]);
      }

      if (addedComponentId) {
        setLastAddedLineHint({ componentMasterId: addedComponentId, qty: addedQty });
      }
    } catch (error) {
      if (isDefaultBomUniqueConflict(error)) {
        toast.error("동시에 저장된 기본 구성을 확인 중입니다. 다시 한번 추가해 주세요.");
        await queryClient.invalidateQueries({ queryKey: ["bom", "recipes", selectedMasterId] });
        return;
      }
      const message = error instanceof Error ? error.message : "구성품 추가 중 오류가 발생했습니다.";
      toast.error("처리 실패", { description: message });
      return;
    }
  };

  const handleVoidConfirm = async () => {
    if (!voidConfirmId) return;
    if (!canWrite) return notifyWriteDisabled();

    await voidLineMutation.mutateAsync({
      p_bom_line_id: voidConfirmId,
      p_void_reason: "void from web",
      p_actor_person_id: actorId,
      p_note: "void from web",
    });

    if (selectedMasterId) {
      await queryClient.invalidateQueries({ queryKey: ["bom", "flatten", selectedMasterId] });
      const refreshedLines = await linesQuery.refetch();
      await syncBomAutoAbsorbLabor(selectedMasterId, (refreshedLines.data ?? []) as BomLineRow[]);
    }
    setVoidConfirmId(null);
  };

  const syncBomAutoAbsorbLabor = useCallback(
    async (masterIdToSync: string, lines: BomLineRow[]) => {
      const calcLineLaborTotal = (line: BomLineRow) => {
        const masterRow = line.component_master_id
          ? (masterRowsById[line.component_master_id] as Record<string, unknown> | undefined)
          : undefined;
        if (!masterRow) return 0;
        const qty = Number(line.qty_per_unit ?? 0);
        const centerQty = Number(masterRow.center_qty_default ?? 0);
        const sub1Qty = Number(masterRow.sub1_qty_default ?? 0);
        const sub2Qty = Number(masterRow.sub2_qty_default ?? 0);
        const laborPerUnit =
          Number(masterRow.labor_base_sell ?? 0) +
          Number(masterRow.labor_center_sell ?? 0) * centerQty +
          Number(masterRow.labor_sub1_sell ?? 0) * sub1Qty +
          Number(masterRow.labor_sub2_sell ?? 0) * sub2Qty;
        const total = laborPerUnit * qty;
        return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
      };

      const lineRows = lines.map((line) => {
        const kind = parseBomLineKind(line.note);
        const laborTotal = calcLineLaborTotal(line);
        const name = line.component_master_model_name ?? line.component_part_name ?? "장식";
        const qtyPerUnit = Math.max(0, Number(line.qty_per_unit ?? 0));
        const masterRow = line.component_master_id
          ? (masterRowsById[line.component_master_id] as Record<string, unknown> | undefined)
          : undefined;
        const grossPerUnit = Number(masterRow?.weight_default_g ?? 0);
        const deductionPerUnit = Number(masterRow?.deduction_weight_default_g ?? 0);
        const materialCode = String(masterRow?.material_code_default ?? "00");
        const materialPerUnit = calculateMaterialPrice(materialCode, grossPerUnit, deductionPerUnit);
        const materialTotal = Number.isFinite(materialPerUnit) ? Math.max(materialPerUnit * qtyPerUnit, 0) : 0;
        return {
          bomLineId: String(line.bom_line_id ?? "").trim(),
          kind,
          laborTotal,
          materialPerUnit: Number.isFinite(materialPerUnit) ? Math.max(materialPerUnit, 0) : 0,
          materialTotal,
          name,
          qtyPerUnit,
        };
      });

      const accessoryAmount = Math.max(
        0,
        lineRows
          .filter((row) => row.kind === "ACCESSORY")
          .reduce((sum, row) => sum + row.laborTotal, 0)
      );
      const decorRows = lineRows.filter((row) => row.kind === "DECOR" && row.laborTotal > 0 && row.bomLineId);
      const materialRows = lineRows.filter((row) => row.kind === "DECOR" && row.materialPerUnit > 0 && row.bomLineId);

      const getResponse = await fetch(
        `/api/master-absorb-labor-items?master_id=${encodeURIComponent(masterIdToSync)}`,
        { cache: "no-store" }
      );
      const getJson = (await getResponse.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
      if (!getResponse.ok) {
        throw new Error(getJson.error ?? "흡수공임 조회 실패");
      }

      const existing = (getJson.data ?? []).find(
        (item) => item.bucket === "BASE_LABOR" && item.reason === ACCESSORY_BASE_REASON
      );

      const payload = {
        absorb_item_id: existing?.absorb_item_id,
        master_id: masterIdToSync,
        bucket: "BASE_LABOR",
        reason: ACCESSORY_BASE_REASON,
        amount_krw: accessoryAmount,
        is_per_piece: true,
        vendor_party_id: null,
        is_active: accessoryAmount > 0,
      };

      const postResponse = await fetch("/api/master-absorb-labor-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const postJson = (await postResponse.json()) as { error?: string };
      if (!postResponse.ok) {
        throw new Error(postJson.error ?? "흡수공임 저장 실패");
      }

      const managedDecorItems = (getJson.data ?? []).filter((item) => {
        const reason = String(item.reason ?? "").trim();
        return isManagedDecorAbsorbItem(item) || reason.startsWith(BOM_DECOR_REASON_PREFIX);
      });
      const decorItemsByLineId = new Map<string, MasterAbsorbLaborItem>();
      managedDecorItems.forEach((item) => {
        const sourceLineId = parseManagedAbsorbSourceLineId(item.note, BOM_DECOR_NOTE_PREFIX);
        if (!sourceLineId) return;
        decorItemsByLineId.set(sourceLineId, item);
      });
      const activeDecorLineIds = new Set(decorRows.map((row) => row.bomLineId));
      const staleDecorItems = managedDecorItems.filter((item) => {
        const sourceLineId = parseManagedAbsorbSourceLineId(item.note, BOM_DECOR_NOTE_PREFIX);
        if (!sourceLineId) return item.is_active !== false;
        if (!activeDecorLineIds.has(sourceLineId)) return item.is_active !== false;
        const activeItem = decorItemsByLineId.get(sourceLineId);
        return String(item.absorb_item_id ?? "").trim() !== String(activeItem?.absorb_item_id ?? "").trim() && item.is_active !== false;
      });
      const managedMaterialItems = (getJson.data ?? []).filter((item) => isManagedMaterialAbsorbItem(item));
      const activeMaterialLineIds = new Set(materialRows.map((row) => row.bomLineId));
      const staleMaterialItems = managedMaterialItems.filter((item) => {
        const sourceLineId = parseManagedAbsorbSourceLineId(item.note, BOM_MATERIAL_NOTE_PREFIX);
        if (!sourceLineId) return item.is_active !== false;
        if (!activeMaterialLineIds.has(sourceLineId)) return item.is_active !== false;
        return String(item.absorb_item_id ?? "").trim() !== sourceLineId && item.is_active !== false;
      });

      for (const row of decorRows) {
        const existingDecor = decorItemsByLineId.get(row.bomLineId);
        const decorPayload = {
          absorb_item_id: existingDecor?.absorb_item_id,
          master_id: masterIdToSync,
          bucket: "ETC",
          reason: `${BOM_DECOR_REASON_PREFIX}${row.name}`,
          amount_krw: row.laborTotal,
          labor_class: "GENERAL",
          material_qty_per_unit: 1,
          material_cost_krw: 0,
          is_per_piece: true,
          vendor_party_id: null,
          is_active: true,
          note: buildDecorAbsorbNote(row.bomLineId, row.qtyPerUnit),
        };
        const response = await fetch("/api/master-absorb-labor-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(decorPayload),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "장식 흡수공임 저장 실패");
        }
      }

      for (const row of materialRows) {
        const materialPayload = {
          absorb_item_id: row.bomLineId,
          master_id: masterIdToSync,
          bucket: "ETC",
          reason: `${BOM_MATERIAL_REASON_PREFIX}${row.name}`,
          amount_krw: row.materialPerUnit,
          labor_class: "MATERIAL",
          material_qty_per_unit: row.qtyPerUnit,
          material_cost_krw: row.materialPerUnit,
          is_per_piece: true,
          vendor_party_id: null,
          is_active: true,
          note: buildMaterialAbsorbNote(row.bomLineId, row.qtyPerUnit),
        };
        const response = await fetch("/api/master-absorb-labor-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(materialPayload),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "소재 흡수공임 저장 실패");
        }
      }

      for (const staleItem of staleDecorItems) {
        const deactivatePayload = {
          absorb_item_id: staleItem.absorb_item_id,
          master_id: masterIdToSync,
          bucket: staleItem.bucket,
          reason: staleItem.reason,
          amount_krw: staleItem.amount_krw,
          is_per_piece: staleItem.is_per_piece,
          vendor_party_id: staleItem.vendor_party_id,
          is_active: false,
          note: staleItem.note,
        };
        const response = await fetch("/api/master-absorb-labor-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deactivatePayload),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "기존 장식 흡수공임 비활성화 실패");
        }
      }

      for (const staleItem of staleMaterialItems) {
        const deactivatePayload = {
          absorb_item_id: staleItem.absorb_item_id,
          master_id: masterIdToSync,
          bucket: staleItem.bucket,
          reason: staleItem.reason,
          amount_krw: staleItem.amount_krw,
          labor_class: normalizeAbsorbLaborClass(staleItem.labor_class),
          material_qty_per_unit: Math.max(Number(staleItem.material_qty_per_unit ?? 1), 0),
          material_cost_krw: Math.max(Number(staleItem.material_cost_krw ?? 0), 0),
          is_per_piece: staleItem.is_per_piece,
          vendor_party_id: staleItem.vendor_party_id,
          is_active: false,
          note: staleItem.note,
        };
        const response = await fetch("/api/master-absorb-labor-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deactivatePayload),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "기존 소재 흡수공임 비활성화 실패");
        }
      }

      absorbLaborCacheRef.current.delete(masterIdToSync);
      await queryClient.invalidateQueries({ queryKey: ["master-absorb-labor-items"] });
      if (selectedItemId === masterIdToSync) {
        await loadAbsorbLaborItems(masterIdToSync, { forceRefresh: true });
      }
    },
    [calculateMaterialPrice, loadAbsorbLaborItems, masterRowsById, queryClient, selectedItemId]
  );

  const createRecipeDisabled = !selectedMasterId || upsertRecipeMutation.isPending || !canWrite;
  const addLineDisabled = !selectedComponentId || addLineMutation.isPending || upsertRecipeMutation.isPending || !canWrite;
  const voidActionDisabled = voidLineMutation.isPending || !canWrite;

  const componentAbsorbByMasterId = useMemo(() => {
    const map = new Map<string, MasterAbsorbLaborItem[]>();
    (componentAbsorbQuery.data ?? []).forEach((row) => {
      const masterId = String(row.master_id ?? "").trim();
      if (!masterId) return;
      const existing = map.get(masterId) ?? [];
      existing.push(row);
      map.set(masterId, existing);
    });
    return map;
  }, [componentAbsorbQuery.data]);

  const bomLineMetrics = useMemo(() => {
    const rows = linesQuery.data ?? [];
    return rows.map((line) => {
      const masterRow = line.component_master_id
        ? (masterRowsById[line.component_master_id] as Record<string, unknown> | undefined)
        : undefined;
      const qty = Number(line.qty_per_unit ?? 0);
      const grossPerUnit = Number(masterRow?.weight_default_g ?? 0);
      const deductionPerUnit = Number(masterRow?.deduction_weight_default_g ?? 0);
      const grossWeight = Number.isFinite(grossPerUnit) && Number.isFinite(qty) ? grossPerUnit * qty : 0;
      const deductionWeight = Number.isFinite(deductionPerUnit) && Number.isFinite(qty) ? deductionPerUnit * qty : 0;
      const netWeight = Math.max(grossWeight - deductionWeight, 0);

      const componentMasterId = String(line.component_master_id ?? "").trim();
      const perUnitTotals = computeMasterLaborTotalsWithAbsorb(
        masterRow,
        componentMasterId ? (componentAbsorbByMasterId.get(componentMasterId) ?? []) : []
      );
      const laborTotal = Number.isFinite(perUnitTotals.sellPerUnit) && Number.isFinite(qty) ? perUnitTotals.sellPerUnit * qty : 0;

      const materialCode = String(masterRow?.material_code_default ?? "00");
      const materialPerUnit = calculateMaterialPrice(materialCode, grossPerUnit, deductionPerUnit);
      const materialTotal = Number.isFinite(materialPerUnit) && Number.isFinite(qty) ? materialPerUnit * qty : 0;
      const estimatedTotal = roundUpToThousand(materialTotal + laborTotal);

      return {
        line,
        grossWeight,
        deductionWeight,
        netWeight,
        laborTotal,
        materialTotal,
        estimatedTotal,
      };
    });
  }, [calculateMaterialPrice, componentAbsorbByMasterId, linesQuery.data, masterRowsById]);

  const bomTotals = useMemo(() => {
    return bomLineMetrics.reduce(
      (acc, row) => {
        acc.grossWeight += row.grossWeight;
        acc.deductionWeight += row.deductionWeight;
        acc.netWeight += row.netWeight;
        acc.laborTotal += row.laborTotal;
        acc.materialTotal += row.materialTotal;
        acc.estimatedTotal += row.estimatedTotal;
        return acc;
      },
      { grossWeight: 0, deductionWeight: 0, netWeight: 0, laborTotal: 0, materialTotal: 0, estimatedTotal: 0 }
    );
  }, [bomLineMetrics]);

  useEffect(() => {
    if (!showBomPanel || !selectedMasterId || !selectedRecipeId) return;
    if (!linesQuery.isSuccess || linesQuery.isFetching) return;

    const currentRecipeSet = new Set((recipesQuery.data ?? []).map((row) => String(row.bom_id ?? "").trim()));
    if (!currentRecipeSet.has(String(selectedRecipeId))) return;

    const lines = (linesQuery.data ?? []) as BomLineRow[];
    const hasForeignLines = lines.some((line) => {
      const bomId = String((line as Record<string, unknown>).bom_id ?? "").trim();
      return bomId.length > 0 && bomId !== String(selectedRecipeId);
    });
    if (hasForeignLines) return;

    const lineSignature = lines
      .map((line) => {
        const id = String(line.bom_line_id ?? "").trim();
        const kind = parseBomLineKind(line.note);
        const qty = Number(line.qty_per_unit ?? 0);
        const componentMasterId = String(line.component_master_id ?? "").trim();
        const componentPartId = String(line.component_part_id ?? "").trim();
        return `${id}:${kind}:${qty}:${componentMasterId}:${componentPartId}`;
      })
      .sort()
      .join("|");
    const syncKey = `${selectedMasterId}:${lineSignature}`;
    if (bomAutoSyncRef.current === syncKey) return;
    bomAutoSyncRef.current = syncKey;

    void syncBomAutoAbsorbLabor(selectedMasterId, lines).catch((error) => {
      const message = error instanceof Error ? error.message : "BOM 자동반영 실패";
      toast.error("처리 실패", { description: message });
    });
  }, [
    linesQuery.data,
    linesQuery.isFetching,
    linesQuery.isSuccess,
    recipesQuery.data,
    selectedMasterId,
    selectedRecipeId,
    showBomPanel,
    syncBomAutoAbsorbLabor,
  ]);

  const displayedBomLineMetrics = useMemo(() => {
    const rows = [...bomLineMetrics];
    rows.sort((a, b) => Number(b.line.line_no ?? 0) - Number(a.line.line_no ?? 0));
    return rows;
  }, [bomLineMetrics]);

  const decorLaborRows = useMemo(() => {
    const rows = displayedBomLineMetrics
      .filter(({ line }) => parseBomLineKind(line.note) === "DECOR")
      .map(({ line }, index) => {
        const componentMasterId = String(line.component_master_id ?? "").trim();
        if (!componentMasterId) return null;
        const componentMaster = masterRowsById[componentMasterId] as Record<string, unknown> | undefined;
        if (!componentMaster) return null;
        const qty = Math.max(Number(line.qty_per_unit ?? 0), 0);
        if (!Number.isFinite(qty) || qty <= 0) return null;
        const perUnitTotals = computeMasterLaborTotalsWithAbsorb(
          componentMaster,
          componentAbsorbByMasterId.get(componentMasterId) ?? []
        );
        const sellTotal = perUnitTotals.sellPerUnit * qty;
        const costTotal = perUnitTotals.costPerUnit * qty;
        return {
          id: String(line.bom_line_id ?? `${componentMasterId}-${index}`),
          label: `장식${index + 1}`,
          componentName: String(line.component_master_model_name ?? line.component_part_name ?? "장식"),
          qty,
          sellTotal,
          costTotal,
          marginTotal: sellTotal - costTotal,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      rows,
      sellTotal: rows.reduce((sum, row) => sum + row.sellTotal, 0),
      costTotal: rows.reduce((sum, row) => sum + row.costTotal, 0),
    };
  }, [componentAbsorbByMasterId, displayedBomLineMetrics, masterRowsById]);

  const flattenComponentMetrics = useMemo(() => {
    const rows = (flattenQuery.data ?? []) as BomFlattenLeafRow[];
    const mapped = rows.map((leaf, idx) => {
      const qty = Math.max(0, Number(leaf.qty_per_product_unit ?? 0));
      const componentMasterId = String(leaf.component_master_id ?? "").trim();
      const masterRow = leaf.component_master_id
        ? (masterRowsById[leaf.component_master_id] as Record<string, unknown> | undefined)
        : undefined;
      const grossPerUnit = Number(masterRow?.weight_default_g ?? 0);
      const deductionPerUnit = Number(masterRow?.deduction_weight_default_g ?? 0);
      const grossWeight = grossPerUnit * qty;

      const perUnitTotals = computeMasterLaborTotalsWithAbsorb(
        masterRow,
        componentMasterId ? (componentAbsorbByMasterId.get(componentMasterId) ?? []) : []
      );
      const laborSellTotal = perUnitTotals.sellPerUnit * qty;
      const laborCostTotal = perUnitTotals.costPerUnit * qty;

      return {
        key: `${leaf.component_master_id ?? leaf.component_part_id ?? "leaf"}-${idx}`,
        imageUrl: masterRow?.image_url ? String(masterRow.image_url) : null,
        name:
          leaf.component_master_model_name ??
          leaf.component_part_name ??
          leaf.component_master_id ??
          leaf.component_part_id ??
          "-",
        qty,
        unit: leaf.unit ?? "EA",
        grossWeight,
        laborSellTotal,
        laborCostTotal,
      };
    });

    const totals = mapped.reduce(
      (acc, row) => {
        acc.grossWeight += row.grossWeight;
        acc.laborSellTotal += row.laborSellTotal;
        acc.laborCostTotal += row.laborCostTotal;
        return acc;
      },
      { grossWeight: 0, laborSellTotal: 0, laborCostTotal: 0 }
    );

    return { rows: mapped, totals };
  }, [componentAbsorbByMasterId, flattenQuery.data, masterRowsById]);

  const decorLaborSellTotal = decorLaborRows.sellTotal;
  const decorLaborCostTotal = decorLaborRows.costTotal;
  const laborBaseSellWithAccessoryForEdit = laborBaseSellWithAbsorb;
  const laborBaseCostWithAccessoryForEdit = laborBaseCost;
  const totalLaborSellWithAccessoryForEdit = totalLaborSellForEdit + decorLaborSellTotal;
  const totalLaborCostWithAccessoryForEdit = totalLaborCostForEdit + decorLaborCostTotal;

  useEffect(() => {
    if (!lastAddedLineHint) return;
    const timer = window.setTimeout(() => {
      setLastAddedLineHint(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [lastAddedLineHint]);

  const materialPrice = useMemo(() => {
    if (!selectedItem || !selectedDetail) return 0;
    const weight = parseFloat(selectedDetail.weight ?? "0") || 0;
    const deduction = parseFloat(selectedDetail.deductionWeight ?? "0") || 0;
    return calculateMaterialPrice(selectedDetail.materialCode ?? "00", weight, deduction);
  }, [selectedItem, selectedDetail, calculateMaterialPrice]);

  const detailAbsorbImpactSummary = useMemo(() => {
    if (!selectedDetail) return createEmptyAbsorbSummary();
    return computeAbsorbImpactSummary(
      manualAbsorbLaborItems,
      Number(selectedDetail.centerQty ?? 0),
      Number(selectedDetail.sub1Qty ?? 0),
      Number(selectedDetail.sub2Qty ?? 0)
    );
  }, [
    manualAbsorbLaborItems,
    selectedDetail?.centerQty,
    selectedDetail?.sub1Qty,
    selectedDetail?.sub2Qty,
  ]);

  const detailLaborBaseSellDisplay =
    Number(selectedDetail?.laborBaseSell ?? 0) +
    detailAbsorbImpactSummary.baseLaborUnit;
  const detailLaborBaseCostDisplay = Number(selectedDetail?.laborBaseCost ?? 0);
  const detailLaborCenterSellDisplay = Number(selectedDetail?.laborCenterSell ?? 0) + detailAbsorbImpactSummary.stoneCenterUnit;
  const detailLaborSub1SellDisplay = Number(selectedDetail?.laborSub1Sell ?? 0) + detailAbsorbImpactSummary.stoneSub1Unit;
  const detailLaborSub2SellDisplay = Number(selectedDetail?.laborSub2Sell ?? 0) + detailAbsorbImpactSummary.stoneSub2Unit;
  const detailPlatingSellDisplay = Number(selectedDetail?.platingSell ?? 0) + detailAbsorbImpactSummary.platingUnit;
  const detailPlatingCostDisplay = Number(selectedDetail?.platingCost ?? 0);

  const detailLaborSell = selectedDetail
    ? detailLaborBaseSellDisplay +
    detailLaborCenterSellDisplay * selectedDetail.centerQty +
    detailLaborSub1SellDisplay * selectedDetail.sub1Qty +
    detailLaborSub2SellDisplay * selectedDetail.sub2Qty +
    detailPlatingSellDisplay +
    detailAbsorbImpactSummary.etc +
    decorLaborSellTotal
    : totalLaborSell;
  const detailLaborCost = selectedDetail
    ? detailLaborBaseCostDisplay +
    selectedDetail.laborCenterCost * selectedDetail.centerQty +
    selectedDetail.laborSub1Cost * selectedDetail.sub1Qty +
    selectedDetail.laborSub2Cost * selectedDetail.sub2Qty +
    detailPlatingCostDisplay +
    decorLaborCostTotal
    : totalLaborCost;
  const detailLaborSellWithAccessory = detailLaborSell;
  const detailLaborCostWithAccessory = detailLaborCost;
  const detailLaborMarginWithAccessory = detailLaborSellWithAccessory - detailLaborCostWithAccessory;
  const totalEstimatedCost = roundUpToThousand(materialPrice + detailLaborCostWithAccessory);
  const totalEstimatedSell = roundUpToThousand(materialPrice + detailLaborSellWithAccessory);

  const showDetailBaseRow = detailLaborBaseSellDisplay !== 0 || detailLaborBaseCostDisplay !== 0;
  const showDetailCenterRow =
    detailLaborCenterSellDisplay !== 0 ||
    Number(selectedDetail?.laborCenterCost ?? 0) !== 0 ||
    Number(selectedDetail?.centerQty ?? 0) !== 0;
  const showDetailSub1Row =
    detailLaborSub1SellDisplay !== 0 ||
    Number(selectedDetail?.laborSub1Cost ?? 0) !== 0 ||
    Number(selectedDetail?.sub1Qty ?? 0) !== 0;
  const showDetailSub2Row =
    detailLaborSub2SellDisplay !== 0 ||
    Number(selectedDetail?.laborSub2Cost ?? 0) !== 0 ||
    Number(selectedDetail?.sub2Qty ?? 0) !== 0;
  const detailEtcLaborSellDisplay = detailAbsorbImpactSummary.etc;
  const detailEtcLaborCostDisplay = 0;
  const showDetailEtcRow = detailEtcLaborSellDisplay !== 0 || detailEtcLaborCostDisplay !== 0;
  const detailDecorLaborRows = decorLaborRows.rows;
  const detailBaseLaborMargin = detailLaborBaseSellDisplay - detailLaborBaseCostDisplay;
  const detailCenterLaborMargin = detailLaborCenterSellDisplay - Number(selectedDetail?.laborCenterCost ?? 0);
  const detailSub1LaborMargin = detailLaborSub1SellDisplay - Number(selectedDetail?.laborSub1Cost ?? 0);
  const detailSub2LaborMargin = detailLaborSub2SellDisplay - Number(selectedDetail?.laborSub2Cost ?? 0);
  const detailPlatingLaborMargin = detailPlatingSellDisplay - detailPlatingCostDisplay;
  const detailEtcLaborMargin = detailEtcLaborSellDisplay - detailEtcLaborCostDisplay;
  const totalLaborMarginShare = formatSharePercent(detailLaborMarginWithAccessory, detailLaborSellWithAccessory);
  const detailBaseLaborMarginShare = formatSharePercent(detailBaseLaborMargin, detailLaborBaseSellDisplay);
  const detailCenterLaborSellTotal = detailLaborCenterSellDisplay * Number(selectedDetail?.centerQty ?? 0);
  const detailSub1LaborSellTotal = detailLaborSub1SellDisplay * Number(selectedDetail?.sub1Qty ?? 0);
  const detailSub2LaborSellTotal = detailLaborSub2SellDisplay * Number(selectedDetail?.sub2Qty ?? 0);
  const detailCenterLaborMarginShare = formatSharePercent(detailCenterLaborMargin, detailCenterLaborSellTotal);
  const detailSub1LaborMarginShare = formatSharePercent(detailSub1LaborMargin, detailSub1LaborSellTotal);
  const detailSub2LaborMarginShare = formatSharePercent(detailSub2LaborMargin, detailSub2LaborSellTotal);
  const detailPlatingLaborMarginShare = formatSharePercent(detailPlatingLaborMargin, detailPlatingSellDisplay);
  const detailEtcLaborMarginShare = formatSharePercent(detailEtcLaborMargin, detailEtcLaborSellDisplay);

  const chinaCostComparison = useMemo(() => {
    if (!selectedMasterId) return null;
    const row = masterRowsById[selectedMasterId] as Record<string, unknown> | undefined;
    if (!row) return null;

    const basicCny = Number(row.cn_labor_basic_cny_per_g) || 0;
    const extrasRaw = (Array.isArray(row.cn_labor_extra_items) ? row.cn_labor_extra_items : []) as Array<{
      label?: string;
      basis?: string;
      cny_per_g?: number;
      cny_per_piece?: number;
    }>;
    const basicBasisMeta = extrasRaw.find((it) => String(it.label ?? "").trim() === CN_BASIC_BASIS_META_LABEL);
    const basicBasis = String(basicBasisMeta?.basis ?? "PER_G").toUpperCase() === "PER_PIECE" ? "PER_PIECE" : "PER_G";
    const extras = extrasRaw.filter((it) => String(it.label ?? "").trim() !== CN_BASIC_BASIS_META_LABEL);

    const weight = parseFloat(String(row.weight_default_g ?? 0));
    const deduction = parseFloat(String(row.deduction_weight_default_g ?? 0));
    const netWeight = Number.isFinite(weight) ? Math.max(weight - (Number.isFinite(deduction) ? deduction : 0), 0) : 0;

    const materialKrw = Math.round(netWeight * csOriginalKrwPerG);
    const basicLaborKrw = basicBasis === "PER_PIECE"
      ? Math.round(basicCny * cnyAdRate)
      : Math.round(netWeight * basicCny * cnyAdRate);
    const extraLaborKrw = extras.reduce((sum, it) => {
      const basis = String(it.basis ?? "PER_G").toUpperCase();
      if (basis === "PER_PIECE") {
        return sum + Math.round((Number(it.cny_per_piece) || 0) * cnyAdRate);
      }
      return sum + Math.round(netWeight * (Number(it.cny_per_g) || 0) * cnyAdRate);
    }, 0);
    const laborKrw = basicLaborKrw + extraLaborKrw;
    const totalKrw = materialKrw + laborKrw;
    const hasData = basicCny > 0 || extras.length > 0;
    const reasonCostMap = new Map<string, number>();
    reasonCostMap.set("기본공임", basicLaborKrw);
    extras.forEach((it) => {
      const label = String(it.label ?? "").trim();
      if (!label) return;
      const basis = String(it.basis ?? "PER_G").toUpperCase();
      const cost = basis === "PER_PIECE"
        ? Math.round((Number(it.cny_per_piece) || 0) * cnyAdRate)
        : Math.round(netWeight * (Number(it.cny_per_g) || 0) * cnyAdRate);
      reasonCostMap.set(label, (reasonCostMap.get(label) ?? 0) + cost);
    });

    return {
      hasData,
      materialKrw,
      laborKrw,
      totalKrw,
      reasonCostMap,
    };
  }, [selectedMasterId, masterRowsById, csOriginalKrwPerG, cnyAdRate]);

  const detailRawNetWeight = useMemo(() => {
    const weight = parseFloat(String(selectedDetail?.weight ?? ""));
    const deduction = parseFloat(String(selectedDetail?.deductionWeight ?? ""));
    const safeWeight = Number.isFinite(weight) ? weight : 0;
    const safeDeduction = Number.isFinite(deduction) ? deduction : 0;
    return Math.max(safeWeight - safeDeduction, 0);
  }, [selectedDetail?.deductionWeight, selectedDetail?.weight]);

  const detailRawHistoryRows = useMemo<CnRawHistoryRow[]>(() => {
    if (!selectedMasterId) return [];
    const historyRows = cnRawHistoryByMasterId[selectedMasterId] ?? [];
    if (historyRows.length > 0) return historyRows;

    const row = masterRowsById[selectedMasterId] as Record<string, unknown> | undefined;
    if (!row) return [];

    const totalPriceCny = Math.max(Number(row.cn_raw_total_price_cny ?? 0), 0);
    const silverPriceCny = Math.max(Number(row.cn_raw_silver_price_cny ?? 0), 0);
    const laborBasis = normalizeCnRawLaborBasis(row.cn_raw_labor_basis);
    const laborBaseCny = totalPriceCny - detailRawNetWeight * silverPriceCny;
    const laborCny = laborBasis === "PER_PIECE"
      ? laborBaseCny
      : detailRawNetWeight > 0
        ? laborBaseCny / detailRawNetWeight
        : 0;
    const analysisDate = String(row.cn_raw_cost_date ?? "").trim();
    if (!analysisDate && totalPriceCny <= 0 && silverPriceCny <= 0) return [];
    const appliedRate = Number.isFinite(cnyAdRate) ? cnyAdRate : 0;
    return [
      {
        id: `legacy-${selectedMasterId}`,
        analysisDate,
        laborBasis,
        totalPriceCny,
        silverPriceCny,
        laborCny,
        totalCostKrw: totalPriceCny * appliedRate,
        silverPriceKrwPerG: silverPriceCny * appliedRate,
        laborKrw: laborCny * appliedRate,
        createdAt: "",
      },
    ];
  }, [cnRawHistoryByMasterId, cnyAdRate, detailRawNetWeight, masterRowsById, selectedMasterId]);


  const handleImageUpload = async (file: File) => {
    setUploadError(null);
    setUploadingImage(true);
    try {
      const compressedFile = await compressImage(file); // Compress to ~300KB
      const formData = new FormData();
      const previewUrl = URL.createObjectURL(compressedFile);
      setImageUrl(previewUrl);
      formData.append("file", compressedFile);
      const response = await fetch("/api/master-image", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { publicUrl?: string; path?: string; error?: string };
      if (!response.ok || !result.publicUrl || !result.path) {
        throw new Error(result.error ?? "이미지 업로드에 실패했습니다.");
      }
      setImageUrl(result.publicUrl);
      setImagePath(result.path);
    } catch (err) {
      const message = err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.";
      setUploadError(message);
      toast.error("처리 실패", { description: message });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = async () => {
    if (!imagePath) {
      setImageUrl(null);
      setImagePath(null);
      return;
    }
    try {
      const response = await fetch("/api/master-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: imagePath }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "이미지 삭제에 실패했습니다.");
      }
      setImageUrl(null);
      setImagePath(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "이미지 삭제에 실패했습니다.";
      setUploadError(message);
      toast.error("처리 실패", { description: message });
    }
  };

  const resetForm = () => {
    setShowAdvancedPricing(false);
    setMasterId(crypto.randomUUID());
    setModelName("");
    setVendorId("");
    setCategoryCode("");
    setMasterKind("MODEL");
    setMaterialCode("");
    setWeightDefault("");
    setDeductionWeight("");
    setCenterQty(0);
    setSub1Qty(0);
    setSub2Qty(0);
    setCenterStoneName("");
    setSub1StoneName("");
    setSub2StoneName("");
    setCenterStoneSourceDefault("FACTORY");
    setSub1StoneSourceDefault("FACTORY");
    setSub2StoneSourceDefault("FACTORY");
    setLaborBaseSell(0);
    setLaborCenterSell(0);
    setLaborSub1Sell(0);
    setLaborSub2Sell(0);
    setLaborBaseCost(0);
    setLaborCenterCost(0);
    setLaborSub1Cost(0);
    setLaborSub2Cost(0);
    setCenterSelfMargin(0);
    setSub1SelfMargin(0);
    setSub2SelfMargin(0);
    setPlatingSell(0);
    setPlatingCost(0);
    setLaborProfileMode(FORCED_LABOR_PROFILE_MODE);
    setLaborBandCode(FORCED_LABOR_BAND_CODE);
    setSettingAddonMarginKrwPerPiece(0);
    setStoneAddonMarginKrwPerPiece(0);
    setNote("");
    setReleaseDate(today);
    setModifiedDate("");
    setImageUrl(null);
    setImagePath(null);
    setCnLaborBasicCnyPerG("");
    setCnLaborBasicBasis("PER_G");
    setCnLaborExtraItems([]);
    setCnRawEntries([createEmptyCnRawEntry()]);
    setIsUnitPricing(false);
    setAbsorbLaborItems([]);
    setAbsorbBucket("BASE_LABOR");
    setAbsorbLaborClass("GENERAL");
    setAbsorbReason("");
    setAbsorbAmount("0");
    setAbsorbMaterialQtyPerUnit("1");
    setAbsorbMaterialCostKrw("0");
    setAbsorbIsPerPiece(true);
    setAbsorbVendorId("");
    setAbsorbIsActive(true);
    setEditingAbsorbItemId(null);
  };

  const handleOpenNew = () => {
    setIsEditMode(false);
    resetForm();
    setRegisterOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedItem || !selectedItemId) return;
    setShowAdvancedPricing(false);
    const detail = selectedDetail;
    const row = masterRowsById[selectedItemId];

    setIsEditMode(true);
    setMasterId(selectedItem.id);
    setModelName(selectedItem.model);
    const vendorCandidate = String(row?.vendor_party_id ?? selectedItem.vendor ?? "");
    setVendorId(
      isUuid(vendorCandidate)
        ? vendorCandidate
        : vendorOptions.find((option) => option.label === vendorCandidate)?.value ?? ""
    );
    setCategoryCode(detail?.categoryCode ?? "");
    setMasterKind((String((row as Record<string, unknown>)?.master_kind ?? detail?.masterKind ?? "MODEL") as "MODEL" | "PART" | "STONE" | "BUNDLE"));
    setMaterialCode(detail?.materialCode ?? materialCodeFromLabel(selectedItem.material));
    setWeightDefault(row?.weight_default_g ? String(row.weight_default_g) : "");
    setDeductionWeight(row?.deduction_weight_default_g ? String(row.deduction_weight_default_g) : "");
    setCenterQty(detail?.centerQty ?? 0);
    setSub1Qty(detail?.sub1Qty ?? 0);
    setSub2Qty(detail?.sub2Qty ?? 0);
    setCenterStoneName(detail?.centerStoneName ?? "");
    setSub1StoneName(detail?.sub1StoneName ?? "");
    setSub2StoneName(detail?.sub2StoneName ?? "");
    const rowCenterSource = String((row as Record<string, unknown>)?.center_stone_source_default ?? "FACTORY");
    const rowSub1Source = String((row as Record<string, unknown>)?.sub1_stone_source_default ?? "FACTORY");
    const rowSub2Source = String((row as Record<string, unknown>)?.sub2_stone_source_default ?? "FACTORY");
    const normalizedCenterSource: CatalogStoneSource = rowCenterSource === "SELF" ? "SELF" : "FACTORY";
    const normalizedSub1Source: CatalogStoneSource = rowSub1Source === "SELF" ? "SELF" : "FACTORY";
    const normalizedSub2Source: CatalogStoneSource = rowSub2Source === "SELF" ? "SELF" : "FACTORY";
    setCenterStoneSourceDefault(normalizedCenterSource);
    setSub1StoneSourceDefault(normalizedSub1Source);
    setSub2StoneSourceDefault(normalizedSub2Source);
    setLaborBaseSell(detail?.laborBaseSell ?? 0);
    setLaborCenterSell(detail?.laborCenterSell ?? 0);
    setLaborSub1Sell(detail?.laborSub1Sell ?? 0);
    setLaborSub2Sell(detail?.laborSub2Sell ?? 0);
    setLaborBaseCost(detail?.laborBaseCost ?? 0);
    setLaborCenterCost(detail?.laborCenterCost ?? 0);
    setLaborSub1Cost(detail?.laborSub1Cost ?? 0);
    setLaborSub2Cost(detail?.laborSub2Cost ?? 0);
    setCenterSelfMargin(
      normalizedCenterSource === "SELF"
        ? (detail?.laborCenterSell ?? 0) - (detail?.laborCenterCost ?? 0)
        : 0
    );
    setSub1SelfMargin(
      normalizedSub1Source === "SELF"
        ? (detail?.laborSub1Sell ?? 0) - (detail?.laborSub1Cost ?? 0)
        : 0
    );
    setSub2SelfMargin(
      normalizedSub2Source === "SELF"
        ? (detail?.laborSub2Sell ?? 0) - (detail?.laborSub2Cost ?? 0)
        : 0
    );
    setPlatingSell(detail?.platingSell ?? 0);
    setPlatingCost(detail?.platingCost ?? 0);
    setLaborProfileMode(FORCED_LABOR_PROFILE_MODE);
    setLaborBandCode(FORCED_LABOR_BAND_CODE);
    setSettingAddonMarginKrwPerPiece(detail?.settingAddonMarginKrwPerPiece ?? 0);
    setStoneAddonMarginKrwPerPiece(detail?.stoneAddonMarginKrwPerPiece ?? 0);
    setNote(detail?.note ?? "");
    setReleaseDate(detail?.releaseDate ?? selectedItem.date);
    setModifiedDate(today);

    // Populate image data
    setImageUrl(row?.image_url ? String(row.image_url) : null);
    setImagePath(row?.image_path ? String(row.image_path) : null);
    setIsUnitPricing(Boolean(row?.is_unit_pricing));

    // China cost inputs (optional columns)
    const cnBasicRaw = (row as Record<string, unknown>)?.cn_labor_basic_cny_per_g;
    const cnBasicNum = typeof cnBasicRaw === "number" ? cnBasicRaw : Number(cnBasicRaw);
    setCnLaborBasicCnyPerG(Number.isFinite(cnBasicNum) && cnBasicNum > 0 ? String(cnBasicNum) : "");
    setCnLaborBasicBasis("PER_G");

    const cnExtraRaw = (row as Record<string, unknown>)?.cn_labor_extra_items;
    if (Array.isArray(cnExtraRaw)) {
      const basicBasisMeta = cnExtraRaw.find((it) => {
        const raw = it as Record<string, unknown>;
        return String(raw.label ?? "").trim() === CN_BASIC_BASIS_META_LABEL;
      });
      const basicBasisText = String((basicBasisMeta as Record<string, unknown> | undefined)?.basis ?? "PER_G").trim().toUpperCase();
      setCnLaborBasicBasis(basicBasisText === "PER_PIECE" ? "PER_PIECE" : "PER_G");

      setCnLaborExtraItems(
        cnExtraRaw
          .map((it) => {
            const raw = it as Record<string, unknown>;
            const basisText = String(raw.basis ?? "PER_G").trim().toUpperCase();
            const basis: "PER_G" | "PER_PIECE" = basisText === "PER_PIECE" ? "PER_PIECE" : "PER_G";
            const amountRaw = basis === "PER_PIECE" ? raw.cny_per_piece : raw.cny_per_g;
            return {
              id: crypto.randomUUID(),
              label: String(raw.label ?? "").trim(),
              basis,
              cnyAmount:
                amountRaw === null || amountRaw === undefined
                  ? ""
                  : String(amountRaw),
            };
          })
          .filter((it) => it.label && it.label !== CN_BASIC_BASIS_META_LABEL)
      );
    } else {
      setCnLaborBasicBasis("PER_G");
      setCnLaborExtraItems([]);
    }

    const cnRawCostDateValue = String((row as Record<string, unknown>)?.cn_raw_cost_date ?? "").trim();
    const cnRawTotalPriceValue = Number((row as Record<string, unknown>)?.cn_raw_total_price_cny ?? 0);
    const cnRawSilverPriceValue = Number((row as Record<string, unknown>)?.cn_raw_silver_price_cny ?? 0);
    const cnRawLaborBasisValue =
      String((row as Record<string, unknown>)?.cn_raw_labor_basis ?? "PER_G").trim().toUpperCase() === "PER_PIECE"
        ? "PER_PIECE"
        : "PER_G";
    setCnRawEntries([
      createEmptyCnRawEntry({
        analysisDate: toIsoDateInputValue(cnRawCostDateValue),
        totalPriceCny: Number.isFinite(cnRawTotalPriceValue) && cnRawTotalPriceValue > 0 ? String(cnRawTotalPriceValue) : "",
        silverPriceCny: Number.isFinite(cnRawSilverPriceValue) && cnRawSilverPriceValue > 0 ? String(cnRawSilverPriceValue) : "",
        laborBasis: cnRawLaborBasisValue,
      }),
    ]);

    if (selectedItem.id) {
      void loadAbsorbLaborItems(selectedItem.id).catch((error) => {
        const message = error instanceof Error ? error.message : "흡수공임 조회 실패";
        toast.error("처리 실패", { description: message });
      });
      void loadCnRawHistory(selectedItem.id, { syncEditor: true }).catch((error) => {
        console.error("Failed to load RAW history for editor:", error);
      });
    }

    setRegisterOpen(true);
  };

  const handleToggleUnitPricing = async () => {
    if (!selectedItemId) return;
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", {
        description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요.",
      });
      return;
    }

    const nextValue = !isUnitPricing;
    try {
      await setMasterUnitPricingMutation.mutateAsync({
        p_master_id: selectedItemId,
        p_is_unit_pricing: nextValue,
        p_actor_person_id: actorId,
        p_session_id: null,
        p_memo: "set from catalog",
      });
      setIsUnitPricing(nextValue);
    } catch {
      // useRpcMutation.onError에서 토스트 처리됨
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("처리 실패", { description: "잠시 후 다시 시도해 주세요" });
      return;
    }
    if (!modelName) {
      toast.error("처리 실패", { description: "모델명이 필요합니다." });
      return;
    }

    const normalizedLaborProfileMode = FORCED_LABOR_PROFILE_MODE;
    const normalizedLaborBandCode = FORCED_LABOR_BAND_CODE;
    const normalizedMaterialCode =
      masterKind === "MODEL" ? (materialCode || "00") : materialCode || null;

    if (masterKind === "MODEL" && !materialCode) {
      setMaterialCode("00");
    }

    const payload = {
      master_id: masterId || null,
      model_name: modelName,
      master_kind: masterKind,
      category_code: categoryCode || null,
      material_code_default: normalizedMaterialCode,
      weight_default_g: masterKind === "BUNDLE" ? null : weightDefault ? Number(weightDefault) : null,
      deduction_weight_default_g: masterKind === "BUNDLE" ? 0 : deductionWeight ? Number(deductionWeight) : 0,
      center_qty_default: masterKind === "BUNDLE" ? 0 : centerQty,
      sub1_qty_default: masterKind === "BUNDLE" ? 0 : sub1Qty,
      sub2_qty_default: masterKind === "BUNDLE" ? 0 : sub2Qty,
      center_stone_name_default: centerStoneName || null,
      sub1_stone_name_default: sub1StoneName || null,
      sub2_stone_name_default: sub2StoneName || null,
      center_stone_source_default: centerStoneSourceDefault,
      sub1_stone_source_default: sub1StoneSourceDefault,
      sub2_stone_source_default: sub2StoneSourceDefault,
      buy_margin_profile_id: null,
      labor_base_sell: laborBaseSell,
      labor_center_sell: laborCenterSell,
      labor_sub1_sell: laborSub1Sell,
      labor_sub2_sell: laborSub2Sell,
      labor_base_cost: laborBaseCost,
      labor_center_cost: laborCenterCost,
      labor_sub1_cost: laborSub1Cost,
      labor_sub2_cost: laborSub2Cost,
      plating_price_sell_default: platingSell,
      plating_price_cost_default: platingCost,
      labor_profile_mode: normalizedLaborProfileMode,
      labor_band_code: normalizedLaborBandCode,
      setting_addon_margin_krw_per_piece: settingAddonMarginKrwPerPiece,
      stone_addon_margin_krw_per_piece: stoneAddonMarginKrwPerPiece,
      vendor_party_id: isUuid(vendorId) ? vendorId : null,
      note,
      image_path: imagePath || null,
    } as const;

    setIsSaving(true);
    try {
      const response = await fetch("/api/master-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; master_id?: string };
      if (!response.ok) throw new Error(result.error ?? "저장에 실패했습니다.");

      const savedId = result.master_id ?? masterId;

      // China cost inputs: add-only backend endpoint
      if (savedId) {
        await saveCnCostPayload(savedId, { silent: false });
      }

      toast.success("저장 완료");

      // ✅ 저장 성공 시 즉시 닫기
      setRegisterOpen(false);
      setIsEditMode(false);

      if (savedId) {
        setMasterId(savedId);
        setSelectedItemId(savedId);
      }

      // ✅ 목록 갱신은 기다리지 않음(지연돼도 저장 흐름 안 막음)
      void fetchCatalogItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
      toast.error("처리 실패", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const applyGlobalLaborSellFromCost = async (
    laborComponent: "BASE_LABOR" | "STONE",
    nextCost: number,
    setSell: (value: number) => void
  ) => {
    const normalizedCost = Number(nextCost);
    if (!Number.isFinite(normalizedCost) || normalizedCost < 0) return;

    const attempts: Array<{ scope: "FACTORY"; vendor_party_id: string | null }> = [
      { scope: "FACTORY", vendor_party_id: vendorId || null },
      { scope: "FACTORY", vendor_party_id: null },
    ];

    try {
      let pickedMarkup = 0;

      for (const attempt of attempts) {
        const response = await fetch("/api/pricing-rule-pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            component: laborComponent,
            scope: attempt.scope,
            apply_unit: "PER_PIECE",
            stone_role: null,
            vendor_party_id: attempt.vendor_party_id,
            cost_basis_krw: normalizedCost,
          }),
        });

        if (!response.ok) continue;

        const payload = (await response.json()) as {
          data?: { picked_rule_id?: string | null; markup_krw?: number | null } | Array<{ picked_rule_id?: string | null; markup_krw?: number | null }> | null;
        };
        const picked = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        const markup = Number(picked?.markup_krw ?? 0);
        const hasPickedRule = Boolean(picked?.picked_rule_id);
        if (Number.isFinite(markup) && hasPickedRule) {
          pickedMarkup = Math.max(markup, 0);
          break;
        }
      }

      setSell(normalizedCost + pickedMarkup);
    } catch {
      // 룰 조회 실패 시 현재 입력값을 유지합니다.
    }
  };

  const applyGlobalPlatingSellFromCost = async (nextCost: number, setSell: (value: number) => void) => {
    const normalizedCost = Number(nextCost);
    if (!Number.isFinite(normalizedCost) || normalizedCost < 0) return;

    type PlatingRuleRow = {
      is_active?: boolean;
      vendor_party_id?: string | null;
      min_cost_krw?: number | null;
      max_cost_krw?: number | null;
      markup_value_krw?: number | null;
      margin_fixed_krw?: number | null;
      margin_per_g_krw?: number | null;
      category_code?: string | null;
      material_code?: string | null;
      priority?: number | null;
    };

    try {
      const pricingRuleAttempts: Array<{ vendor_party_id: string | null }> = [
        { vendor_party_id: isUuid(vendorId) ? vendorId : null },
        { vendor_party_id: null },
      ];

      for (const attempt of pricingRuleAttempts) {
        const pickResponse = await fetch("/api/pricing-rule-pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            component: "SETTING",
            scope: "FACTORY",
            apply_unit: "PER_PIECE",
            stone_role: null,
            vendor_party_id: attempt.vendor_party_id,
            cost_basis_krw: normalizedCost,
          }),
        });

        if (!pickResponse.ok) continue;
        const pickPayload = (await pickResponse.json()) as {
          data?: { picked_rule_id?: string | null; markup_krw?: number | null } | Array<{ picked_rule_id?: string | null; markup_krw?: number | null }> | null;
        };
        const picked = Array.isArray(pickPayload.data) ? pickPayload.data[0] : pickPayload.data;
        const markup = Number(picked?.markup_krw ?? 0);
        if (Number.isFinite(markup) && picked?.picked_rule_id) {
          const nextSell = Math.max(roundUpDisplayHundred(normalizedCost + Math.max(markup, 0)), 0);
          setSell(nextSell);
          return;
        }
      }

      // Legacy fallback: plating-markup-rules (variant/fixed/per-g)
      const response = await fetch("/api/plating-markup-rules", { cache: "no-store" });
      if (!response.ok) {
        setSell(normalizedCost);
        return;
      }

      const payload = (await response.json()) as { data?: PlatingRuleRow[] };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const vendorScope = isUuid(vendorId) ? vendorId : null;
      const safeCategory = categoryCode || null;
      const safeMaterial = materialCode || null;
      const netWeight = Math.max(toNumber(weightDefault) - toNumber(deductionWeight), 0);

      const matched = rows
        .filter((rule) => rule.is_active !== false)
        .filter((rule) => !rule.vendor_party_id || rule.vendor_party_id === vendorScope)
        .filter((rule) => !rule.category_code || rule.category_code === safeCategory)
        .filter((rule) => !rule.material_code || rule.material_code === safeMaterial)
        .filter((rule) => {
          const min = Number(rule.min_cost_krw ?? 0);
          const max = rule.max_cost_krw === null || rule.max_cost_krw === undefined
            ? Number.POSITIVE_INFINITY
            : Number(rule.max_cost_krw);
          return normalizedCost >= min && normalizedCost <= max;
        })
        .sort((a, b) => {
          const aVendorScore = a.vendor_party_id ? 1 : 0;
          const bVendorScore = b.vendor_party_id ? 1 : 0;
          if (aVendorScore !== bVendorScore) return bVendorScore - aVendorScore;

          const aCategoryScore = a.category_code ? 1 : 0;
          const bCategoryScore = b.category_code ? 1 : 0;
          if (aCategoryScore !== bCategoryScore) return bCategoryScore - aCategoryScore;

          const aMaterialScore = a.material_code ? 1 : 0;
          const bMaterialScore = b.material_code ? 1 : 0;
          if (aMaterialScore !== bMaterialScore) return bMaterialScore - aMaterialScore;

          const aPriority = Number(a.priority ?? 100);
          const bPriority = Number(b.priority ?? 100);
          return aPriority - bPriority;
        });

      const selected = matched[0];
      if (!selected) {
        setSell(normalizedCost);
        return;
      }

      const fixed = Number(selected.markup_value_krw ?? selected.margin_fixed_krw ?? 0);
      const perG = Number(selected.margin_per_g_krw ?? 0);
      const safeFixed = Number.isFinite(fixed) ? Math.max(fixed, 0) : 0;
      const safePerG = Number.isFinite(perG) ? Math.max(perG, 0) : 0;

      const nextSell = Math.max(roundUpDisplayHundred(normalizedCost + safeFixed + safePerG * netWeight), 0);
      setSell(nextSell);
    } catch {
      setSell(normalizedCost);
    }
  };

  const applySelfStoneSellFromCost = (nextCost: number, margin: number, setSell: (value: number) => void) => {
    const normalizedCost = Number(nextCost);
    const normalizedMargin = Number(margin);
    if (!Number.isFinite(normalizedCost) || normalizedCost < 0) return;
    const safeMargin = Number.isFinite(normalizedMargin) ? normalizedMargin : 0;
    setSell(Math.max(roundUpDisplayHundred(normalizedCost + safeMargin), 0));
  };

  const applyStoneSellBySource = async (
    source: CatalogStoneSource,
    nextCost: number,
    margin: number,
    setSell: (value: number) => void
  ) => {
    if (source === "SELF") {
      applySelfStoneSellFromCost(nextCost, margin, setSell);
      return;
    }
    await applyGlobalLaborSellFromCost("STONE", nextCost, setSell);
  };

  useEffect(() => {
    if (centerStoneSourceDefault === "SELF") {
      applySelfStoneSellFromCost(laborCenterCost, centerSelfMargin, setLaborCenterSell);
    }
  }, [centerSelfMargin, centerStoneSourceDefault, laborCenterCost]);

  useEffect(() => {
    if (centerStoneSourceDefault !== "SELF") {
      void applyGlobalLaborSellFromCost("STONE", laborCenterCost, setLaborCenterSell);
    }
  }, [centerStoneSourceDefault, laborCenterCost]);

  useEffect(() => {
    if (sub1StoneSourceDefault === "SELF") {
      applySelfStoneSellFromCost(laborSub1Cost, sub1SelfMargin, setLaborSub1Sell);
    }
  }, [laborSub1Cost, sub1SelfMargin, sub1StoneSourceDefault]);

  useEffect(() => {
    if (sub1StoneSourceDefault !== "SELF") {
      void applyGlobalLaborSellFromCost("STONE", laborSub1Cost, setLaborSub1Sell);
    }
  }, [laborSub1Cost, sub1StoneSourceDefault]);

  useEffect(() => {
    if (sub2StoneSourceDefault === "SELF") {
      applySelfStoneSellFromCost(laborSub2Cost, sub2SelfMargin, setLaborSub2Sell);
    }
  }, [laborSub2Cost, sub2SelfMargin, sub2StoneSourceDefault]);

  useEffect(() => {
    if (sub2StoneSourceDefault !== "SELF") {
      void applyGlobalLaborSellFromCost("STONE", laborSub2Cost, setLaborSub2Sell);
    }
  }, [laborSub2Cost, sub2StoneSourceDefault]);

  useEffect(() => {
    if (absorbBucket !== "ETC" && absorbLaborClass !== "GENERAL") {
      setAbsorbLaborClass("GENERAL");
    }
  }, [absorbBucket, absorbLaborClass]);

  const resetAbsorbForm = () => {
    setEditingAbsorbItemId(null);
    setAbsorbBucket("BASE_LABOR");
    setAbsorbLaborClass("GENERAL");
    setAbsorbStoneRole("CENTER");
    setAbsorbReason("");
    setAbsorbAmount("0");
    setAbsorbMaterialQtyPerUnit("1");
    setAbsorbMaterialCostKrw("0");
    setAbsorbIsPerPiece(true);
    setAbsorbVendorId("");
    setAbsorbIsActive(true);
  };

  const handleSaveAbsorbLaborItem = async () => {
    const targetMasterId = masterId.trim();
    if (!targetMasterId) {
      toast.error("처리 실패", { description: "먼저 마스터를 저장해 주세요." });
      return;
    }
    const amount = Number(absorbAmount);
    const materialQtyPerUnit = Number(absorbMaterialQtyPerUnit);
    const materialCostKrw = Number(absorbMaterialCostKrw);
    if (!absorbReason.trim()) {
      toast.error("처리 실패", { description: "사유를 입력해 주세요." });
      return;
    }
    if (!Number.isFinite(amount)) {
      toast.error("처리 실패", { description: "금액은 숫자여야 합니다." });
      return;
    }
    if (absorbLaborClass === "MATERIAL" && (!Number.isFinite(materialQtyPerUnit) || materialQtyPerUnit <= 0)) {
      toast.error("처리 실패", { description: "소재 개수는 0보다 커야 합니다." });
      return;
    }
    if (absorbLaborClass === "MATERIAL" && (!Number.isFinite(materialCostKrw) || materialCostKrw < 0)) {
      toast.error("처리 실패", { description: "소재 원가는 0 이상 숫자여야 합니다." });
      return;
    }

    try {
      const response = await fetch("/api/master-absorb-labor-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          absorb_item_id: editingAbsorbItemId,
          master_id: targetMasterId,
          bucket: absorbBucket,
          labor_class: absorbLaborClass,
          note: buildAbsorbNote(absorbBucket, absorbStoneRole),
          reason: absorbReason.trim(),
          amount_krw: amount,
          material_qty_per_unit: absorbLaborClass === "MATERIAL" ? materialQtyPerUnit : 1,
          material_cost_krw: absorbLaborClass === "MATERIAL" ? materialCostKrw : 0,
          is_per_piece: absorbIsPerPiece,
          vendor_party_id: absorbVendorId || null,
          is_active: absorbIsActive,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "흡수공임 저장 실패");
      absorbLaborCacheRef.current.delete(targetMasterId);
      await loadAbsorbLaborItems(targetMasterId, { forceRefresh: true });
      resetAbsorbForm();
      toast.success("흡수공임 저장 완료");
    } catch (error) {
      const message = error instanceof Error ? error.message : "흡수공임 저장 실패";
      toast.error("처리 실패", { description: message });
    }
  };

  const handleDeleteAbsorbLaborItem = async (absorbItemId: string) => {
    const targetMasterId = masterId.trim();
    try {
      const response = await fetch(`/api/master-absorb-labor-items?absorb_item_id=${encodeURIComponent(absorbItemId)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "흡수공임 삭제 실패");
      if (targetMasterId) {
        absorbLaborCacheRef.current.delete(targetMasterId);
        await loadAbsorbLaborItems(targetMasterId, { forceRefresh: true });
      }
      toast.success("흡수공임 삭제 완료");
    } catch (error) {
      const message = error instanceof Error ? error.message : "흡수공임 삭제 실패";
      toast.error("처리 실패", { description: message });
    }
  };

  const handleEditAbsorbLaborItem = (item: MasterAbsorbLaborItem) => {
    setEditingAbsorbItemId(item.absorb_item_id);
    setAbsorbBucket(item.bucket);
    setAbsorbLaborClass(normalizeAbsorbLaborClass(item.labor_class));
    setAbsorbStoneRole(parseAbsorbStoneRole(item.note) ?? "CENTER");
    setAbsorbReason(item.reason);
    setAbsorbAmount(String(item.amount_krw));
    setAbsorbMaterialQtyPerUnit(String(Math.max(Number(item.material_qty_per_unit ?? 1), 0)));
    setAbsorbMaterialCostKrw(String(Math.max(Number(item.material_cost_krw ?? 0), 0)));
    setAbsorbIsPerPiece(Boolean(item.is_per_piece));
    setAbsorbVendorId(item.vendor_party_id ?? "");
    setAbsorbIsActive(Boolean(item.is_active));
  };

  const handleDeleteMaster = async () => {
    const targetMasterId = masterId.trim();
    if (!targetMasterId) {
      toast.error("처리 실패", { description: "삭제 대상 마스터 ID가 없습니다." });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/master-item?id=${encodeURIComponent(targetMasterId)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "삭제에 실패했습니다.");
      }

      toast.success("마스터 삭제 완료");
      setDeleteConfirmOpen(false);
      setRegisterOpen(false);
      setIsEditMode(false);
      void fetchCatalogItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제에 실패했습니다.";
      toast.error("처리 실패", { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDetailDrawer = (id: string) => {
    prefetchMasterDetailFastPath(id);
    setSelectedItemId(id);
    setIsDetailDrawerOpen(true);
  };

  const closeDetailDrawer = () => {
    setIsDetailDrawerOpen(false);
  };

  const openBomDrawer = () => {
    setShowBomPanel(true);
  };

  const closeBomDrawer = () => {
    setShowBomPanel(false);
  };

  const openAbsorbDrawer = () => {
    setShowAbsorbPanel(true);
  };

  const closeAbsorbDrawer = () => {
    setShowAbsorbPanel(false);
  };

  useEffect(() => {
    if (view !== "gallery") setIsDetailDrawerOpen(false);
  }, [view]);

  useEffect(() => {
    if (isDetailDrawerOpen && !selectedItemId) setIsDetailDrawerOpen(false);
  }, [isDetailDrawerOpen, selectedItemId]);


  const renderRegisterDrawer = () => (
    <Sheet
      open={registerOpen}
      onClose={() => {
        setRegisterOpen(false);
        setIsSaving(false);
        setUploadError(null);
        setUploadingImage(false);
      }}
      title={isEditMode ? "마스터 수정" : "새 상품 등록"}
      className="w-full sm:w-[96vw] lg:w-[92vw] 2xl:w-[1500px] sm:max-w-none"
    >
      <div className="h-full overflow-y-auto p-6 scrollbar-hide">
        <div
          className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)] 2xl:grid-cols-[320px,minmax(0,1fr)]"
          // ✅ [유지] 내부 내용물을 더블클릭했을 때는 닫히지 않도록 이벤트 전파를 막습니다.
          onDoubleClickCapture={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation?.();
          }}
        >
          {/* 1. 좌측 이미지 업로드 영역 */}
          <div className="space-y-4">
            <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--foreground)]">
                <span>대표 이미지</span>
                {uploadingImage ? (
                  <span className="text-xs text-[var(--muted)]">
                    업로드 중...
                  </span>
                ) : null}
              </div>
              <label className="group relative flex h-56 w-56 mx-auto cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel)] text-center">
                <input
                  type="file"
                    accept="image/*,.heic,.heif"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="업로드 이미지"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="space-y-2 px-6">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      이미지 업로드
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      JPG, PNG 파일을 드래그하거나 클릭해서 추가하세요.
                    </div>
                    <div className="text-[11px] text-[var(--muted-weak)]">
                      권장 비율 1:1 · 최대 10MB
                    </div>
                  </div>
                )}
              </label>
              {uploadError ? (
                <p className="mt-2 text-xs text-red-500">{uploadError}</p>
              ) : null}
              {imageUrl ? (
                <div className="mt-3 flex justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    변경
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={handleImageRemove}
                  >
                    삭제
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {/* 2. 우측 폼 영역 */}
          <form
            className="flex min-w-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="pr-2">
              <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,360px)]">
                {/* 2-1. 좌측 열: 기본 정보 및 비고 */}
                <div className="flex min-w-0 flex-col gap-4 h-full">
                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          기본 정보
                        </p>
                        <label className="inline-flex items-center gap-2 text-xs text-[var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={isUnitPricing}
                            onChange={handleToggleUnitPricing}
                            disabled={!canToggleUnitPricing || setMasterUnitPricingMutation.isPending}
                            title={unitPricingDisabledReason || undefined}
                            className="h-4 w-4"
                          />
                          <span>단가제</span>
                        </label>
                      </div>
                      <span className="text-xs text-[var(--muted)]">자동올림</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="모델명">
                        <Input
                          placeholder="모델명*"
                          value={modelName}
                          onChange={(event) => setModelName(event.target.value)}
                          onBlur={() => {
                            const derived =
                              deriveCategoryCodeFromModelName(modelName);
                            if (derived) {
                              setCategoryCode(derived);
                            }
                            applyVendorFromModelName(modelName);
                          }}
                        />
                      </Field>
                      <Field label="공급처">
                        <Select
                          value={vendorId}
                          onChange={(event) => setVendorId(event.target.value)}
                        >
                          <option value="">공급처 선택</option>
                          {vendorOptions.map((vendor) => (
                            <option key={vendor.value} value={vendor.value}>
                              {vendor.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="기본 재질">
                        <Select
                          value={materialCode}
                          onChange={(event) =>
                            setMaterialCode(event.target.value)
                          }
                        >
                          <option value="">기본 재질 선택</option>
                          {materialOptions.map((material) => (
                            <option key={material.value} value={material.value}>
                              {material.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="카테고리">
                        <Select
                          value={categoryCode}
                          onChange={(event) => {
                            setCategoryCode(event.target.value);
                          }}
                        >
                          <option value="">카테고리 선택*</option>
                          {categoryOptions.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="기본 중량 (g)">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="중량"
                          value={weightDefault}
                          onChange={(event) =>
                            setWeightDefault(event.target.value)
                          }
                          disabled={masterKind === "BUNDLE"}
                        />
                      </Field>
                      <Field label="차감 중량 (g)">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="차감 중량"
                          value={deductionWeight}
                          onChange={(event) =>
                            setDeductionWeight(event.target.value)
                          }
                          disabled={masterKind === "BUNDLE"}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 flex flex-col space-y-3">
                    <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                      비고
                    </p>
                    <Textarea
                      placeholder="상품에 대한 상세 정보를 입력하세요."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="resize-none h-[11rem]"
                    />

                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[var(--foreground)]">RAW원가 분석</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 px-2 text-[11px]"
                            onClick={addCnRawEntry}
                          >
                            + 행추가
                          </Button>
                          <div className="text-[11px] text-[var(--muted)]">총중량 {formatWeightNumber(netWeightG)} g</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="grid grid-cols-[116px_68px_68px_76px_72px_auto] items-center gap-1 text-[10px] text-[var(--muted)] px-1">
                          <div>날짜</div>
                          <div className="text-right">총(CNY)</div>
                          <div className="text-right">은(CNY/g)</div>
                          <div>공임기준</div>
                          <div className="text-right">공임</div>
                          <div className="text-right">추가/삭제</div>
                        </div>
                        {cnRawEntriesSorted.map((rawEntry, idx) => {
                          const entry = cnRawEntriesComputed[idx];
                          if (!entry) return null;
                          return (
                            <div
                              key={entry.id}
                              className="space-y-0.5"
                              onBlurCapture={(event) => {
                                const next = event.relatedTarget as Node | null;
                                if (next && event.currentTarget.contains(next)) return;
                                if (!isEditMode) return;
                                const targetMasterId = selectedItemId || masterId;
                                if (!targetMasterId) return;
                                void saveCnCostPayload(targetMasterId, { silent: true });
                              }}
                            >
                              <div className="grid grid-cols-[116px_68px_68px_76px_72px_auto] items-center gap-1">
                                <Input
                                  type="date"
                                  value={rawEntry.analysisDate}
                                  onChange={(event) => changeCnRawEntry(entry.id, { analysisDate: event.target.value })}
                                  className="h-8 px-2 text-[11px]"
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={rawEntry.totalPriceCny}
                                  onChange={(event) => changeCnRawEntry(entry.id, { totalPriceCny: event.target.value })}
                                  className="h-8 px-2 text-[11px] text-right"
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={rawEntry.silverPriceCny}
                                  onChange={(event) => changeCnRawEntry(entry.id, { silverPriceCny: event.target.value })}
                                  className="h-8 px-2 text-[11px] text-right"
                                />
                                <Select
                                  value={rawEntry.laborBasis}
                                  onChange={(event) => changeCnRawEntry(entry.id, { laborBasis: normalizeCnRawLaborBasis(event.target.value) })}
                                  className="h-8 px-1 text-[11px]"
                                >
                                  <option value="PER_G">g당</option>
                                  <option value="PER_PIECE">개당</option>
                                </Select>
                                <Input
                                  readOnly
                                  value={formatDisplayCny(entry.laborCny)}
                                  className="h-8 px-2 text-[11px] text-right"
                                />
                                <div className="flex items-center justify-end gap-1">
                                  {idx === cnRawEntriesSorted.length - 1 ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={addCnRawEntry}
                                    >
                                      +
                                    </Button>
                                  ) : null}
                                  {cnRawEntriesSorted.length > 1 ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px] text-[var(--danger)]"
                                    onClick={() => {
                                      removeCnRawEntry(entry.id);
                                      if (!isEditMode) return;
                                      const targetMasterId = selectedItemId || masterId;
                                      if (!targetMasterId) return;
                                      window.setTimeout(() => {
                                        void saveCnCostPayload(targetMasterId, { silent: true });
                                      }, 0);
                                    }}
                                  >
                                    삭제
                                  </Button>
                                ) : null}
                                </div>
                              </div>
                              <div className="pl-1 text-[10px] text-[var(--muted)] tabular-nums overflow-x-auto whitespace-nowrap">
                                {`<${toCompactYyMmDd(entry.analysisDate) || "-"}>총${formatDisplayCny(entry.totalPriceCny)} /은:${formatDisplayCny(entry.silverPriceCny)} /공임 ${formatDisplayCny(entry.laborCny)}${entry.laborBasis === "PER_G" ? "/g" : "/ea"}(`}
                                <span className="font-semibold text-blue-600">{`원가${formatDisplayKrw(entry.totalCostKrw)}원`}</span>
                                {`) | KRW 총: ₩${formatDisplayKrw(entry.totalPriceCny * cnyAdRate)} | 은: ₩${formatDisplayKrw(entry.silverPriceKrwPerG)}/g | 공임: ₩${formatDisplayKrw(entry.laborKrw)}${entry.laborBasis === "PER_G" ? "/g" : "/ea"}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-2. 우측 열: 공임 및 프로파일 설정 */}
                <div className="space-y-4 min-w-0">
                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        공임 및 구성
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setShowAdvancedPricing((prev) => !prev)}
                        >
                          {showAdvancedPricing ? "고급 닫기" : "고급"}
                        </Button>
                        <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded">
                          좌:판매
                        </span>
                        <span className="text-[10px] bg-[var(--muted)]/10 text-[var(--muted)] px-2 py-0.5 rounded">
                          우:원가
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[0.8fr_1fr_0.6fr_1fr] gap-x-2 gap-y-3 items-center text-xs">
                      <div className="text-center font-semibold text-[var(--muted)]">
                        항목
                      </div>
                      <div className="text-center font-semibold text-[var(--muted)]">
                        판매 (Sell)
                      </div>
                      <div className="text-center font-semibold text-[var(--muted)]">
                        수량 (Qty)
                      </div>
                      <div className="text-center font-semibold text-[var(--muted)]">원가 (Cost)</div>

                      {/* Base */}
                      <div className="text-center font-medium text-[var(--foreground)] bg-lime-50 rounded-[var(--radius)] py-2">
                        기본
                      </div>
                      <div className="relative">
                        {absorbImpactSummary.baseLaborUnit !== 0 ? (
                          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500" title="흡수공임 반영" />
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          value={laborBaseSellWithAccessoryForEdit}
                          readOnly
                          disabled
                          className="bg-lime-50"
                        />
                      </div>
                      <div className="text-center text-[var(--muted)] bg-lime-50 rounded-[var(--radius)] py-2">-</div>
                      <Input
                        type="number"
                        min={0}
                        value={laborBaseCostWithAccessoryForEdit}
                        onChange={(e) => setLaborBaseCost(toNumber(e.target.value))}
                        onBlur={() => {
                          void applyGlobalLaborSellFromCost("BASE_LABOR", laborBaseCost, setLaborBaseSell);
                        }}
                        className="bg-lime-50"
                      />

                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Center */}
                      <div className="col-span-4 grid grid-cols-[minmax(0,1.8fr)_minmax(84px,0.6fr)_minmax(0,1fr)] gap-2">
                        <Input
                          className={cn(isCenterQtyZero && "bg-[var(--subtle-bg)]", "text-center")}
                          placeholder="센터석 이름"
                          value={centerStoneName}
                          onChange={(e) => setCenterStoneName(e.target.value)}
                          disabled={masterKind === "BUNDLE"}
                        />
                        <Select
                          value={centerStoneSourceDefault}
                          onChange={(e) => {
                            const next = e.target.value as CatalogStoneSource;
                            setCenterStoneSourceDefault(next);
                            if (next !== "SELF") {
                              setCenterSelfMargin(0);
                              void applyGlobalLaborSellFromCost("STONE", laborCenterCost, setLaborCenterSell);
                            }
                          }}
                          className={cn(isCenterQtyZero && "bg-[var(--subtle-bg)]")}
                        >
                          {stoneSourceOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        {centerStoneSourceDefault === "SELF" ? (
                          <Input type="number" value={centerSelfMargin} onChange={(e) => setCenterSelfMargin(toNumber(e.target.value))} className={cn(isCenterQtyZero && "bg-[var(--subtle-bg)]")} />
                        ) : (
                          <Input value="자입" readOnly className={cn(isCenterQtyZero && "bg-[var(--subtle-bg)]", "text-[var(--muted)] text-center")} />
                        )}
                      </div>
                      <div className="text-center font-medium text-[var(--foreground)] bg-green-50 rounded-[var(--radius)] py-2">
                        센터
                      </div>
                      <div className="relative">
                        {absorbImpactSummary.stoneCenterUnit !== 0 ? (
                          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500" title="흡수공임 반영" />
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          value={laborCenterSellWithAbsorb}
                          readOnly
                          disabled
                          className="bg-green-50"
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-green-50"
                        value={centerQty}
                        onChange={(e) => setCenterQty(toNumber(e.target.value))}
                        disabled={masterKind === "BUNDLE"}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborCenterCost}
                        onChange={(e) => setLaborCenterCost(toNumber(e.target.value))}
                        onBlur={() => {
                          void applyStoneSellBySource(centerStoneSourceDefault, laborCenterCost, centerSelfMargin, setLaborCenterSell);
                        }}
                        className="bg-green-50"
                      />
                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Sub1 */}
                      <div className="col-span-4 grid grid-cols-[minmax(0,1.8fr)_minmax(84px,0.6fr)_minmax(0,1fr)] gap-2">
                        <Input
                          className={cn(isSub1QtyZero && "bg-[var(--subtle-bg)]", "text-center")}
                          placeholder="서브1석 이름"
                          value={sub1StoneName}
                          onChange={(e) => setSub1StoneName(e.target.value)}
                          disabled={masterKind === "BUNDLE"}
                        />
                        <Select
                          value={sub1StoneSourceDefault}
                          onChange={(e) => {
                            const next = e.target.value as CatalogStoneSource;
                            setSub1StoneSourceDefault(next);
                            if (next !== "SELF") {
                              setSub1SelfMargin(0);
                              void applyGlobalLaborSellFromCost("STONE", laborSub1Cost, setLaborSub1Sell);
                            }
                          }}
                          className={cn(isSub1QtyZero && "bg-[var(--subtle-bg)]")}
                        >
                          {stoneSourceOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        {sub1StoneSourceDefault === "SELF" ? (
                          <Input type="number" value={sub1SelfMargin} onChange={(e) => setSub1SelfMargin(toNumber(e.target.value))} className={cn(isSub1QtyZero && "bg-[var(--subtle-bg)]")} />
                        ) : (
                          <Input value="자입" readOnly className={cn(isSub1QtyZero && "bg-[var(--subtle-bg)]", "text-[var(--muted)] text-center")} />
                        )}
                      </div>
                      <div className="text-center font-medium text-[var(--foreground)] bg-green-50 rounded-[var(--radius)] py-2">
                        서브1
                      </div>
                      <div className="relative">
                        {absorbImpactSummary.stoneSub1Unit !== 0 ? (
                          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500" title="흡수공임 반영" />
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          value={laborSub1SellWithAbsorb}
                          readOnly
                          disabled
                          className="bg-green-50"
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-green-50"
                        value={sub1Qty}
                        onChange={(e) => setSub1Qty(toNumber(e.target.value))}
                        disabled={masterKind === "BUNDLE"}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborSub1Cost}
                        onChange={(e) => setLaborSub1Cost(toNumber(e.target.value))}
                        onBlur={() => {
                          void applyStoneSellBySource(sub1StoneSourceDefault, laborSub1Cost, sub1SelfMargin, setLaborSub1Sell);
                        }}
                        className="bg-green-50"
                      />
                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Sub2 */}
                      <div className="col-span-4 grid grid-cols-[minmax(0,1.8fr)_minmax(84px,0.6fr)_minmax(0,1fr)] gap-2">
                        <Input
                          className={cn(isSub2QtyZero && "bg-[var(--subtle-bg)]", "text-center")}
                          placeholder="서브2석 이름"
                          value={sub2StoneName}
                          onChange={(e) => setSub2StoneName(e.target.value)}
                          disabled={masterKind === "BUNDLE"}
                        />
                        <Select
                          value={sub2StoneSourceDefault}
                          onChange={(e) => {
                            const next = e.target.value as CatalogStoneSource;
                            setSub2StoneSourceDefault(next);
                            if (next !== "SELF") {
                              setSub2SelfMargin(0);
                              void applyGlobalLaborSellFromCost("STONE", laborSub2Cost, setLaborSub2Sell);
                            }
                          }}
                          className={cn(isSub2QtyZero && "bg-[var(--subtle-bg)]")}
                        >
                          {stoneSourceOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        {sub2StoneSourceDefault === "SELF" ? (
                          <Input type="number" value={sub2SelfMargin} onChange={(e) => setSub2SelfMargin(toNumber(e.target.value))} className={cn(isSub2QtyZero && "bg-[var(--subtle-bg)]")} />
                        ) : (
                          <Input value="자입" readOnly className={cn(isSub2QtyZero && "bg-[var(--subtle-bg)]", "text-[var(--muted)] text-center")} />
                        )}
                      </div>
                      <div className="text-center font-medium text-[var(--foreground)] bg-green-50 rounded-[var(--radius)] py-2">
                        서브2
                      </div>
                      <div className="relative">
                        {absorbImpactSummary.stoneSub2Unit !== 0 ? (
                          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500" title="흡수공임 반영" />
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          value={laborSub2SellWithAbsorb}
                          readOnly
                          disabled
                          className="bg-green-50"
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-green-50"
                        value={sub2Qty}
                        onChange={(e) => setSub2Qty(toNumber(e.target.value))}
                        disabled={masterKind === "BUNDLE"}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborSub2Cost}
                        onChange={(e) => setLaborSub2Cost(toNumber(e.target.value))}
                        onBlur={() => {
                          void applyStoneSellBySource(sub2StoneSourceDefault, laborSub2Cost, sub2SelfMargin, setLaborSub2Sell);
                        }}
                        className="bg-green-50"
                      />

                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)] my-2" />

                      {/* Plating */}
                      <div className="text-center font-medium text-[var(--muted)] bg-[var(--subtle-bg)] rounded-[var(--radius)] py-2">
                        도금
                      </div>
                      <div className="relative">
                        {absorbImpactSummary.platingUnit !== 0 ? (
                          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500" title="흡수공임 반영" />
                        ) : null}
                        <Input
                          type="number"
                          min={0}
                          value={platingSellWithAbsorb}
                          className="bg-[var(--subtle-bg)]"
                          readOnly
                          disabled
                        />
                      </div>
                      <div className="text-center text-[var(--muted)]">-</div>
                      <Input
                        type="number"
                        min={0}
                        value={platingCost}
                        className="bg-[var(--subtle-bg)]"
                        onChange={(e) => setPlatingCost(toNumber(e.target.value))}
                        onBlur={(e) => {
                          const nextCost = toNumber(e.target.value);
                          void applyGlobalPlatingSellFromCost(nextCost, setPlatingSell);
                        }}
                      />

                      {showAdvancedPricing ? (
                        <>
                          <div className="text-center font-medium text-[var(--muted)] bg-[var(--subtle-bg)] rounded-[var(--radius)] py-2">
                            세팅 부가마진(개당)
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={settingAddonMarginKrwPerPiece}
                            className="bg-[var(--subtle-bg)]"
                            onChange={(e) =>
                              setSettingAddonMarginKrwPerPiece(toNumber(e.target.value))
                            }
                          />
                          <div className="text-center text-[var(--muted)]">-</div>
                          <div className="text-center text-[var(--muted)]">룰 외 추가</div>

                          <div className="text-center font-medium text-[var(--muted)] bg-[var(--subtle-bg)] rounded-[var(--radius)] py-2">
                            원석 부가마진(개당)
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={stoneAddonMarginKrwPerPiece}
                            className="bg-[var(--subtle-bg)]"
                            onChange={(e) =>
                              setStoneAddonMarginKrwPerPiece(toNumber(e.target.value))
                            }
                          />
                          <div className="text-center text-[var(--muted)]">-</div>
                          <div className="text-center text-[var(--muted)]">룰 외 추가</div>
                        </>
                      ) : null}

                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)] my-2" />

                      {/* Total */}
                      <div className="text-center font-bold text-[var(--foreground)]">
                        합계공임
                      </div>
                      <Input
                        type="number"
                        min={0}
                        readOnly
                        autoFormat={false}
                        className="text-right font-bold bg-[var(--input-bg)] text-[var(--primary)] border-[var(--panel-border)]"
                        value={totalLaborSellWithAccessoryForEdit}
                      />
                      <div className="text-center text-[var(--muted)]">-</div>
                      <Input
                        type="number"
                        min={0}
                        readOnly
                        autoFormat={false}
                        className="text-right font-bold bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--panel-border)]"
                        value={totalLaborCostWithAccessoryForEdit}
                      />

                      {decorLaborRows.rows.length > 0 ? (
                        <>
                          <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)] my-2" />
                          <div className="col-span-4 rounded-[10px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-2">
                            <div className="mb-2 text-[11px] font-semibold text-[var(--foreground)]">장식n (마스터 고정)</div>
                            <table className="w-full text-[11px]">
                              <thead className="text-[var(--muted)]">
                                <tr>
                                  <th className="px-2 py-1 text-left">항목</th>
                                  <th className="px-2 py-1 text-right">총공임(판매)</th>
                                  <th className="px-2 py-1 text-right">개수</th>
                                  <th className="px-2 py-1 text-right">총공임(원가)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {decorLaborRows.rows.map((row) => (
                                  <tr key={row.id} className="border-t border-[var(--panel-border)]">
                                    <td className="px-2 py-1">{row.label}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">₩{formatDisplayKrw(row.sellTotal)}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">{row.qty.toLocaleString("ko-KR")}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">₩{formatDisplayKrw(row.costTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                </div>

                {/* 2-3. 중국 원가 계산 */}
                <div className="space-y-4 min-w-0 2xl:sticky 2xl:top-4">
                  {showChinaCostPanel ? (
                    <ChinaCostPanel
                      csOriginalKrwPerG={csOriginalKrwPerG}
                      cnyKrwPer1={cnyAdRate}
                      onRefreshMarket={refreshMarketTicks}
                      netWeightG={netWeightG}
                      basicCnyPerG={cnLaborBasicCnyPerG}
                      basicBasis={cnLaborBasicBasis}
                      extraItems={cnLaborExtraItems}
                      onChangeBasic={setCnLaborBasicCnyPerG}
                      onChangeBasicBasis={setCnLaborBasicBasis}
                      onAddExtra={addCnExtraItem}
                      onChangeExtra={changeCnExtraItem}
                      onRemoveExtra={removeCnExtraItem}
                    />
                  ) : null}

                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        흡수공임
                        <span className="ml-2 text-xs text-[var(--muted)]">{masterId.trim() ? `${visibleAbsorbLaborItems.length}건` : "저장 후 등록 가능"}</span>
                      </div>
                      <Button type="button" variant="secondary" onClick={openAbsorbDrawer} disabled={!masterId.trim()}>
                        흡수공임 추가
                      </Button>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded border border-[var(--panel-border)] bg-[var(--panel)]">
                      <table className="w-full min-w-[280px] text-xs">
                        <thead className="text-[var(--muted)]">
                          <tr>
                            <th className="px-3 py-2 text-left">버킷</th>
                            <th className="px-3 py-2 text-left">개당 공임</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAbsorbLaborItems.length === 0 ? (
                            <tr className="border-t border-[var(--panel-border)]">
                              <td className="px-3 py-3 text-[var(--muted)]" colSpan={2}>등록된 흡수공임이 없습니다.</td>
                            </tr>
                          ) : (
                            visibleAbsorbLaborItems.map((item) => (
                              <tr key={item.absorb_item_id} className="border-t border-[var(--panel-border)]">
                                <td className={cn("px-3 py-2", getAbsorbBucketToneClass(item.bucket))}>{getAbsorbBucketDisplayLabel(item)}</td>
                                <td className={cn("px-3 py-2", getAbsorbBucketToneClass(item.bucket))}>₩{formatDisplayKrw(item.amount_krw)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--panel-border)] bg-[var(--panel)] pt-4">
              {isEditMode ? (
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isSaving || isDeleting}
                >
                  삭제
                </Button>
              ) : null}
              <Button
                variant="secondary"
                type="button"
                onClick={() => setRegisterOpen(false)}
                disabled={isDeleting}
              >
                취소
              </Button>
              <Button type="submit" disabled={!canSave || isSaving || isDeleting}>
                저장
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Sheet>
  );

  const renderImageOverlay = () => (
    previewImage && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
        onClick={() => setPreviewImage(null)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}
          className="absolute right-6 top-6 z-[101] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel)]/20 text-white hover:bg-[var(--panel)]/30 transition-colors"
        >
          <X size={32} />
        </button>
        <img
          src={previewImage}
          alt="원본 확대"
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
        />
      </div>
    )
  );

  const renderFilterBar = () => (
    <div className="grid grid-cols-12 gap-2 mb-4" id="catalog.filterBar">
      <Select
        className="col-span-12 md:col-span-2"
        value={filterMaterial}
        onChange={(e) => {
          setFilterMaterial(e.target.value);
          setPage(1); // 필터 변경 시 1페이지로 이동
        }}
      >
        <option value="">재질 전체</option>
        {materialOptions.map((material) => (
          <option key={material.value} value={material.value}>
            {material.label}
          </option>
        ))}
      </Select>

      <Select
        className="col-span-12 md:col-span-2"
        value={filterCategory}
        onChange={(e) => {
          setFilterCategory(e.target.value);
          setPage(1);
        }}
      >
        <option value="">전체 카테고리</option>
        {categoryOptions.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </Select>

      <Input
        placeholder="모델명, 태그 검색"
        className="col-span-12 md:col-span-6"
        value={filterQuery}
        onChange={(e) => {
          setFilterQuery(e.target.value);
          setPage(1);
        }}
      />

      <Button
        type="button"
        variant="secondary"
        className={cn(
          "col-span-12 md:col-span-2",
          includeAccessory && "border-[var(--primary)] text-[var(--primary)]"
        )}
        onClick={() => {
          setIncludeAccessory((prev) => !prev);
          setPage(1);
        }}
      >
        부속 포함 {includeAccessory ? "ON" : "OFF"}
      </Button>
    </div>
  );

  const renderDetailPanel = () => (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 items-start",
        "2xl:[grid-template-columns:minmax(600px,1fr)_minmax(380px,480px)]"
      )}
    >
      {/* [왼쪽 기둥] 상세 정보 패널 */}
      <div className="min-w-0 flex flex-col gap-3">

        {/* A. 이미지 및 가격 통계 행 */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          {selectedItem?.imageUrl && (
            <div
              className="h-[300px] w-full xl:w-[300px] shrink-0 overflow-hidden rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] cursor-pointer"
              onDoubleClick={() =>
                setPreviewImage(selectedItem.imageUrl ?? null)
              }
            >
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.model}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2 text-center">{selectedVendorName || "-"}</div>
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2 text-center">{selectedMaterialLabel}</div>
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2 text-center">{selectedCategoryLabel}</div>
            </div>
            <div className="rounded-[8px] border border-[var(--panel-border)] bg-blue-50 px-3 py-2 text-sm font-semibold text-[var(--foreground)] text-center">
              {(() => {
                const weight = parseFloat(String(selectedDetail?.weight ?? ""));
                const deduction = parseFloat(String(selectedDetail?.deductionWeight ?? ""));
                if (!Number.isFinite(weight)) return "총중량 -";
                const safeDeduction = Number.isFinite(deduction) ? deduction : 0;
                const netWeightText = formatWeightNumber(weight - safeDeduction);
                const [intPart, decimalPart] = netWeightText.split(".");
                return (
                  <>
                    총중량 {intPart}
                    {decimalPart ? <><span className="decimal-point-emphasis">.</span>{decimalPart}</> : null} g
                  </>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-3 py-2 text-center">
                {(() => {
                  const weight = parseFloat(String(selectedDetail?.weight ?? ""));
                  if (!Number.isFinite(weight)) return <>중량 -</>;
                  const weightText = formatWeightNumber(weight);
                  const [intPart, decimalPart] = weightText.split(".");
                  return (
                    <>
                      중량 {intPart}
                      {decimalPart ? <><span className="decimal-point-emphasis">.</span>{decimalPart}</> : null} g
                    </>
                  );
                })()}
              </div>
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-3 py-2 text-center">
                차감중량 {selectedDetail?.deductionWeight ? `${selectedDetail.deductionWeight} g` : "-"}
              </div>
            </div>
            <div className="mt-auto rounded-[8px] border border-[var(--panel-border)] bg-blue-50 px-3 py-2 text-sm font-semibold leading-snug whitespace-normal break-words text-[var(--foreground)]">
              {selectedItem?.model ?? "-"}
            </div>
          </div>
        </div>

        {/* B. 상세 정보 카드 */}
        <Card id="catalog.detail.merged">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="shrink-0 whitespace-nowrap text-lg font-bold text-[var(--foreground)]">
                  상세
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenEdit}
                  disabled={!selectedItem}
                  className="border-amber-600 bg-amber-500 text-white hover:bg-amber-600"
                >
                  마스터 수정
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openBomDrawer}
                  disabled={!selectedItem}
                  className={cn(
                    "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200",
                    showBomPanel && "border-amber-500 bg-amber-200 text-amber-950"
                  )}
                >
                  부속
                </Button>
                <div className="grid grid-cols-[auto_auto] items-center gap-2 rounded-[8px] border-2 border-red-400 bg-white px-3 py-1.5">
                  <div className="text-xs text-[var(--muted)]">총중량</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {(() => {
                      const weight = parseFloat(String(selectedDetail?.weight ?? ""));
                      const deduction = parseFloat(String(selectedDetail?.deductionWeight ?? ""));
                      if (!Number.isFinite(weight)) return "-";
                      const safeDeduction = Number.isFinite(deduction) ? deduction : 0;
                      const netWeightText = formatWeightNumber(weight - safeDeduction);
                      const [intPart, decimalPart] = netWeightText.split(".");
                      return (
                        <>
                          {intPart}
                          {decimalPart ? <><span className="decimal-point-emphasis">.</span>{decimalPart}</> : null} g
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-[auto_auto] items-center gap-2 rounded-[8px] border-2 border-[var(--primary)] bg-[var(--panel)] px-3 py-1.5">
                  <div className="text-xs text-[var(--muted)]">총금액(판매)</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    <NumberText value={totalEstimatedSell} /> 원
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <div className="mb-2 grid grid-cols-10 gap-2 text-xs font-semibold text-[var(--muted)]">
                <div className="col-span-2 text-center">항목</div>
                <div className="col-span-3 text-center">총공임 (판매)</div>
                <div className="col-span-2 text-center">수량</div>
                <div className="col-span-3 text-center">마진(참고)</div>
              </div>
              <div className="space-y-2">
                {/* 합계공임 */}
                <div className="grid grid-cols-10 gap-2">
                  <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-blue-50 px-2 py-2">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      총공임
                    </span>
                  </div>
                  <ReadonlyNumberCell value={detailLaborSellWithAccessory} valueClassName="text-base font-bold" className="bg-blue-50 border-2 border-green-500" />
                  <div className="col-span-2" />
                    <ReadonlyNumberCell
                      value={detailLaborMarginWithAccessory}
                      extraText={totalLaborMarginShare ? `(${totalLaborMarginShare})` : ""}
                      valueClassName="text-sm font-semibold"
                      className="bg-blue-50"
                    />
                </div>
                <div className="border-t border-[var(--panel-border)]/60" />
                {/* 기본공임 */}
                {showDetailBaseRow ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-lime-50 px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        기본공임
                      </span>
                    </div>
                    <ReadonlyNumberCell value={detailLaborBaseSellDisplay} className="bg-lime-50" />
                    <div className="col-span-2" />
                    <ReadonlyNumberCell
                      value={detailBaseLaborMargin}
                      extraText={detailBaseLaborMarginShare ? `(${detailBaseLaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-lime-50"
                    />
                  </div>
                ) : null}
                {/* 중심공임 */}
                {showDetailCenterRow ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-green-50 px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        중심공임
                      </span>
                    </div>
                    <ReadonlyNumberCell value={detailLaborCenterSellDisplay} className="bg-green-50" />
                    <Input
                      className="col-span-2 text-center bg-green-50"
                      placeholder="중심석"
                      value={Number(selectedDetail?.centerQty ?? 0) > 0 ? `${selectedDetail?.centerQty}개` : "-"}
                      readOnly
                    />
                    <ReadonlyNumberCell
                      value={detailCenterLaborMargin}
                      extraText={detailCenterLaborMarginShare ? `(${detailCenterLaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-green-50"
                    />
                  </div>
                ) : null}
                {/* 보조1공임 */}
                {showDetailSub1Row ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-green-50 px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        보조1공임
                      </span>
                    </div>
                    <ReadonlyNumberCell value={detailLaborSub1SellDisplay} className="bg-green-50" />
                    <Input
                      className="col-span-2 text-center bg-green-50"
                      placeholder="보조1석"
                      value={Number(selectedDetail?.sub1Qty ?? 0) > 0 ? `${selectedDetail?.sub1Qty}개` : "-"}
                      readOnly
                    />
                    <ReadonlyNumberCell
                      value={detailSub1LaborMargin}
                      extraText={detailSub1LaborMarginShare ? `(${detailSub1LaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-green-50"
                    />
                  </div>
                ) : null}
                {/* 보조2공임 */}
                {showDetailSub2Row ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-green-50 px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        보조2공임
                      </span>
                    </div>
                    <ReadonlyNumberCell value={detailLaborSub2SellDisplay} className="bg-green-50" />
                    <Input
                      className="col-span-2 text-center bg-green-50"
                      placeholder="보조2석"
                      value={Number(selectedDetail?.sub2Qty ?? 0) > 0 ? `${selectedDetail?.sub2Qty}개` : "-"}
                      readOnly
                    />
                    <ReadonlyNumberCell
                      value={detailSub2LaborMargin}
                      extraText={detailSub2LaborMarginShare ? `(${detailSub2LaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-green-50"
                    />
                  </div>
                ) : null}
                {/* 도금공임 */}
                {detailPlatingSellDisplay !== 0 || detailPlatingCostDisplay !== 0 ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">도금공임</span>
                    </div>
                    <ReadonlyNumberCell value={detailPlatingSellDisplay} className="bg-[var(--subtle-bg)]" />
                    <div className="col-span-2" />
                    <ReadonlyNumberCell
                      value={detailPlatingLaborMargin}
                      extraText={detailPlatingLaborMarginShare ? `(${detailPlatingLaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-[var(--subtle-bg)]"
                    />
                  </div>
                ) : null}
                {/* 기타공임 */}
                {showDetailEtcRow ? (
                  <div className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">기타공임</span>
                    </div>
                    <ReadonlyNumberCell value={detailEtcLaborSellDisplay} className="bg-[var(--subtle-bg)]" />
                    <div className="col-span-2" />
                    <ReadonlyNumberCell
                      value={detailEtcLaborMargin}
                      extraText={detailEtcLaborMarginShare ? `(${detailEtcLaborMarginShare})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-[var(--subtle-bg)]"
                    />
                  </div>
                ) : null}
                {detailDecorLaborRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-10 gap-2">
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">{row.label}</span>
                    </div>
                    <ReadonlyNumberCell value={row.sellTotal} className="bg-[var(--subtle-bg)]" />
                    <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-2 text-xs tabular-nums text-[var(--foreground)]">
                      {row.qty.toLocaleString("ko-KR")}
                    </div>
                    <ReadonlyNumberCell
                      value={row.marginTotal}
                      extraText={formatSharePercent(row.marginTotal, row.sellTotal) ? `(${formatSharePercent(row.marginTotal, row.sellTotal)})` : ""}
                      valueClassName="text-sm font-medium"
                      className="bg-[var(--subtle-bg)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* C. 추가 메모 카드 */}
        <Card id="catalog.detail.raw" className="-mt-2">
          <CardHeader>
            <ActionBar title="추가 메모" />
          </CardHeader>
          <CardBody className="py-3 space-y-3">
            <Textarea
              placeholder="내부 메모"
              value={selectedDetail?.note ?? ""}
              readOnly
            />
            <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">RAW원가 분석</div>
                <div className="text-[11px] text-[var(--muted)]">
                  총중량 {formatWeightNumber(detailRawNetWeight)} g
                </div>
              </div>
              {detailRawHistoryRows.length === 0 ? (
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--muted)]">기록 없음</div>
              ) : (
                <div className="space-y-1">
                  {detailRawHistoryRows.map((entry) => (
                    <div key={entry.id} className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1.5">
                      <div className="text-[10px] text-[var(--muted)] tabular-nums">
                        {`<${toCompactYyMmDd(entry.analysisDate) || "-"}>총${formatDisplayCny(entry.totalPriceCny)} /은:${formatDisplayCny(entry.silverPriceCny)} /공임 ${formatDisplayCny(entry.laborCny)}${entry.laborBasis === "PER_PIECE" ? "/ea" : "/g"}(`}
                        <span className="font-semibold text-blue-600">{`원가${formatDisplayKrw(entry.totalCostKrw)}원`}</span>
                        {`) | KRW 총: ₩${formatDisplayKrw(entry.totalCostKrw)} | 은: ₩${formatDisplayKrw(entry.silverPriceKrwPerG)}/g | 공임: ₩${formatDisplayKrw(entry.laborKrw)}${entry.laborBasis === "PER_G" ? "/g" : "/ea"}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

      </div> {/* End of Left Column */}

      {/* Right Column: China Cost Summary (Reserved) + BOM */}
      <div className="space-y-4 min-w-0">
        {selectedMasterId ? (
          <Card>
            <CardBody className="space-y-3">
              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
                <div className="text-sm font-semibold">원가 비교</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)]">
                  <table className="w-full table-fixed text-[11px]">
                    <colgroup>
                      <col className="w-[74px]" />
                      <col className="w-[34%]" />
                      <col className="w-[32%]" />
                      <col className="w-[34%]" />
                    </colgroup>
                    <thead className="text-[var(--muted)]">
                      <tr>
                        <th className="px-1.5 py-2 text-left">항목</th>
                        <th className="px-2 py-2 text-right">우리 원가</th>
                        <th className="px-2 py-2 text-right">중국원가</th>
                        <th className="px-2 py-2 text-right">마진</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const ourReasonMap = new Map<string, number>([
                          ["기본공임", detailLaborBaseCostDisplay + detailAbsorbImpactSummary.baseLabor],
                          ["중심공임", Number(selectedDetail?.laborCenterCost ?? 0) * Number(selectedDetail?.centerQty ?? 0) + detailAbsorbImpactSummary.stoneCenter],
                          ["보조1공임", Number(selectedDetail?.laborSub1Cost ?? 0) * Number(selectedDetail?.sub1Qty ?? 0) + detailAbsorbImpactSummary.stoneSub1],
                          ["보조2공임", Number(selectedDetail?.laborSub2Cost ?? 0) * Number(selectedDetail?.sub2Qty ?? 0) + detailAbsorbImpactSummary.stoneSub2],
                          ["도금공임", detailPlatingCostDisplay + detailAbsorbImpactSummary.plating],
                          ["기타공임", detailAbsorbImpactSummary.etc],
                        ]);

                        const ourLaborTotalWithAbsorb = detailLaborCostWithAccessory + detailAbsorbImpactSummary.total;

                        const knownOrder = ["기본공임", "중심공임", "보조1공임", "보조2공임", "도금공임", "기타공임"];
                        const chinaReasonMap = chinaCostComparison?.reasonCostMap ?? new Map<string, number>();
                        const rows = knownOrder
                          .map((label) => ({
                            label,
                            ours: ourReasonMap.get(label) ?? 0,
                            china: chinaReasonMap.get(label) ?? 0,
                          }))
                          .filter((row) => row.ours !== 0 || row.china !== 0);
                        const laborRowBgClassMap: Record<string, string> = {
                          기본공임: "bg-lime-50",
                          중심공임: "bg-green-50",
                          보조1공임: "bg-green-50",
                          보조2공임: "bg-green-50",
                          도금공임: "bg-[var(--subtle-bg)]",
                          기타공임: "bg-[var(--subtle-bg)]",
                        };

                        const shouldShowMaterialRow = materialPrice !== 0 || (chinaCostComparison?.materialKrw ?? 0) !== 0;
                        const shouldShowTotalRow = ourLaborTotalWithAbsorb !== 0 || (chinaCostComparison?.laborKrw ?? 0) !== 0;

                        return (
                          <>
                            {shouldShowMaterialRow ? (
                              <tr className="border-t border-[var(--panel-border)]">
                                <td className="px-1.5 py-2 whitespace-nowrap">소재</td>
                                <td className="px-2 py-2 text-right">₩{formatDisplayKrw(materialPrice)}</td>
                                <td className="px-2 py-2 text-right">{chinaCostComparison ? `₩${formatDisplayKrw(chinaCostComparison.materialKrw)}` : "-"}</td>
                                <td className="px-2 py-2 text-right">
                                  {chinaCostComparison
                                    ? `₩${formatDisplayKrw(materialPrice - chinaCostComparison.materialKrw)}`
                                    : "-"}
                                </td>
                              </tr>
                            ) : null}
                            {rows.map((row) => {
                              const laborRowBgClass = laborRowBgClassMap[row.label] ?? "";
                              return (
                                <tr key={row.label} className="border-t border-[var(--panel-border)]">
                                  <td className={cn("px-1.5 py-2 whitespace-nowrap", laborRowBgClass)}>{row.label}</td>
                                  <td className={cn("px-2 py-2 text-right", laborRowBgClass)}>₩{formatLaborDisplayKrw(row.ours)}</td>
                                  <td className={cn("px-2 py-2 text-right", laborRowBgClass)}>{chinaCostComparison ? `₩${formatLaborDisplayKrw(row.china)}` : "-"}</td>
                                  <td className={cn("px-2 py-2 text-right", laborRowBgClass)}>
                                  {chinaCostComparison
                                    ? `₩${formatLaborDisplayKrw(row.ours - row.china)}`
                                    : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                            {shouldShowTotalRow ? (
                              <tr className="border-t border-[var(--panel-border)] font-semibold">
                                <td className="px-1.5 py-2 whitespace-nowrap">총공임</td>
                                <td className="px-2 py-2 text-right">₩{formatLaborDisplayKrw(ourLaborTotalWithAbsorb)}</td>
                                <td className="px-2 py-2 text-right">{chinaCostComparison ? `₩${formatLaborDisplayKrw(chinaCostComparison.laborKrw)}` : "-"}</td>
                                <td className="px-2 py-2 text-right">
                                  {chinaCostComparison
                                    ? `₩${formatLaborDisplayKrw(ourLaborTotalWithAbsorb - chinaCostComparison.laborKrw)}`
                                    : "-"}
                                </td>
                              </tr>
                            ) : null}
                            {(() => {
                              const chinaTotalPrice = chinaCostComparison ? chinaCostComparison.materialKrw + chinaCostComparison.laborKrw : 0;
                              const ourTotalPriceWithAbsorb = materialPrice + ourLaborTotalWithAbsorb;
                              const shouldShowTotalPriceRow = ourTotalPriceWithAbsorb !== 0 || chinaTotalPrice !== 0;
                              if (!shouldShowTotalPriceRow) return null;
                              return (
                                <tr className="border-t border-[var(--panel-border)] font-semibold">
                                  <td className="px-1.5 py-2 whitespace-nowrap">총가격</td>
                                  <td className="px-2 py-2 text-right">₩{formatDisplayKrw(ourTotalPriceWithAbsorb)}</td>
                                  <td className="px-2 py-2 text-right">
                                    {chinaCostComparison ? `₩${formatDisplayKrw(chinaTotalPrice)}` : "-"}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {chinaCostComparison
                                      ? `₩${formatDisplayKrw(ourTotalPriceWithAbsorb - chinaTotalPrice)}`
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">구성품 목록</div>
                  <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1 text-xs tabular-nums">
                    <span className="text-[var(--muted)]">총중량</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {flattenQuery.isLoading || flattenQuery.isError || flattenComponentMetrics.rows.length === 0
                        ? "-"
                        : `${formatWeightNumber(flattenComponentMetrics.totals.grossWeight)} g`}
                    </span>
                    <span className="text-[var(--muted)]">판매공임 합계</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {flattenQuery.isLoading || flattenQuery.isError || flattenComponentMetrics.rows.length === 0
                        ? "-"
                        : `₩${formatLaborDisplayKrw(flattenComponentMetrics.totals.laborSellTotal)}`}
                    </span>
                    <span className="text-[var(--muted)]">판매공임 원가</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {flattenQuery.isLoading || flattenQuery.isError || flattenComponentMetrics.rows.length === 0
                        ? "-"
                        : `₩${formatLaborDisplayKrw(flattenComponentMetrics.totals.laborCostTotal)}`}
                    </span>
                  </div>
                </div>

                {flattenQuery.isLoading ? (
                  <div className="text-xs text-[var(--muted)]">구성품 계산 중...</div>
                ) : flattenQuery.isError ? (
                  <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                    {flattenQuery.error instanceof Error ? flattenQuery.error.message : "구성품 조회 실패"}
                  </div>
                ) : flattenComponentMetrics.rows.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">등록된 부속 구성품이 없습니다.</div>
                  ) : (
                    <>
                      {(() => {
                        if (displayedBomLineMetrics.length === 0) {
                          return (
                            <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                              <div className="mb-2 text-xs font-semibold text-[var(--foreground)]">구성품(빠른 로딩)</div>
                              <div className="overflow-x-auto rounded-[8px] border border-[var(--panel-border)]">
                                <table className="min-w-full text-left text-xs">
                                  <thead className="bg-[var(--subtle-bg)] text-[var(--muted)]">
                                    <tr>
                                      <th className="px-3 py-2">품목명</th>
                                      <th className="px-3 py-2">수량</th>
                                      <th className="px-3 py-2">총공임(판매)</th>
                                      <th className="px-3 py-2">총공임(원가)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {flattenComponentMetrics.rows.map((row) => (
                                      <tr key={row.key} className="border-t border-[var(--panel-border)]">
                                        <td className="px-3 py-2">{row.name}</td>
                                        <td className="px-3 py-2 tabular-nums">{row.qty.toLocaleString("ko-KR")}</td>
                                        <td className="px-3 py-2 tabular-nums">₩{formatLaborDisplayKrw(row.laborSellTotal)}</td>
                                        <td className="px-3 py-2 tabular-nums">₩{formatLaborDisplayKrw(row.laborCostTotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }

                        const accessoryRows = displayedBomLineMetrics.filter(({ line }) => parseBomLineKind(line.note) === "ACCESSORY");
                        const decorRows = displayedBomLineMetrics.filter(({ line }) => parseBomLineKind(line.note) === "DECOR");

                        const renderGroupTable = (groupTitle: string, rows: typeof displayedBomLineMetrics) => (
                          <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                            <div className="mb-2 text-xs font-semibold text-[var(--foreground)]">{groupTitle}</div>
                            {rows.length === 0 ? (
                              <div className="px-2 py-3 text-xs text-[var(--muted)]">등록된 항목이 없습니다.</div>
                            ) : (
                              <div className="overflow-x-auto rounded-[8px] border border-[var(--panel-border)]">
                                <table className="min-w-full text-left text-xs">
                                  <thead className="bg-[var(--subtle-bg)] text-[var(--muted)]">
                                    <tr>
                                      <th className="px-3 py-2">사진</th>
                                      <th className="px-3 py-2">품목명</th>
                                      <th className="px-3 py-2">수량</th>
                                      <th className="px-3 py-2">총공임(판매)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map(({ line, laborTotal }) => {
                                      const name = line.component_master_model_name ?? line.component_part_name ?? "(unknown item)";
                                      const imageUrl = line.component_master_id
                                        ? String(masterRowsById[line.component_master_id]?.image_url ?? "")
                                        : "";
                                      const qty = Number(line.qty_per_unit ?? 0);
                                      return (
                                        <tr key={`${groupTitle}-${line.bom_line_id}`} className="border-t border-[var(--panel-border)]">
                                          <td className="px-3 py-2">
                                            {imageUrl ? (
                                              <img src={imageUrl} alt={name} className="h-10 w-10 rounded-md border border-[var(--panel-border)] object-cover bg-[var(--subtle-bg)]" loading="lazy" />
                                            ) : (
                                              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--subtle-bg)] text-[10px] text-[var(--muted)]">-</div>
                                            )}
                                          </td>
                                          <td className="px-3 py-2">{name}</td>
                                          <td className="px-3 py-2 tabular-nums">{qty.toLocaleString("ko-KR")}</td>
                                          <td className="px-3 py-2 tabular-nums">₩{formatLaborDisplayKrw(laborTotal)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );

                        return (
                          <div className="grid grid-cols-1 gap-3">
                            {renderGroupTable("부품", accessoryRows)}
                            {renderGroupTable("장식", decorRows)}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
            </CardBody>
          </Card>
        ) : null}


      </div>
    </div>
  );

  const renderBomDrawer = () => (
    <Sheet
      open={showBomPanel}
      onClose={closeBomDrawer}
      title="자재명세서(BOM)"
      className="left-0 right-auto w-full sm:w-[96vw] lg:w-[1200px] 2xl:w-[1440px] sm:max-w-none border-r border-[var(--panel-border)] border-l-0"
    >
      <div className="h-full overflow-y-auto p-6 scrollbar-hide">
        <div className="space-y-4" id="catalog.detail.bom">
          <ActionBar
            title="자재명세서(BOM)"
            subtitle="부속/메달 구성품을 마스터 기준으로 관리합니다."
            actions={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={closeBomDrawer}>
                  이전으로 돌아가기
                </Button>
              </div>
            }
          />

          <Card>
            <CardBody>
              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-3 py-2">
                  <span className="text-[var(--muted)]">총중량</span>
                  <span className="ml-2 font-semibold text-[var(--foreground)]">{formatWeightNumber(bomTotals.netWeight)} g</span>
                </div>
                <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-3 py-2">
                  <span className="text-[var(--muted)]">총기타공</span>
                  <span className="ml-2 font-semibold text-[var(--foreground)]">₩{formatLaborDisplayKrw(bomTotals.laborTotal)}</span>
                </div>
                <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-3 py-2">
                  <span className="text-[var(--muted)]">총소재비</span>
                  <span className="ml-2 font-semibold text-[var(--foreground)]">₩{formatDisplayKrw(bomTotals.materialTotal)}</span>
                </div>
                <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--primary-soft)] px-3 py-2">
                  <span className="text-[var(--muted)]">합산가</span>
                  <span className="ml-2 font-semibold text-[var(--primary)]">₩{formatDisplayKrw(bomTotals.estimatedTotal)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {isActorMissing ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              환경 경고: NEXT_PUBLIC_CMS_ACTOR_ID 미설정으로 생성/추가/VOID가 차단됩니다.
            </div>
          ) : null}

          {componentSearchQuery.error ? (
            <Card className="border-red-200 bg-red-50">
              <CardBody className="space-y-2 text-red-900">
                <div className="text-sm font-semibold">검색 오류</div>
                <div className="text-sm">
                  {componentSearchQuery.error instanceof Error
                    ? componentSearchQuery.error.message
                    : "구성품 검색 오류"}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {!selectedMasterId ? (
            <Card>
              <CardBody className="text-sm text-[var(--muted)]">
                마스터를 선택하면 BOM 관리가 가능합니다.
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold">구성품 추가</div>
                </CardHeader>
                <CardBody className="space-y-3">
                      <div className="relative space-y-2">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_minmax(0,1fr)_120px_auto]">
                          <Select
                            aria-label="구분"
                            value={componentLineKind}
                            onChange={(e) => setComponentLineKind(e.target.value as BomLineKind)}
                          >
                            <option value="ACCESSORY">부속</option>
                            <option value="DECOR">장식(기타공임)</option>
                          </Select>
                          <Input
                            aria-label="품목명 검색"
                            placeholder="품목명 검색"
                            value={componentQuery}
                            onFocus={() => setShowComponentResults(true)}
                            onBlur={() => window.setTimeout(() => setShowComponentResults(false), 220)}
                            onChange={(e) => {
                              setComponentQuery(e.target.value);
                              setShowComponentResults(true);
                            }}
                          />
                          <Input
                            aria-label="수량"
                            placeholder="수량"
                            value={qtyPerUnit}
                            onChange={(e) => setQtyPerUnit(e.target.value)}
                          />
                          <span className="inline-flex" title={!canWrite ? writeDisabledReason : undefined}>
                            <Button onClick={handleAddLine} disabled={addLineDisabled}>
                              추가
                            </Button>
                          </span>
                        </div>

                        {showComponentResults || componentQuery.trim().length > 0 ? (
                          <div className="max-h-56 overflow-y-auto rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)]">
                            {componentSearchQuery.isLoading ? (
                              <div className="px-3 py-2 text-xs text-[var(--muted)]">검색 중...</div>
                            ) : componentSearchResults.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-[var(--muted)]">검색 결과가 없습니다.</div>
                            ) : (
                              componentSearchResults.map((item) => {
                                const materialCode = String(masterRowsById[item.master_id]?.material_code_default ?? item.material_code_default ?? "-");
                                const isSelected = selectedComponentId === item.master_id;
                                return (
                                  <button
                                    key={item.master_id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setSelectedComponentId(item.master_id);
                                      setComponentQuery(item.model_name);
                                      setShowComponentResults(false);
                                    }}
                                    className={cn(
                                      "w-full border-b border-[var(--panel-border)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--subtle-bg)]",
                                      isSelected && "bg-[var(--subtle-bg)]"
                                    )}
                                  >
                                    <div className="font-medium text-[var(--foreground)]">{item.model_name}</div>
                                    <div className="text-xs text-[var(--muted)]">소재: {materialCode}</div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-xs text-[var(--muted)]">선택한 품목의 소재는 마스터에 저장된 소재가 기본으로 적용됩니다.</div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="text-sm font-semibold">현재 구성품 목록</div>
                    </CardHeader>
                    <CardBody className="space-y-2">
                      {linesQuery.isLoading ? (
                        <p className="text-sm text-[var(--muted)]">불러오는 중...</p>
                      ) : (linesQuery.data ?? []).length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">등록된 구성품이 없습니다.</p>
                      ) : (
                        (() => {
                          const accessoryRows = displayedBomLineMetrics.filter(({ line }) => parseBomLineKind(line.note) === "ACCESSORY");
                          const decorRows = displayedBomLineMetrics.filter(({ line }) => parseBomLineKind(line.note) === "DECOR");

                          const renderTable = (title: string, rows: typeof displayedBomLineMetrics) => {
                            const qtySum = rows.reduce((sum, { line }) => sum + Number(line.qty_per_unit ?? 0), 0);
                            const laborSum = rows.reduce((sum, { laborTotal }) => sum + Number(laborTotal ?? 0), 0);

                            return (
                              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                                <div className="mb-2 text-xs font-semibold text-[var(--foreground)]">{title}</div>
                                {rows.length === 0 ? (
                                  <div className="px-2 py-3 text-xs text-[var(--muted)]">등록된 항목이 없습니다.</div>
                                ) : (
                                  <div className="overflow-x-auto rounded-[8px] border border-[var(--panel-border)]">
                                    <table className="min-w-full text-left text-xs">
                                      <thead className="bg-[var(--subtle-bg)] text-[var(--muted)]">
                                        <tr>
                                          <th className="px-3 py-2">사진</th>
                                          <th className="px-3 py-2">품목명</th>
                                          <th className="px-3 py-2">수량</th>
                                          <th className="px-3 py-2">총공임</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map(({ line, laborTotal }) => {
                                          const name = line.component_master_model_name ?? line.component_part_name ?? "(unknown item)";
                                          const imageUrl = line.component_master_id
                                            ? String(masterRowsById[line.component_master_id]?.image_url ?? "")
                                            : "";
                                          return (
                                            <tr key={`${title}-${line.bom_line_id}`} className="border-t border-[var(--panel-border)]">
                                              <td className="px-3 py-2">
                                                {imageUrl ? (
                                                  <img src={imageUrl} alt={name} className="h-10 w-10 rounded-md border border-[var(--panel-border)] object-cover bg-[var(--subtle-bg)]" loading="lazy" />
                                                ) : (
                                                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--subtle-bg)] text-[10px] text-[var(--muted)]">-</div>
                                                )}
                                              </td>
                                              <td className="px-3 py-2">{name}</td>
                                              <td className="px-3 py-2 tabular-nums">{Number(line.qty_per_unit ?? 0).toLocaleString("ko-KR")}</td>
                                              <td className="px-3 py-2 tabular-nums">₩{formatLaborDisplayKrw(laborTotal)}</td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="border-t border-[var(--panel-border)] bg-[var(--subtle-bg)] font-semibold">
                                          <td className="px-3 py-2" />
                                          <td className="px-3 py-2">합계</td>
                                          <td className="px-3 py-2 tabular-nums">{qtySum.toLocaleString("ko-KR")}</td>
                                          <td className="px-3 py-2 tabular-nums">₩{formatLaborDisplayKrw(laborSum)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return (
                            <div className="grid grid-cols-1 gap-3">
                              {renderTable("부품", accessoryRows)}
                              {renderTable("장식", decorRows)}
                            </div>
                          );
                        })()
                      )}
                    </CardBody>
                  </Card>
                </div>
          )}

          <Modal open={!!voidConfirmId} onClose={() => setVoidConfirmId(null)} title="구성품 VOID">
            <div className="space-y-6">
              <div className="text-sm text-[var(--foreground)]">
                <p>이 구성품 라인을 VOID 처리합니다. 되돌릴 수 없으며 감사/분석 로그로 유지됩니다.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setVoidConfirmId(null)}>취소</Button>
                <Button
                  variant="danger"
                  onClick={handleVoidConfirm}
                  disabled={voidActionDisabled}
                >
                  VOID 처리
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </Sheet>
  );

  const renderAbsorbDrawer = () => (
    <Sheet
      open={showAbsorbPanel}
      onClose={closeAbsorbDrawer}
      title="흡수공임"
      className="left-0 right-auto w-full sm:w-[90vw] lg:w-[760px] sm:max-w-none border-r border-[var(--panel-border)] border-l-0"
    >
      <div className="h-full overflow-y-auto p-6 scrollbar-hide">
        <div className="space-y-4">
          <ActionBar
            title="흡수공임"
            subtitle="버킷/사유/금액/공장 스코프 기준으로 추가 공임을 관리합니다."
            actions={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={closeAbsorbDrawer}>
                  이전으로 돌아가기
                </Button>
              </div>
            }
          />

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">흡수공임 추가/수정</div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Select value={absorbBucket} onChange={(e) => setAbsorbBucket(e.target.value as AbsorbLaborBucket)}>
                  {absorbBucketOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                {absorbBucket === "ETC" ? (
                  <Select value={absorbLaborClass} onChange={(e) => setAbsorbLaborClass(e.target.value as AbsorbLaborClass)}>
                    {absorbLaborClassOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Input value="일반" readOnly className="text-[var(--muted)] bg-[var(--input-bg)]" />
                )}
                {absorbBucket === "STONE_LABOR" ? (
                  <Select value={absorbStoneRole} onChange={(e) => setAbsorbStoneRole(e.target.value as AbsorbStoneRole)}>
                    {absorbStoneRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Input value="알공임 선택 시 중심/보조 선택 가능" readOnly className="text-[var(--muted)] bg-[var(--input-bg)]" />
                )}
                <Input value={absorbReason} onChange={(e) => setAbsorbReason(e.target.value)} placeholder="사유" />
                <Input
                  value={absorbAmount}
                  onChange={(e) => setAbsorbAmount(e.target.value)}
                  placeholder="예: -3000 또는 5000"
                />
                {absorbBucket === "ETC" && absorbLaborClass === "MATERIAL" ? (
                  <>
                    <Input
                      value={absorbMaterialQtyPerUnit}
                      onChange={(e) => setAbsorbMaterialQtyPerUnit(e.target.value)}
                      placeholder="소재 개수 (개당)"
                    />
                    <Input
                      value={absorbMaterialCostKrw}
                      onChange={(e) => setAbsorbMaterialCostKrw(e.target.value)}
                      placeholder="소재 원가 (개당)"
                    />
                  </>
                ) : null}
                <Select value={absorbVendorId} onChange={(e) => setAbsorbVendorId(e.target.value)}>
                  <option value="">전체 공장</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                  ))}
                </Select>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={absorbIsPerPiece} onChange={(e) => setAbsorbIsPerPiece(e.target.checked)} className="h-4 w-4" />
                  수량 곱(is_per_piece)
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={absorbIsActive} onChange={(e) => setAbsorbIsActive(e.target.checked)} className="h-4 w-4" />
                  활성화
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={handleSaveAbsorbLaborItem} disabled={!masterId.trim()}>
                  {editingAbsorbItemId ? "흡수공임 수정" : "흡수공임 추가"}
                </Button>
                {editingAbsorbItemId ? (
                  <Button type="button" variant="ghost" onClick={resetAbsorbForm}>취소</Button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">기본공임 +{formatDisplayKrw(absorbImpactSummary.baseLabor)}</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">알공임(중심) +{formatDisplayKrw(absorbImpactSummary.stoneCenter)}</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">알공임(보조1) +{formatDisplayKrw(absorbImpactSummary.stoneSub1)}</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">알공임(보조2) +{formatDisplayKrw(absorbImpactSummary.stoneSub2)}</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">도금 +{formatDisplayKrw(absorbImpactSummary.plating)}</div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">기타(수동흡수) +{formatDisplayKrw(absorbImpactSummary.etc)}</div>
                <div className="col-span-2 rounded border border-[var(--panel-border)] bg-[var(--warning-soft)] px-2 py-1 font-semibold">총 추가 +{formatDisplayKrw(absorbImpactSummary.total)}</div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">흡수공임 목록</div>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-1">활성</th>
                      <th className="text-left py-1">버킷</th>
                      <th className="text-left py-1">분류</th>
                      <th className="text-left py-1">알공임 위치</th>
                      <th className="text-left py-1">사유</th>
                      <th className="text-left py-1">금액</th>
                      <th className="text-left py-1">소재개수</th>
                      <th className="text-left py-1">소재원가</th>
                      <th className="text-left py-1">수량 곱</th>
                      <th className="text-left py-1">공장 범위</th>
                      <th className="text-left py-1">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAbsorbLaborItems.length === 0 ? (
                      <tr className="border-t border-[var(--panel-border)]">
                        <td className="py-2 text-[var(--muted)]" colSpan={11}>등록된 흡수공임이 없습니다.</td>
                      </tr>
                    ) : (
                      visibleAbsorbLaborItems.map((item) => (
                        <tr key={item.absorb_item_id} className="border-t border-[var(--panel-border)]">
                          <td className="py-1">{item.is_active ? "Y" : "N"}</td>
                          <td className={cn("py-1", getAbsorbBucketToneClass(item.bucket))}>{getAbsorbBucketDisplayLabel(item)}</td>
                          <td className="py-1">{normalizeAbsorbLaborClass(item.labor_class) === "MATERIAL" ? "소재" : "일반"}</td>
                          <td className="py-1">{getAbsorbStoneRoleLabel(item.note)}</td>
                          <td className="py-1">{item.reason}</td>
                          <td className="py-1">{Number(item.amount_krw).toLocaleString()}</td>
                          <td className="py-1">{Math.max(Number(item.material_qty_per_unit ?? 1), 0).toLocaleString()}</td>
                          <td className="py-1">{Math.max(Number(item.material_cost_krw ?? 0), 0).toLocaleString()}</td>
                          <td className="py-1">{item.is_per_piece ? "Y" : "N"}</td>
                          <td className="py-1">{vendorOptions.find((vendor) => vendor.value === item.vendor_party_id)?.label ?? "전체"}</td>
                          <td className="py-1">
                            <div className="flex items-center gap-1">
                              <Button type="button" size="sm" variant="secondary" onClick={() => handleEditAbsorbLaborItem(item)}>수정</Button>
                              <Button type="button" size="sm" variant="secondary" onClick={() => handleDeleteAbsorbLaborItem(item.absorb_item_id)}>삭제</Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </Sheet>
  );

  const renderListLeftPanel = () => (
    <div className="flex flex-col gap-3 h-full" id="catalog.listPanel">
      <div className="sticky top-3 z-10 flex min-h-[42px] items-center justify-between rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/95 px-4 py-2 shadow-sm backdrop-blur-md transition-all">
        <p className="text-xs text-[var(--muted)]">
          {rangeStart} - {rangeEnd} / {totalCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      </div>
      <div className="flex-1">
        {isCatalogLoading && catalogItemsState.length === 0 ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--muted)]">
            불러오는 중...
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--muted)]">
            데이터가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {pageItems.map((item) => (
                <Card
                key={item.id}
                className={cn(
                  "cursor-pointer p-3 transition",
                  getMaterialBgColor(
                    String(
                      masterRowsById[item.id]?.material_code_default ?? "00"
                    )
                  ),
                  item.id === selectedItemId
                    ? "ring-2 ring-[var(--primary)]"
                    : "hover:opacity-90"
                  )}
                  onClick={() => {
                    prefetchMasterDetailFastPath(item.id);
                    setSelectedItemId(item.id);
                  }}
                  onMouseEnter={() => prefetchMasterDetailFastPath(item.id)}
                  onFocus={() => prefetchMasterDetailFastPath(item.id)}
                  onDoubleClick={handleOpenEdit}
                >
                <div className="flex gap-4">
                  <div
                    className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--panel)] to-[var(--background)]"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (item.imageUrl) setPreviewImage(item.imageUrl);
                    }}
                  >
                    <div className="absolute right-2 top-2 h-6 w-6 rounded-full border border-[var(--panel)]/80 bg-[var(--panel)]/80" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
                      이미지
                    </div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={`${item.model} 이미지`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold text-[var(--foreground)]">
                          {item.model}
                        </p>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {item.date}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--muted)]">{item.name}</p>
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                      {[
                        { label: "중량", value: item.weight },
                        { label: "재질", value: item.material },
                        { label: "스톤", value: item.stone },
                        {
                          label: "공급처",
                          value:
                            vendorLabelById.get(item.vendor) ?? item.vendor,
                        },
                      ].map((meta) => (
                        <div
                          key={meta.label}
                          className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1"
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                            {meta.label}
                          </p>
                          <p className="text-xs font-semibold text-[var(--foreground)]">
                            {meta.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div className="text-[var(--muted)]">색상</div>
                      <div className="text-[var(--muted)]">원가</div>
                      <div className="text-[var(--muted)]">등급1</div>
                      <div className="text-[var(--muted)]">등급2</div>
                      <div className="text-[var(--muted)]">등급3</div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {item.color}
                      </div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {item.cost}
                      </div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {item.grades[0]}
                      </div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {item.grades[1]}
                      </div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {item.grades[2]}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-4" id="catalog.root">
        <ActionBar
          title={
            <div className="flex items-center gap-3">
              <span>상품 카탈로그</span>
              <span className="rounded-full bg-[var(--chip)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                {totalCount}개
              </span>
            </div>
          }
          subtitle="마스터카드 관리"
          actions={
            <div className="flex items-center gap-2">
              <Select value={`${sortBy}-${sortOrder}`} onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ["model" | "modified", "asc" | "desc"];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }} className="text-sm">
                <option value="model-asc">모델명 (오름차순)</option>
                <option value="model-desc">모델명 (내림차순)</option>
                <option value="modified-asc">수정순 (오래된순)</option>
                <option value="modified-desc">수정순 (최신순)</option>
              </Select>
              <Button variant="secondary" size="sm" onClick={handleOpenNew}>
                새 상품 등록
              </Button>
              <div className="flex items-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setPage(1);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
                    view === "list" ? "bg-[var(--active-bg)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("gallery");
                    setPage(1);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
                    view === "gallery" ? "bg-[var(--active-bg)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  <Grid2x2 size={16} />
                </button>
              </div>
            </div>
          }
          id="catalog.actionBar"
        />

        {view === "list" ? (
          <SplitLayout
            className="gap-6 items-start"
            left={renderListLeftPanel()}
            right={
              <>
                {renderFilterBar()}
                {renderDetailPanel()}
              </>
            }
          />
        ) : (
          <>
            {renderFilterBar()}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" id="catalog.galleryGrid">
              {isCatalogLoading && pageItems.length === 0 ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-[16px] bg-[var(--shimmer)]"
                  />
                ))
              ) : pageItems.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[var(--muted)]">
                  등록된 상품이 없습니다.
                </div>
              ) : (
                pageItems.map((item) => {
                  const row = masterRowsById[item.id];
                  const weight = parseFloat(item.weight);
                  const hasWeight = Number.isFinite(weight);
                  const deduction = parseFloat(String(row?.deduction_weight_default_g ?? 0)) || 0;
                  const netWeight = hasWeight ? weight - deduction : null;
                  const centerQty = Number(row?.center_qty_default ?? 0);
                  const sub1Qty = Number(row?.sub1_qty_default ?? 0);
                  const sub2Qty = Number(row?.sub2_qty_default ?? 0);
                  const laborSell =
                    (row?.labor_total_sell as number | undefined) ??
                    (Number(row?.labor_base_sell ?? 0) +
                      Number(row?.labor_center_sell ?? 0) * centerQty +
                      Number(row?.labor_sub1_sell ?? 0) * sub1Qty +
                      Number(row?.labor_sub2_sell ?? 0) * sub2Qty);
                  const materialCode = String(row?.material_code_default ?? "00");
                  const materialLabel =
                    materialOptions.find((material) => material.value === materialCode)?.label ?? materialCode;
                  const categoryCode = String(row?.category_code ?? "");
                  const categoryLabel =
                    categoryOptions.find((category) => category.value === categoryCode)?.label ??
                    (categoryCode || "-");
                  const totalPrice = hasWeight
                    ? roundUpToThousand(calculateMaterialPrice(materialCode, weight, deduction) + laborSell)
                    : null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel)] transition-all hover:ring-2 hover:ring-[var(--primary)]",
                        getMaterialBgColor(
                          String(masterRowsById[item.id]?.material_code_default ?? "00")
                        ),
                        selectedItemId === item.id && "ring-2 ring-[var(--primary)]"
                      )}
                      onClick={() => openDetailDrawer(item.id)}
                      onMouseEnter={() => prefetchMasterDetailFastPath(item.id)}
                      onFocus={() => prefetchMasterDetailFastPath(item.id)}
                    >
                      {/* Image */}
                      <div className="absolute inset-x-0 top-0 bottom-28 bg-[var(--white)] dark:bg-[var(--black)]">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.model}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--subtle-bg)] text-[var(--muted)]">
                            <span className="text-xs">No Image</span>
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 h-28 border-t border-[var(--panel-border)] bg-[var(--panel)] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-[var(--foreground)] truncate">{item.model}</div>
                          <div className="flex items-center gap-1 text-[10px] text-[var(--muted)] shrink-0">
                            <span className="rounded bg-[var(--chip)] px-1.5 py-0.5">{materialLabel}</span>
                            <span className="rounded bg-[var(--chip)] px-1.5 py-0.5">{categoryLabel}</span>
                          </div>
                        </div>
                        <div
                          className="mt-1 space-y-1 text-[11px] text-[var(--foreground)]"
                          style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}
                        >
                          <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                            <span className="text-[var(--muted)]">총중량</span>
                            <span className="truncate text-right font-normal">
                              {netWeight === null ? "-" : <><NumberText value={netWeight} /> g</>}
                            </span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                            <span className="text-[var(--muted)]">총공임</span>
                            <span className="truncate text-right font-normal">
                              {laborSell > 0 ? <><NumberText value={laborSell} /> 원</> : "-"}
                            </span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                            <span className="text-[var(--muted)]">총가격</span>
                            <span className="truncate text-right font-bold">
                              {totalPrice === null ? "-" : <><NumberText value={totalPrice} /> 원</>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-4 pb-8">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                이전
              </Button>
              <div className="text-sm font-medium">
                {page} / {totalPages}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                다음
              </Button>
            </div>

            <Sheet
              open={isDetailDrawerOpen}
              onClose={closeDetailDrawer}
              title={selectedItem?.model ?? "상세 정보"}
              className="lg:w-[1100px]"
            >
              <div className="h-full overflow-y-auto p-6 scrollbar-hide">
                {renderDetailPanel()}
              </div>
            </Sheet>
          </>
        )}
      </div>

      {renderBomDrawer()}
      {renderRegisterDrawer()}
      {renderAbsorbDrawer()}
      {renderImageOverlay()}

      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="마스터 삭제">
        <div className="space-y-6">
          <div className="text-sm text-[var(--foreground)]">
            <p>선택한 마스터를 삭제합니다.</p>
            <p className="mt-1 text-[var(--muted)]">이 작업은 되돌릴 수 없습니다.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>취소</Button>
            <Button variant="danger" onClick={handleDeleteMaster} disabled={isDeleting}>
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
