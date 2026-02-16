"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Search, CheckCircle2, AlertCircle, ArrowRight, FileText, Scale, Hammer } from "lucide-react";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { NumberText } from "@/components/ui/number-text";
import { ShipmentPricingEvidencePanel } from "@/components/shipments/ShipmentPricingEvidencePanel";
import { EffectivePriceCard, type EffectivePriceResponse } from "@/components/pricing/EffectivePriceCard";

import { CONTRACTS } from "@/lib/contracts";
import { type StoneSource } from "@/lib/stone-source";
import { hasVariationTag } from "@/lib/variation-tag";
import { readView } from "@/lib/supabase/read";
import { getSchemaClient } from "@/lib/supabase/client";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { cn } from "@/lib/utils";

type OrderLookupRow = {
  order_line_id?: string;
  order_id?: string;
  order_no?: string;
  order_date?: string;
  sent_to_vendor_at?: string | null;
  inbound_at?: string | null;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  model_name?: string;
  suffix?: string | null;
  material_code?: string | null;
  color?: string;
  size?: string | null;
  memo?: string | null;
  status?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
  // cms_v_unshipped_order_lines 필드명 매핑
  customer_party_id?: string;
  customer_name?: string;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  display_status?: string;
};

type OrderLineModelRow = {
  order_line_id?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  material_code?: string | null;
};

type OrderLookupModelRow = {
  order_line_id?: string | null;
  model_no?: string | null;
};

type ShipmentPrefillRow = {
  order_line_id?: string;
  order_id?: string;
  order_no?: string;
  order_date?: string;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  material_code?: string | null;
  color?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
  category?: string | null;
  size?: string | null;
  note?: string | null;
  photo_url?: string | null;
};

type OrderLineDetailRow = {
  order_line_id?: string | null;
  matched_master_id?: string | null;
  model_name?: string | null;
  model_name_raw?: string | null;
  color?: string | null;
  size?: string | null;
  qty?: number | null;
  is_plated?: boolean | null;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  center_stone_source?: StoneSource | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub1_stone_source?: StoneSource | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  sub2_stone_source?: StoneSource | null;
  requested_due_date?: string | null;
  priority_code?: string | null;
  memo?: string | null;
  status?: string | null;
  source_channel?: string | null;
  material_code?: string | null;
  selected_base_weight_g?: number | null;
  selected_deduction_weight_g?: number | null;
  selected_net_weight_g?: number | null;
  selected_labor_base_sell_krw?: number | null;
  selected_labor_other_sell_krw?: number | null;
  selected_inventory_move_line_id?: string | null;
  selected_inventory_location_code?: string | null;
  selected_inventory_bin_code?: string | null;
  match_state?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReceiptMatchPrefillRow = {
  receipt_id?: string | null;
  receipt_line_uuid?: string | null;
  order_line_id?: string | null;
  status?: string | null;
  selected_weight_g?: number | null;
  selected_material_code?: string | null;
  selected_factory_labor_basic_cost_krw?: number | null;
  selected_factory_labor_other_cost_krw?: number | null;
  selected_factory_total_cost_krw?: number | null;
  shipment_base_labor_krw?: number | null;
  shipment_extra_labor_krw?: number | null;
  shipment_extra_labor_items?: unknown;
  receipt_match_overridden_fields?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  receipt_weight_g?: number | null;
  receipt_deduction_weight_g?: number | null;
  stone_center_qty?: number | null;
  stone_sub1_qty?: number | null;
  stone_sub2_qty?: number | null;
  stone_center_unit_cost_krw?: number | null;
  stone_sub1_unit_cost_krw?: number | null;
  stone_sub2_unit_cost_krw?: number | null;
  stone_labor_krw?: number | null;
  receipt_labor_basic_cost_krw?: number | null;
  receipt_labor_other_cost_krw?: number | null;
};

type MasterLookupRow = {
  master_id?: string;
  master_item_id?: string;
  model_name?: string;
  photo_url?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  center_stone_name_default?: string | null;
  sub1_stone_name_default?: string | null;
  sub2_stone_name_default?: string | null;
  vendor_name?: string | null;
  material_price?: number | null;
  labor_base_sell?: number | null;
  labor_base_cost?: number | null;
  labor_basic?: number | null;
  labor_center?: number | null;
  labor_side1?: number | null;
  labor_side2?: number | null;
  labor_center_cost?: number | null;
  labor_sub1_cost?: number | null;
  labor_sub2_cost?: number | null;
};

type ShipmentLineRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  master_id?: string | null;
  model_name?: string;
  qty?: number;
  measured_weight_g?: number | null;
  deduction_weight_g?: number | null;
  material_amount_sell_krw?: number | null;
  base_labor_krw?: number | null;
  extra_labor_krw?: number | null;
  manual_labor_krw?: number | null;
  pricing_mode?: string | null;
  manual_total_amount_krw?: number | null;
  extra_labor_items?: unknown;
};

type ShipmentHeaderRow = {
  is_store_pickup?: boolean | null;
  pricing_locked_at?: string | null;
  pricing_source?: string | null;
  confirmed_at?: string | null;
  status?: string | null;
  source_location_code?: string | null;
  source_bin_code?: string | null;
};

type LocationBinRow = {
  bin_code?: string | null;
  location_code?: string | null;
  bin_name?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type StorePickupLookupRow = {
  order_line_id?: string | null;
  shipment_header?: {
    is_store_pickup?: boolean | null;
  } | null;
};

type ArResyncResult = {
  ok?: boolean;
  shipment_id?: string;
  updated?: number;
  inserted?: number;
};

function getVendorInitials(name?: string | null) {
  if (!name) return "NA";
  const trimmed = name.trim();
  if (!trimmed) return "NA";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function buildReceiptBaseName(dateKey: string, vendorInitials: string, pageIndex: number) {
  return `${dateKey.replace(/-/g, "")}_${vendorInitials}_${pageIndex}`;
}

type ShipmentValuationRow = {
  pricing_locked_at?: string | null;
  pricing_source?: string | null;
  gold_krw_per_g_snapshot?: number | null;
  silver_krw_per_g_snapshot?: number | null;
  silver_adjust_factor_snapshot?: number | null;
  material_value_krw?: number | null;
  labor_value_krw?: number | null;
  total_value_krw?: number | null;
};

type ReceiptRow = {
  receipt_id: string;
  received_at: string;
  file_path: string;
  file_bucket: string;
  mime_type?: string;
  status: string;
};

type ShipmentUpsertResult = {
  shipment_id?: string;
  shipment_line_id?: string;
  status?: string;
};

const debounceMs = 250;
const OTHER_LABOR_OPTIONS = [
  { label: "도금", value: "PLATING" },
  { label: "중심공임", value: "CENTER" },
  { label: "보조1공임", value: "SUB1" },
  { label: "보조2공임", value: "SUB2" },
  { label: "기타공임 조정(±)", value: "ADJUSTMENT" },
  { label: "기타", value: "OTHER" },
];
// ✅ 영수증 “연결” upsert
const FN_RECEIPT_USAGE_UPSERT = CONTRACTS.functions.receiptUsageUpsert;

const normalizeId = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return text;
};

const buildVariantKey = (...parts: Array<string | null | undefined>) => {
  const normalized = parts.map((part) => String(part ?? "").trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join("|") : null;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const renderNumber = (value?: number | null, suffix?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return (
    <span className="tabular-nums">
      <NumberText value={value} />
      {suffix ? <span className="text-[var(--muted)] ml-0.5">{suffix}</span> : null}
    </span>
  );
};

const parseNumberInput = (value: string) => {
  if (!value) return 0;
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStoneSource = (value: unknown): StoneSource | null => {
  if (value === "SELF" || value === "PROVIDED" || value === "FACTORY") return value;
  return null;
};

const stoneSourceLabel = (value: StoneSource | null) => {
  if (value === "SELF") return "자입(우리가 구매)";
  if (value === "PROVIDED") return "타입(고객 제공)";
  if (value === "FACTORY") return "공입/기성(공장 제공)";
  return "-";
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const formatDateCompact = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}${month}${day}` || "-";
};

const formatDday = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const now = new Date();
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  const todayStart = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  const kstTarget = new Date(parsed.getTime() + kstOffsetMs);
  const targetStart = Date.UTC(kstTarget.getUTCFullYear(), kstTarget.getUTCMonth(), kstTarget.getUTCDate());
  const diffDays = Math.round((targetStart - todayStart) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "D-0";
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
};

const formatOptionalNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return value;
};

const formatMargin = (sell?: number | null, cost?: number | null) => {
  if (sell === null || sell === undefined) return null;
  if (cost === null || cost === undefined) return null;
  return sell - cost;
};
type ExtraLaborItem = {
  id: string;
  type: string;
  label: string;
  amount: string;
  meta?: Record<string, unknown> | null;
};
type StoneAdjustmentReason = "FACTORY_MISTAKE" | "PRICE_UP" | "VARIANT" | "OTHER";

const EXTRA_TYPE_VENDOR_DELTA = "VENDOR_DELTA";
const EXTRA_TYPE_CUSTOM_VARIATION = "CUSTOM_VARIATION";
const EXTRA_TYPE_ADJUSTMENT = "ADJUSTMENT";
const AUTO_EVIDENCE_TYPES = new Set(["COST_BASIS", "MARGINS", "WARN"]);

const isAutoEvidenceItem = (item: ExtraLaborItem) => {
  const type = String(item.type ?? "").trim().toUpperCase();
  const label = String(item.label ?? "").trim().toUpperCase();
  if (AUTO_EVIDENCE_TYPES.has(type)) return true;
  return label.includes("COST_BASIS") || label.includes("MARGIN") || label.includes("WARN");
};

const isAutoAbsorbItem = (item: ExtraLaborItem) => {
  const type = String(item.type ?? "").trim().toUpperCase();
  const label = String(item.label ?? "").trim().toUpperCase();
  if (type === "ABSORB") return true;
  return label.includes("ABSORB") || label.includes("흡수");
};

// Helper function to convert relative photo path to full Supabase Storage URL
const getMasterPhotoUrl = (photoUrl: string | null | undefined): string | null => {
  if (!photoUrl || photoUrl.trim() === "") return null;
  // If it's already a full URL, return it
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    return photoUrl;
  }
  // Convert relative path to full Supabase Storage URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn("[getMasterPhotoUrl] NEXT_PUBLIC_SUPABASE_URL not set");
    return null;
  }
  // Remove leading slash if present
  const cleanPath = photoUrl.startsWith("/") ? photoUrl.slice(1) : photoUrl;
  // 🔥 FIX: 버킷 이름 명시 (실제 버킷명: master_images)
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "master_images";
  // If path already includes bucket name, remove it first (like inventory page)
  const finalPath = cleanPath.startsWith(`${bucketName}/`)
    ? cleanPath.slice(bucketName.length + 1)
    : cleanPath;
  const fullUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${finalPath}`;
  console.log("[getMasterPhotoUrl] Input:", photoUrl, "-> Output:", fullUrl);
  return fullUrl;
};

export default function ShipmentsPage() {
  const schemaClient = getSchemaClient();
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())),
    []
  );

  // --- 주문 검색/선택 ---
  const [lookupOpen, setLookupOpen] = useState(true);
  const lookupInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [onlyReadyToShip, setOnlyReadyToShip] = useState(true);
  const [includeStorePickup, setIncludeStorePickup] = useState(false);

  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [prefillHydratedOrderLineId, setPrefillHydratedOrderLineId] = useState<string | null>(null);
  const [longPendingDemoteIds, setLongPendingDemoteIds] = useState<Set<string>>(() => new Set());
  const [longPendingLoaded, setLongPendingLoaded] = useState(false);
  const [selectedOrderMaterialCode, setSelectedOrderMaterialCode] = useState<string | null>(null);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string | null>(null);
  const [selectedOrderDates, setSelectedOrderDates] = useState<{
    orderDate?: string | null;
    inboundDate?: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("shipments.longPendingDemoteIds");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLongPendingDemoteIds(new Set(parsed.map((v) => String(v))));
        }
      }
    } catch {
      // ignore
    } finally {
      setLongPendingLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!longPendingLoaded) return;
    try {
      window.localStorage.setItem(
        "shipments.longPendingDemoteIds",
        JSON.stringify(Array.from(longPendingDemoteIds))
      );
    } catch {
      // ignore
    }
  }, [longPendingDemoteIds, longPendingLoaded]);

  // --- prefill + master info ---
  const [prefill, setPrefill] = useState<ShipmentPrefillRow | null>(null);

  // --- 입력값 ---
  const [weightG, setWeightG] = useState("");
  const [deductionWeightG, setDeductionWeightG] = useState("");
  const [applyMasterDeductionWhenEmpty, setApplyMasterDeductionWhenEmpty] = useState(true);
  const [baseLabor, setBaseLabor] = useState("");
  const [otherLaborCost, setOtherLaborCost] = useState("");
  const [manualTotalAmountKrw, setManualTotalAmountKrw] = useState("");
  const [isManualTotalOverride, setIsManualTotalOverride] = useState(false);
  const [extraLaborItems, setExtraLaborItems] = useState<ExtraLaborItem[]>([]);
  const [useManualLabor, setUseManualLabor] = useState(false);
  const [manualLabor, setManualLabor] = useState("");
  const [isVariationSectionOpen, setIsVariationSectionOpen] = useState(false);
  const [isVariationMode, setIsVariationMode] = useState(false);
  const [variationNote, setVariationNote] = useState("");
  const [vendorDeltaAmount, setVendorDeltaAmount] = useState("");
  const [vendorDeltaReason, setVendorDeltaReason] = useState<"ERROR" | "POLICY">("ERROR");
  const [vendorDeltaNote, setVendorDeltaNote] = useState("");
  const [stoneAdjustmentAmount, setStoneAdjustmentAmount] = useState("0");
  const [stoneAdjustmentReason, setStoneAdjustmentReason] =
    useState<StoneAdjustmentReason>("FACTORY_MISTAKE");
  const [stoneAdjustmentNote, setStoneAdjustmentNote] = useState("");

  const resolveDeductionValue = (
    deductionText: string,
    masterDeduct: number,
    useMasterFallback: boolean
  ) => {
    const trimmed = deductionText.trim();
    if (trimmed !== "") return parseNumberInput(trimmed);
    if (useMasterFallback) return masterDeduct;
    return 0;
  };

  // --- confirm modal ---
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentShipmentId, setCurrentShipmentId] = useState<string | null>(null);
  const [currentShipmentLineId, setCurrentShipmentLineId] = useState<string | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [isStorePickup, setIsStorePickup] = useState(false);
  const [sourceBinCode, setSourceBinCode] = useState<string>("");

  // ✅ A안: RECEIPT 모드 제거 (임시/수기만 유지)
  const [costMode, setCostMode] = useState<"PROVISIONAL" | "MANUAL">("PROVISIONAL");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({}); // shipment_line_id -> unit_cost_krw

  // --- 영수증(연결만, A안) ---
  const [linkedReceiptId, setLinkedReceiptId] = useState<string | null>(null);

  // receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptFileInputKey, setReceiptFileInputKey] = useState(0);

  // receipt preview
  const [receiptPreviewSrc, setReceiptPreviewSrc] = useState<string | null>(null); // objectURL
  const [receiptPreviewOpenUrl, setReceiptPreviewOpenUrl] = useState<string | null>(null); // server URL (new tab)
  const [receiptPreviewKind, setReceiptPreviewKind] = useState<"pdf" | "image" | null>(null);
  const [receiptPreviewTitle, setReceiptPreviewTitle] = useState<string>("");
  const [receiptPreviewError, setReceiptPreviewError] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<"create" | "confirmed">("create");
  const [isAutoEvidenceOpen, setIsAutoEvidenceOpen] = useState(false);
  const [isAutoAbsorbOpen, setIsAutoAbsorbOpen] = useState(false);
  const [effectivePriceData, setEffectivePriceData] = useState<EffectivePriceResponse | null>(null);
  const [effectivePriceState, setEffectivePriceState] = useState<{
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
  } | null>(null);
  const bundleBlockToastRef = useRef<string | null>(null);

  const normalizeExtraLaborItems = (value: unknown): ExtraLaborItem[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        const record = item as {
          id?: string;
          type?: string;
          label?: string;
          amount?: number | string | null;
          meta?: Record<string, unknown> | null;
        };
        const type = String(record?.type ?? "").trim();
        const label = String(record?.label ?? type ?? "기타").trim() || "기타";
        const amount = record?.amount === null || record?.amount === undefined
          ? ""
          : String(record.amount);
        return {
          id: String(record?.id ?? `extra-${Date.now()}-${index}`),
          type,
          label,
          amount,
          meta:
            record?.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
              ? record.meta
              : null,
        };
      })
      .filter((item) => {
        if (!item.label) return false;
        const amount = parseNumberInput(item.amount);
        return Number.isFinite(amount) && amount !== 0;
      });
  };

  const extractStoneLaborAmount = (value: unknown): number => {
    if (!Array.isArray(value)) return 0;
    const found = value.find((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as { type?: unknown; label?: unknown };
      const type = String(record.type ?? "").trim().toUpperCase();
      const label = String(record.label ?? "").trim();
      return type === "STONE_LABOR" || label.includes("알공임");
    }) as { amount?: unknown } | undefined;
    if (!found) return 0;
    return parseNumberInput(String(found.amount ?? "0"));
  };

  const extractEtcLaborAmount = (value: unknown): number => {
    if (!Array.isArray(value)) return 0;
    return value.reduce((sum, item) => {
      if (!item || typeof item !== "object") return sum;
      const record = item as { type?: unknown; label?: unknown; amount?: unknown };
      const type = String(record.type ?? "").trim().toUpperCase();
      const label = String(record.label ?? "").trim();
      const isStone = type === "STONE_LABOR" || label.includes("알공임");
      if (isStone) return sum;
      return sum + parseNumberInput(String(record.amount ?? "0"));
    }, 0);
  };

  const handleAddExtraLabor = (value: string | null) => {
    if (!value) return;
    const option = OTHER_LABOR_OPTIONS.find((item) => item.value === value);
    const label = option?.label ?? value;
    const nextId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `extra-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setExtraLaborItems((prev) => [
      ...prev,
      {
        id: nextId,
        type: value,
        label,
        amount: "",
        meta: value === EXTRA_TYPE_ADJUSTMENT ? { reason: "OTHER", note: "" } : null,
      },
    ]);
  };

  const handleExtraLaborAmountChange = (id: string, amount: string) => {
    setExtraLaborItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const handleExtraLaborMetaChange = (id: string, key: string, value: string) => {
    setExtraLaborItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
            ...item,
            meta: {
              ...(item.meta ?? {}),
              [key]: value,
            },
          }
          : item
      )
    );
  };

  const handleRemoveExtraLabor = (id: string) => {
    setExtraLaborItems((prev) => prev.filter((item) => item.id !== id));
  };

  const upsertManagedExtraLaborItem = useCallback(
    (type: string, label: string, amount: string, meta?: Record<string, unknown> | null) => {
      setExtraLaborItems((prev) => {
        const index = prev.findIndex((item) => item.type === type);

        const normalized = amount.replaceAll(",", "").trim();
        if (!normalized || Number(normalized) === 0) {
          if (index < 0) return prev;
          const next = [...prev];
          next.splice(index, 1);
          return next;
        }

        const nextItem: ExtraLaborItem = {
          id:
            index >= 0
              ? prev[index].id
              : typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `extra-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          label,
          amount: normalized,
          meta: meta ?? null,
        };

        if (index < 0) return [...prev, nextItem];
        const current = prev[index];
        const currentMeta = current.meta ?? null;
        const nextMeta = nextItem.meta ?? null;
        const sameMeta = JSON.stringify(currentMeta) === JSON.stringify(nextMeta);
        if (
          current.type === nextItem.type &&
          current.label === nextItem.label &&
          String(current.amount) === String(nextItem.amount) &&
          sameMeta
        ) {
          return prev;
        }
        const next = [...prev];
        next[index] = nextItem;
        return next;
      });
    },
    []
  );

  function applyRecommendedStoneLabor(forced: boolean) {
    if (!selectedOrderLineId) return;
    if (!forced && isVariationMode) return;
    const existing = extraLaborItems.find((item) => item.type === "STONE_LABOR");
    if (!forced && existing && String(existing.amount ?? "").trim() !== "") return;

    const adjustment = parseNumberInput(stoneAdjustmentAmount);
    const recommendedAmount = Math.max(0, stoneRecommendation.recommended);
    upsertManagedExtraLaborItem("STONE_LABOR", "알공임", String(recommendedAmount), {
      engine: "stone_sell_from_master_v1",
      recommended: stoneRecommendation.recommended,
      adjustment,
      adjustment_reason: stoneAdjustmentReason,
      adjustment_note: stoneAdjustmentNote.trim() || undefined,
      qty_used: {
        center: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.qtyUsed ?? 0,
        sub1: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.qtyUsed ?? 0,
        sub2: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.qtyUsed ?? 0,
      },
      unit_sell: {
        center: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.unitSell ?? 0,
        sub1: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.unitSell ?? 0,
        sub2: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.unitSell ?? 0,
      },
      sources: {
        qty_source: stoneRecommendation.roles.every((row) => row.qtySource === "INVENTORY")
          ? "INVENTORY"
          : stoneRecommendation.roles.some((row) => row.qtySource === "INVENTORY")
            ? "MIXED"
            : stoneRecommendation.roles.every((row) => row.qtySource === "RECEIPT")
              ? "RECEIPT"
              : stoneRecommendation.roles.some((row) => row.qtySource === "RECEIPT")
                ? "MIXED"
                : "ORDER",
        supply_source: {
          center: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.supply ?? null,
          sub1: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.supply ?? null,
          sub2: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.supply ?? null,
        },
      },
    });
  }

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery.trim()), debounceMs);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => lookupInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  // ✅ 페이지 로드 시 기본 목록 자동 조회 - shipments_main과 동일한 데이터 소스 사용
  const orderLookupQuery = useQuery({
    queryKey: ["shipments-unshipped", debouncedQuery, onlyReadyToShip],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");

      let query = schemaClient
        .from("cms_v_unshipped_order_lines")
        .select("*")
        .order("status_sort_order", { ascending: true })
        .order("queue_sort_date", { ascending: true })
        .limit(500);

      // 검색어가 있으면 모델명이나 고객명으로 필터링
      if (debouncedQuery) {
        query = query.or(`model_name.ilike.%${debouncedQuery}%,customer_name.ilike.%${debouncedQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log("[DEBUG] cms_v_unshipped_order_lines response:", data?.length, "rows");
      console.log("[DEBUG] Sample statuses:", data?.slice(0, 5).map((r: OrderLookupRow) => r.status));

      return (data ?? []) as OrderLookupRow[];
    },
  });
  const orderLookupErrorMessage = (orderLookupQuery.error as { message?: string } | null)?.message ?? "조회 실패";

  const lookupOrderLineIds = useMemo(
    () => (orderLookupQuery.data ?? []).map((row) => row.order_line_id).filter(Boolean),
    [orderLookupQuery.data]
  );

  const orderLineModelQuery = useQuery({
    queryKey: ["order-lookup-models", lookupOrderLineIds],
    enabled: Boolean(schemaClient) && lookupOrderLineIds.length > 0,
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select("order_line_id, model_name, suffix, material_code")
        .in("order_line_id", lookupOrderLineIds);
      if (error) throw error;
      return (data ?? []) as OrderLineModelRow[];
    },
  });

  const orderLineModelMap = useMemo(() => {
    const map = new Map<string, { model_name?: string | null; suffix?: string | null; material_code?: string | null }>();
    (orderLineModelQuery.data ?? []).forEach((row) => {
      if (!row.order_line_id) return;
      map.set(row.order_line_id, {
        model_name: row.model_name ?? null,
        suffix: row.suffix ?? null,
        material_code: row.material_code ?? null,
      });
    });
    return map;
  }, [orderLineModelQuery.data]);

  const orderLookupModelQuery = useQuery({
    queryKey: ["order-lookup-models-view", lookupOrderLineIds],
    enabled: Boolean(schemaClient) && lookupOrderLineIds.length > 0,
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.orderLookup)
        .select("order_line_id, model_no")
        .in("order_line_id", lookupOrderLineIds);
      if (error) throw error;
      return (data ?? []) as OrderLookupModelRow[];
    },
  });

  const orderLookupModelMap = useMemo(() => {
    const map = new Map<string, string | null>();
    (orderLookupModelQuery.data ?? []).forEach((row) => {
      if (!row.order_line_id) return;
      map.set(row.order_line_id, row.model_no ?? null);
    });
    return map;
  }, [orderLookupModelQuery.data]);

  const storePickupLookupQuery = useQuery<StorePickupLookupRow[]>({
    queryKey: ["order-lookup-store-pickup", lookupOrderLineIds],
    enabled: Boolean(schemaClient) && lookupOrderLineIds.length > 0,
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      console.log("[DEBUG] storePickupLookupQuery - lookupOrderLineIds:", lookupOrderLineIds);
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select("order_line_id, shipment_header:cms_shipment_header!inner(is_store_pickup)")
        .in("order_line_id", lookupOrderLineIds)
        .eq("shipment_header.is_store_pickup", true);
      if (error) throw error;
      const rows = (data ?? []) as StorePickupLookupRow[];
      console.log("[DEBUG] storePickupLookupQuery result:", rows.length, "store pickup rows");
      console.log("[DEBUG] storePickupLookupQuery order_line_ids:", rows.map((r) => r.order_line_id));
      return rows;
    },
  });

  const storePickupLookupIds = useMemo(() => {
    const rows = (storePickupLookupQuery.data ?? []) as StorePickupLookupRow[];
    return new Set(
      rows
        .map((row) => row.order_line_id ?? "")
        .filter((value) => Boolean(value))
    );
  }, [storePickupLookupQuery.data]);

  const prefillQuery = useQuery({
    queryKey: ["shipment-prefill", selectedOrderLineId],
    enabled: Boolean(selectedOrderLineId),
    queryFn: async () => {
      const id = String(selectedOrderLineId);
      const rows = await readView<ShipmentPrefillRow>(CONTRACTS.views.shipmentPrefill, 1, {
        filter: { column: "order_line_id", op: "eq", value: id },
      });
      return rows?.[0] ?? null;
    },
  });

  const orderLineDetailQuery = useQuery({
    queryKey: ["order-line-detail", selectedOrderLineId],
    enabled: Boolean(schemaClient && selectedOrderLineId),
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const orderLineId = String(selectedOrderLineId);
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select(
          "order_line_id, matched_master_id, model_name, model_name_raw, color, size, qty, is_plated, center_stone_name, center_stone_qty, center_stone_source, sub1_stone_name, sub1_stone_qty, sub1_stone_source, sub2_stone_name, sub2_stone_qty, sub2_stone_source, requested_due_date, priority_code, memo, status, source_channel, material_code, selected_base_weight_g, selected_deduction_weight_g, selected_net_weight_g, selected_labor_base_sell_krw, selected_labor_other_sell_krw, selected_inventory_move_line_id, selected_inventory_location_code, selected_inventory_bin_code, match_state, created_at, updated_at"
        )
        .eq("order_line_id", orderLineId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OrderLineDetailRow | null;
    },
  });

  const receiptMatchPrefillQuery = useQuery({
    queryKey: ["shipment-receipt-prefill", selectedOrderLineId],
    enabled: Boolean(selectedOrderLineId),
    queryFn: async () => {
      const id = String(selectedOrderLineId);
      const res = await fetch(`/api/shipment-receipt-prefill?order_line_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "shipment receipt prefill failed");
      return (json?.data ?? null) as ReceiptMatchPrefillRow | null;
    },
  });

  const isInventoryIssueSource = useMemo(
    () => Boolean(orderLineDetailQuery.data?.selected_inventory_move_line_id),
    [orderLineDetailQuery.data?.selected_inventory_move_line_id]
  );

  useEffect(() => {
    if (!selectedOrderLineId) return;
    if ((selectedOrderMaterialCode ?? "").trim()) return;

    const fromModelMap = orderLineModelMap.get(String(selectedOrderLineId))?.material_code ?? null;
    const fromDetail = orderLineDetailQuery.data?.material_code ?? null;
    const fromReceipt = receiptMatchPrefillQuery.data?.selected_material_code ?? null;
    const next = [fromModelMap, fromDetail, fromReceipt]
      .map((v) => String(v ?? "").trim())
      .find((v) => v.length > 0);
    if (next) setSelectedOrderMaterialCode(next);
  }, [
    orderLineDetailQuery.data?.material_code,
    orderLineModelMap,
    receiptMatchPrefillQuery.data?.selected_material_code,
    selectedOrderLineId,
    selectedOrderMaterialCode,
  ]);

  const hasReceiptDeduction = useMemo(() => {
    const value = receiptMatchPrefillQuery.data?.receipt_deduction_weight_g;
    return value !== null && value !== undefined;
  }, [receiptMatchPrefillQuery.data?.receipt_deduction_weight_g]);

  useEffect(() => {
    if (prefillQuery.data) {
      console.log("[Prefill Data] Loaded:", prefillQuery.data);
      console.log("[Prefill Data] photo_url:", prefillQuery.data.photo_url);
      setPrefill(prefillQuery.data);
    }
  }, [prefillQuery.data]);

  useEffect(() => {
    const data = receiptMatchPrefillQuery.data;
    if (!data) return;
    if (!selectedOrderLineId) return;

    const receiptWeight = data.receipt_weight_g ?? data.selected_weight_g;
    if (receiptWeight !== null && receiptWeight !== undefined) {
      setWeightG(String(receiptWeight));
    }
    if (data.receipt_deduction_weight_g !== null && data.receipt_deduction_weight_g !== undefined) {
      setDeductionWeightG(String(data.receipt_deduction_weight_g));
      setApplyMasterDeductionWhenEmpty(false);
    } else {
      setApplyMasterDeductionWhenEmpty(true);
    }
    const receiptBaseCost =
      data.selected_factory_labor_basic_cost_krw ??
      data.receipt_labor_basic_cost_krw ??
      null;
    if (data.shipment_base_labor_krw !== null && data.shipment_base_labor_krw !== undefined) {
      setBaseLabor(String(data.shipment_base_labor_krw));
    } else if (receiptBaseCost !== null && receiptBaseCost !== undefined) {
      setBaseLabor(String(receiptBaseCost));
    }

    const normalizedStoneLabor = (() => {
      const direct = Number(data.stone_labor_krw ?? 0);
      if (Number.isFinite(direct) && direct > 0) return direct;
      const centerQty = Number(data.stone_center_qty ?? 0);
      const sub1Qty = Number(data.stone_sub1_qty ?? 0);
      const sub2Qty = Number(data.stone_sub2_qty ?? 0);
      const centerUnit = Number(data.stone_center_unit_cost_krw ?? 0);
      const sub1Unit = Number(data.stone_sub1_unit_cost_krw ?? 0);
      const sub2Unit = Number(data.stone_sub2_unit_cost_krw ?? 0);
      const byReceipt =
        Math.max(centerQty, 0) * Math.max(centerUnit, 0) +
        Math.max(sub1Qty, 0) * Math.max(sub1Unit, 0) +
        Math.max(sub2Qty, 0) * Math.max(sub2Unit, 0);
      if (byReceipt > 0) return byReceipt;
      return extractStoneLaborAmount(data.shipment_extra_labor_items);
    })();

    const etcFromItems = extractEtcLaborAmount(data.shipment_extra_labor_items);
    if (etcFromItems > 0) {
      setOtherLaborCost(String(etcFromItems));
    } else if (data.shipment_extra_labor_krw !== null && data.shipment_extra_labor_krw !== undefined) {
      const shipmentExtraTotal = Number(data.shipment_extra_labor_krw ?? 0);
      const etcOnly = Math.max(shipmentExtraTotal - normalizedStoneLabor, 0);
      setOtherLaborCost(String(etcOnly));
    } else if (data.selected_factory_labor_other_cost_krw !== null && data.selected_factory_labor_other_cost_krw !== undefined) {
      const receiptOther = Number(data.selected_factory_labor_other_cost_krw ?? 0);
      setOtherLaborCost(String(Math.max(receiptOther, 0)));
    } else if (data.receipt_labor_other_cost_krw !== null && data.receipt_labor_other_cost_krw !== undefined) {
      const receiptOther = Number(data.receipt_labor_other_cost_krw ?? 0);
      setOtherLaborCost(String(Math.max(receiptOther, 0)));
    }

    const normalizedItems = normalizeExtraLaborItems(data.shipment_extra_labor_items);
    if (normalizedItems.length > 0) {
      setExtraLaborItems(normalizedItems);
    } else {
      const amount = String(extractStoneLaborAmount(data.shipment_extra_labor_items));
      if (amount && Number(amount) > 0) {
        setExtraLaborItems([
          {
            id: `prefill-stone-labor-${selectedOrderLineId}`,
            type: "STONE_LABOR",
            label: "알공임",
            amount,
          },
        ]);
      }
    }

    setPrefillHydratedOrderLineId(selectedOrderLineId);
  }, [receiptMatchPrefillQuery.data, selectedOrderLineId]);

  useEffect(() => {
    if (!selectedOrderLineId) return;
    if (prefillHydratedOrderLineId === selectedOrderLineId) return;
    if (!receiptMatchPrefillQuery.isFetched) return;
    if (receiptMatchPrefillQuery.data) return;

    const detail = orderLineDetailQuery.data;
    if (!detail) return;

    if (detail.selected_base_weight_g !== null && detail.selected_base_weight_g !== undefined) {
      setWeightG(String(detail.selected_base_weight_g));
    }

    if (detail.selected_deduction_weight_g !== null && detail.selected_deduction_weight_g !== undefined) {
      setDeductionWeightG(String(detail.selected_deduction_weight_g));
      setApplyMasterDeductionWhenEmpty(false);
    }

    if (detail.selected_labor_base_sell_krw !== null && detail.selected_labor_base_sell_krw !== undefined) {
      setBaseLabor(String(detail.selected_labor_base_sell_krw));
    }

    if (detail.selected_labor_other_sell_krw !== null && detail.selected_labor_other_sell_krw !== undefined) {
      setOtherLaborCost(String(detail.selected_labor_other_sell_krw));
    }

    setPrefillHydratedOrderLineId(selectedOrderLineId);
  }, [
    orderLineDetailQuery.data,
    prefillHydratedOrderLineId,
    receiptMatchPrefillQuery.data,
    receiptMatchPrefillQuery.isFetched,
    selectedOrderLineId,
  ]);

  // ✅ 선택된 주문의 model_no로 마스터 정보 조회
  const masterLookupQuery = useQuery({
    queryKey: ["master-lookup", prefill?.model_no],
    enabled: Boolean(prefill?.model_no),
    queryFn: async () => {
      const model = String(prefill?.model_no ?? "");
      const rows = await readView<MasterLookupRow>(CONTRACTS.views.masterItemLookup, 1, {
        filter: { column: "model_name", op: "eq", value: model },
      });
      return rows?.[0] ?? null;
    },
  });

  const matchedMasterPricingQuery = useQuery({
    queryKey: ["matched-master-pricing", orderLineDetailQuery.data?.matched_master_id],
    enabled: Boolean(schemaClient && orderLineDetailQuery.data?.matched_master_id),
    queryFn: async () => {
      if (!schemaClient || !orderLineDetailQuery.data?.matched_master_id) return null;
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select(
          "master_id, labor_base_sell, labor_base_cost, labor_center, labor_center_cost, labor_side1, labor_sub1_cost, labor_side2, labor_sub2_cost, center_qty_default, sub1_qty_default, sub2_qty_default"
        )
        .eq("master_id", orderLineDetailQuery.data.matched_master_id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MasterLookupRow | null;
    },
  });

  const roundingUnitQuery = useQuery({
    queryKey: ["rule-rounding-unit"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return 0;
      const { data, error } = await schemaClient
        .from("cms_market_tick_config")
        .select("rule_rounding_unit_krw")
        .eq("config_key", "DEFAULT")
        .maybeSingle();
      if (error) return 0;
      const row = data as { rule_rounding_unit_krw?: number | null } | null;
      return Number(row?.rule_rounding_unit_krw ?? 0);
    },
  });

  const receiptVendorInitials = useMemo(
    () => getVendorInitials(masterLookupQuery.data?.vendor_name),
    [masterLookupQuery.data?.vendor_name]
  );

  const selectedOrderSuffix = useMemo(() => {
    if (!selectedOrderLineId) return null;
    return orderLineModelMap.get(String(selectedOrderLineId))?.suffix ?? null;
  }, [orderLineModelMap, selectedOrderLineId]);

  const resolvedVariantKey = useMemo(
    () =>
      buildVariantKey(
        selectedOrderSuffix,
        orderLineDetailQuery.data?.color ?? prefill?.color ?? null,
        orderLineDetailQuery.data?.size ?? prefill?.size ?? null
      ),
    [orderLineDetailQuery.data?.color, orderLineDetailQuery.data?.size, prefill?.color, prefill?.size, selectedOrderSuffix]
  );

  const effectiveMasterId = useMemo(
    () =>
      normalizeId(orderLineDetailQuery.data?.matched_master_id) ??
      normalizeId(masterLookupQuery.data?.master_id) ??
      normalizeId(masterLookupQuery.data?.master_item_id),
    [masterLookupQuery.data?.master_id, masterLookupQuery.data?.master_item_id, orderLineDetailQuery.data?.matched_master_id]
  );

  const effectiveMasterKindQuery = useQuery({
    queryKey: ["effective-master-kind", effectiveMasterId],
    enabled: Boolean(schemaClient && effectiveMasterId),
    queryFn: async () => {
      if (!schemaClient || !effectiveMasterId) return null;
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("master_id, master_kind")
        .eq("master_id", effectiveMasterId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { master_id: string; master_kind: string } | null;
    },
  });

  const isEffectiveBundle = effectiveMasterKindQuery.data?.master_kind === "BUNDLE";

  const effectiveQty = useMemo(() => {
    const detailQty = Number(orderLineDetailQuery.data?.qty ?? NaN);
    if (Number.isFinite(detailQty) && detailQty > 0) return detailQty;
    return 1;
  }, [orderLineDetailQuery.data?.qty]);

  // ✅ (필수) 상태 배지 렌더러 - map에서 사용 중인데 기존 코드엔 없어서 런타임 에러 났을 가능성 큼
  const getOrderStatusBadge = (status?: string | null) => {
    const s = (status ?? "").trim();

    const configs: Record<string, { tone: "neutral" | "active" | "warning" | "danger" | "primary"; label: string }> = {
      ORDER_PENDING: { tone: "warning", label: "주문대기" },
      SENT_TO_VENDOR: { tone: "neutral", label: "공장발주" },
      WAITING_INBOUND: { tone: "neutral", label: "입고대기" },
      READY_TO_SHIP: { tone: "active", label: "출고대기" },
      SHIPPED: { tone: "primary", label: "출고완료" },
      CLOSED: { tone: "neutral", label: "마감" },
      CANCELLED: { tone: "danger", label: "취소" },
    };

    const cfg = configs[s] ?? { tone: "neutral" as const, label: s || "-" };
    return (
      <Badge tone={cfg.tone} className="text-[10px] px-1 py-0 h-4">
        {cfg.label}
      </Badge>
    );
  };

  const PENDING_ORDER_STATUSES = new Set([
    "SENT_TO_VENDOR",
    "READY_TO_SHIP",
  ]);

  const isWorklistStatus = (status?: string | null) => {
    const s = (status ?? "").trim();
    if (!s) return true; // status 비어있으면 일단 워크리스트에 노출
    return PENDING_ORDER_STATUSES.has(s);
  };

  const filteredLookupRows = useMemo(() => {
    let rows = orderLookupQuery.data ?? [];
    console.log("[DEBUG] orderLookupQuery.data:", rows.length, "rows");
    console.log("[DEBUG] order_line_ids:", rows.map(r => r.order_line_id));
    console.log("[DEBUG] onlyReadyToShip:", onlyReadyToShip);
    console.log("[DEBUG] includeStorePickup:", includeStorePickup);
    console.log("[DEBUG] storePickupLookupQuery.isLoading:", storePickupLookupQuery.isLoading);
    console.log("[DEBUG] storePickupLookupIds:", Array.from(storePickupLookupIds));

    // storePickupLookupQuery가 로딩 완료된 후에만 store pickup 필터링 적용
    if (!includeStorePickup && !storePickupLookupQuery.isLoading) {
      const beforeCount = rows.length;
      const removedIds = rows.filter((row) => storePickupLookupIds.has(row.order_line_id ?? "")).map(r => r.order_line_id);
      console.log("[DEBUG] Removed order_line_ids (store pickup):", removedIds);
      rows = rows.filter((row) => !storePickupLookupIds.has(row.order_line_id ?? ""));
      console.log("[DEBUG] After store pickup filter:", rows.length, "/", beforeCount);
    }

    const byOldestOrderDate = (list: OrderLookupRow[]) =>
      [...list].sort((a, b) => {
        const aId = String(a.order_line_id ?? "");
        const bId = String(b.order_line_id ?? "");
        const aDemoted = longPendingDemoteIds.has(aId);
        const bDemoted = longPendingDemoteIds.has(bId);
        if (aDemoted !== bDemoted) return aDemoted ? 1 : -1;

        const aDate = Date.parse(String(a.sent_to_vendor_at ?? a.order_date ?? ""));
        const bDate = Date.parse(String(b.sent_to_vendor_at ?? b.order_date ?? ""));
        const aTs = Number.isFinite(aDate) ? aDate : Number.POSITIVE_INFINITY;
        const bTs = Number.isFinite(bDate) ? bDate : Number.POSITIVE_INFINITY;
        return aTs - bTs;
      });

    if (!onlyReadyToShip) {
      console.log("[DEBUG] Returning all rows (onlyReadyToShip=false):", rows.length);
      return byOldestOrderDate(rows);
    }

    const filtered = rows.filter((r) => isWorklistStatus(r.status));
    console.log("[DEBUG] After isWorklistStatus filter:", filtered.length);
    console.log("[DEBUG] PENDING_ORDER_STATUSES:", Array.from(PENDING_ORDER_STATUSES));
    console.log("[DEBUG] All statuses in data:", [...new Set(rows.map(r => r.status))]);
    return byOldestOrderDate(filtered);
  }, [orderLookupQuery.data, includeStorePickup, storePickupLookupIds, onlyReadyToShip, storePickupLookupQuery.isLoading, longPendingDemoteIds]);

  const handleSelectOrder = (row: OrderLookupRow) => {
    const id = row.order_line_id;
    if (!id) return;

    setSelectedOrderLineId(String(id));
    setPrefillHydratedOrderLineId(null);
    setSelectedOrderStatus(row.status ? String(row.status) : null);
    setSelectedOrderDates({
      orderDate: row.sent_to_vendor_at ?? row.order_date ?? null,
      inboundDate: row.inbound_at ?? null,
    });
    setSelectedOrderMaterialCode(row.material_code ?? orderLineModelMap.get(String(id))?.material_code ?? null);
    setSearchQuery(`${row.model_name ?? row.model_no ?? ""} ${row.customer_name ?? row.client_name ?? ""}`.trim());
    setLookupOpen(false);

    setWeightG("");
    setDeductionWeightG("");
    setApplyMasterDeductionWhenEmpty(true);
    setBaseLabor("");
    setOtherLaborCost("");
    setManualTotalAmountKrw("");
    setIsManualTotalOverride(false);
    setManualLabor("");
    setUseManualLabor(false);
    setExtraLaborItems([]);
  };

  // --- RPC: 출고 저장 ---
  const normalizedShipmentId = useMemo(() => normalizeId(currentShipmentId), [currentShipmentId]);

  const currentLinesQuery = useQuery({
    queryKey: ["shipment-lines", normalizedShipmentId, confirmModalOpen],
    enabled: Boolean(normalizedShipmentId) && confirmModalOpen,
    queryFn: async () => {
      const shipmentId = normalizedShipmentId;
      if (!shipmentId) return [];
      return readView<ShipmentLineRow>("cms_shipment_line", 50, {
        filter: { column: "shipment_id", op: "eq", value: shipmentId },
        orderBy: { column: "created_at", ascending: false },
      });
    },
  });

  const currentLine = useMemo(() => {
    if (!currentShipmentLineId) return null;
    return (currentLinesQuery.data ?? []).find(
      (item) => String(item.shipment_line_id) === String(currentShipmentLineId)
    ) ?? null;
  }, [currentLinesQuery.data, currentShipmentLineId]);

  const masterUnitPricingQuery = useQuery({
    queryKey: ["master-unit-pricing", currentLine?.master_id],
    enabled: Boolean(schemaClient && currentLine?.master_id),
    queryFn: async () => {
      if (!schemaClient || !currentLine?.master_id) return null;
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("is_unit_pricing")
        .eq("master_id", currentLine.master_id)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as { is_unit_pricing?: boolean | null } | null;
    },
  });

  useEffect(() => {
    if (!confirmModalOpen) return;
    if (!currentLine) return;

    const hasReceiptPrefillForSelected =
      Boolean(receiptMatchPrefillQuery.data) &&
      Boolean(selectedOrderLineId) &&
      prefillHydratedOrderLineId === selectedOrderLineId;

    if (!hasReceiptPrefillForSelected && currentLine.measured_weight_g !== null && currentLine.measured_weight_g !== undefined) {
      setWeightG(String(currentLine.measured_weight_g));
    }
    if (!hasReceiptPrefillForSelected && currentLine.deduction_weight_g !== null && currentLine.deduction_weight_g !== undefined) {
      setDeductionWeightG(String(currentLine.deduction_weight_g));
      if (hasReceiptDeduction) setApplyMasterDeductionWhenEmpty(false);
    } else if (!hasReceiptDeduction && !hasReceiptPrefillForSelected) {
      setApplyMasterDeductionWhenEmpty(true);
    }
    if (!hasReceiptPrefillForSelected && currentLine.base_labor_krw !== null && currentLine.base_labor_krw !== undefined) {
      setBaseLabor(String(currentLine.base_labor_krw));
    }
    if (currentLine.manual_labor_krw !== null && currentLine.manual_labor_krw !== undefined) {
      setManualLabor(String(currentLine.manual_labor_krw));
    }
    if (!hasReceiptPrefillForSelected && currentLine.extra_labor_items !== null && currentLine.extra_labor_items !== undefined) {
      setExtraLaborItems(normalizeExtraLaborItems(currentLine.extra_labor_items));
    } else if (!hasReceiptPrefillForSelected && currentLine.extra_labor_krw !== null && currentLine.extra_labor_krw !== undefined) {
      setOtherLaborCost(String(currentLine.extra_labor_krw ?? ""));
    }

    if (currentLine.pricing_mode === "AMOUNT_ONLY" && currentLine.manual_total_amount_krw !== null && currentLine.manual_total_amount_krw !== undefined) {
      setIsManualTotalOverride(true);
      setManualTotalAmountKrw(String(currentLine.manual_total_amount_krw));
    } else {
      setIsManualTotalOverride(false);
      setManualTotalAmountKrw("");
    }
  }, [
    confirmModalOpen,
    currentLine,
    hasReceiptDeduction,
    prefillHydratedOrderLineId,
    receiptMatchPrefillQuery.data,
    selectedOrderLineId,
  ]);

  const shipmentHeaderQuery = useQuery({
    queryKey: ["shipment-header", normalizedShipmentId, confirmModalOpen, isStorePickup],
    enabled: Boolean(normalizedShipmentId),
    queryFn: async () => {
      const shipmentId = normalizedShipmentId;
      if (!shipmentId) return null;
      const sb = getSchemaClient();
      if (!sb) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (sb as any)
        .from("cms_shipment_header")
        .select("is_store_pickup, pricing_locked_at, pricing_source, confirmed_at, status, source_location_code, source_bin_code")
        .eq("shipment_id", shipmentId);

      if (isStorePickup) {
        query = query.eq("is_store_pickup", true);
      } else {
        query = query.and(`shipment_id.eq.${shipmentId},or(is_store_pickup.is.null,is_store_pickup.eq.false)`);
      }

      const { data } = await query.maybeSingle();
      return (data ?? null) as ShipmentHeaderRow | null;
    },
  });

  const locationBinQuery = useQuery({
    queryKey: ["shipment-location-bin"],
    queryFn: async () => {
      const sb = getSchemaClient();
      if (!sb) return [] as LocationBinRow[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb as any)
        .from(CONTRACTS.views.inventoryLocationBins)
        .select("bin_code, location_code, bin_name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("bin_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LocationBinRow[];
    },
  });

  const effectiveSourceLocationCode = isStorePickup ? "STORE" : "OFFICE";

  const sourceBinOptions = useMemo(
    () =>
      (locationBinQuery.data ?? [])
        .filter((row) => String(row.location_code ?? "") === effectiveSourceLocationCode)
        .map((row) => ({
          value: String(row.bin_code ?? ""),
          label: `${row.bin_name ?? row.bin_code} (${row.bin_code})`,
        })),
    [locationBinQuery.data, effectiveSourceLocationCode]
  );

  useEffect(() => {
    if (!sourceBinCode) return;
    if (sourceBinOptions.some((option) => option.value === sourceBinCode)) return;
    setSourceBinCode("");
  }, [sourceBinCode, sourceBinOptions]);

  const shipmentValuationQuery = useQuery({
    queryKey: ["shipment-valuation", normalizedShipmentId, confirmModalOpen],
    enabled: Boolean(normalizedShipmentId) && confirmModalOpen,
    queryFn: async () => {
      const shipmentId = normalizedShipmentId;
      if (!shipmentId) return null;
      const sb = getSchemaClient();
      if (!sb) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from("cms_shipment_valuation")
        .select(
          "pricing_locked_at, pricing_source, gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot, material_value_krw, labor_value_krw, total_value_krw"
        )
        .eq("shipment_id", shipmentId)
        .maybeSingle();
      return (data ?? null) as ShipmentValuationRow | null;
    },
  });

  useEffect(() => {
    if (!confirmModalOpen) return;
    const header = shipmentHeaderQuery.data;
    if (!header) return;
    setIsStorePickup(Boolean(header.is_store_pickup));
    setSourceBinCode(String(header.source_bin_code ?? ""));
  }, [confirmModalOpen, shipmentHeaderQuery.data]);

  const orderHasVariation = useMemo(
    () =>
      hasVariationTag(orderLineDetailQuery.data?.memo) ||
      hasVariationTag(prefill?.note),
    [orderLineDetailQuery.data?.memo, prefill?.note]
  );

  useEffect(() => {
    if (!selectedOrderLineId) {
      setIsVariationMode(false);
      return;
    }
    if (orderHasVariation) {
      setIsVariationMode(true);
    }
  }, [orderHasVariation, selectedOrderLineId]);

  useEffect(() => {
    const variationItem = extraLaborItems.find((item) => item.type === EXTRA_TYPE_CUSTOM_VARIATION);
    const vendorDeltaItem = extraLaborItems.find((item) => item.type === EXTRA_TYPE_VENDOR_DELTA);

    setVariationNote(String((variationItem?.meta as Record<string, unknown> | null)?.note ?? ""));
    setVendorDeltaAmount(vendorDeltaItem ? String(vendorDeltaItem.amount ?? "") : "");
    setVendorDeltaReason(
      String((vendorDeltaItem?.meta as Record<string, unknown> | null)?.reason ?? "ERROR").toUpperCase() ===
        "POLICY"
        ? "POLICY"
        : "ERROR"
    );
    setVendorDeltaNote(String((vendorDeltaItem?.meta as Record<string, unknown> | null)?.note ?? ""));
  }, [extraLaborItems]);

  useEffect(() => {
    setStoneAdjustmentReason((prev) => (isVariationMode ? "VARIANT" : prev === "VARIANT" ? "FACTORY_MISTAKE" : prev));
  }, [isVariationMode]);

  useEffect(() => {
    const stoneItem = extraLaborItems.find((item) => item.type === "STONE_LABOR");
    if (!stoneItem) return;
    const meta = (stoneItem.meta as Record<string, unknown> | null) ?? null;
    const recommended = Number(meta?.recommended ?? 0);
    const adjustment = Number(meta?.adjustment ?? Number(stoneItem.amount ?? 0) - recommended);
    if (Number.isFinite(adjustment)) {
      setStoneAdjustmentAmount(String(adjustment));
    }
    const reasonRaw = String(meta?.adjustment_reason ?? "").toUpperCase();
    if (reasonRaw === "FACTORY_MISTAKE" || reasonRaw === "PRICE_UP" || reasonRaw === "VARIANT" || reasonRaw === "OTHER") {
      setStoneAdjustmentReason(reasonRaw as StoneAdjustmentReason);
    }
    const note = String(meta?.adjustment_note ?? "");
    if (note) setStoneAdjustmentNote(note);
  }, [selectedOrderLineId]);

  const shipmentUpsertMutation = useRpcMutation<ShipmentUpsertResult>({
    fn: CONTRACTS.functions.shipmentUpsertFromOrder,
    successMessage: "출고 확정 준비",
  });

  const shipmentLineUpdateMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentUpdateLine,
  });

  const shipmentSetStorePickupMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentSetStorePickup,
    successMessage: "매장출고 지정 완료",
  });

  const shipmentSetSourceLocationMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentSetSourceLocation,
  });

  const arInvoiceResyncMutation = useRpcMutation<ArResyncResult>({
    fn: CONTRACTS.functions.arInvoiceResyncFromShipment,
    onSuccess: (result) => {
      const updated = result?.updated ?? 0;
      const inserted = result?.inserted ?? 0;
      toast.success(`AR 재계산 완료 (updated=${updated}, inserted=${inserted})`);
    },
  });

  // ✅ 영수증 “연결” upsert
  const receiptUsageUpsertMutation = useRpcMutation<unknown>({
    fn: FN_RECEIPT_USAGE_UPSERT,
    successMessage: "영수증 연결 완료",
  });


  const handleSaveShipment = async () => {
    const shouldStorePickup = isStorePickup;
    const resolvedSourceLocation = shouldStorePickup ? "STORE" : "OFFICE";
    const resolvedSourceBin = sourceBinCode.trim();
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", {
        description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요.",
      });
      return;
    }
    if (!selectedOrderLineId) {
      toast.error("주문(출고대기)을 먼저 선택해주세요.");
      return;
    }
    const materialCode =
      (receiptMatchPrefillQuery.data?.selected_material_code ?? masterLookupQuery.data?.material_code_default ?? "").trim();
    const allowZeroWeight = materialCode === "00";
    const weightText = weightG.trim();
    let weightValue = parseNumberInput(weightG);
    if (allowZeroWeight && (weightText === "" || weightValue === 0)) {
      weightValue = 0;
    }
    const baseValue = parseNumberInput(baseLabor);
    const laborValue = resolvedTotalLabor;
    const manualLaborBase = useManualLabor ? laborValue - resolvedExtraLaborTotal : null;
    const deductionText = deductionWeightG ?? "";
    const masterDeduct = Number(masterLookupQuery.data?.deduction_weight_default_g ?? 0);
    const useMasterDeductionFallback = !hasReceiptDeduction && applyMasterDeductionWhenEmpty;
    const deductionValue = resolveDeductionValue(deductionText, masterDeduct, useMasterDeductionFallback);
    if (Number.isNaN(weightValue) || (allowZeroWeight ? weightValue < 0 : weightValue <= 0)) {
      toast.error("중량(g)을 올바르게 입력해주세요.");
      return;
    }
    if (!Number.isFinite(deductionValue) || deductionValue < 0) {
      toast.error("차감중량(g)을 올바르게 입력해주세요.");
      return;
    }
    if (deductionValue > weightValue) {
      toast.error("차감중량은 중량보다 클 수 없습니다.");
      return;
    }
    if (!Number.isFinite(baseValue) || baseValue < 0) {
      toast.error("기본 공임(원)을 올바르게 입력해주세요.");
      return;
    }
    if (useManualLabor) {
      const manualValue = parseNumberInput(manualLabor);
      if (!Number.isFinite(manualValue) || manualValue < 0) {
        toast.error("직접 공임(원)을 올바르게 입력해주세요.");
        return;
      }
      if (manualLaborBase !== null && manualLaborBase < 0) {
        toast.error("직접 공임이 기타/알공임 합계보다 작습니다.");
        return;
      }
    }
    const invalidExtra = extraLaborItems.find((item) => {
      if (item.amount.trim() === "") return false;
      const normalized = item.amount.replaceAll(",", "").trim();
      if (!normalized) return false;
      const value = Number(normalized);
      if (!Number.isFinite(value)) return true;
      if (item.type === EXTRA_TYPE_VENDOR_DELTA || item.type === EXTRA_TYPE_ADJUSTMENT) return false;
      return value < 0;
    });
    if (invalidExtra) {
      toast.error("기타 공임 금액을 올바르게 입력해주세요.");
      return;
    }

    const result = await shipmentUpsertMutation.mutateAsync({
      p_order_line_id: selectedOrderLineId,
      p_weight_g: weightValue,
      p_deduction_weight_g: deductionValue,
      p_total_labor: laborValue,
      p_base_labor_krw:
        manualLaborBase !== null
          ? manualLaborBase
          : Number.isFinite(baseValue)
            ? baseValue
            : 0,
      p_extra_labor_krw: resolvedExtraLaborTotal,
      p_extra_labor_items: extraLaborPayload,
      p_actor_person_id: actorId,
      p_idempotency_key: idempotencyKey,
    });

    const shipmentId = normalizeId(result?.shipment_id);
    if (!shipmentId) {
      toast.error("출고 확정 실패", { description: "shipment_id를 받지 못했습니다." });
      return;
    }

    if (!schemaClient) {
      toast.error("Supabase env is missing");
      return;
    }

    const { data: lineRow, error: lineError } = await schemaClient
      .from("cms_shipment_line")
      .select("shipment_line_id, material_amount_sell_krw")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lineError) {
      toast.error("출고 라인 조회 실패", { description: lineError.message });
      return;
    }
    const lineData =
      (lineRow ?? null) as { shipment_line_id?: string | null; material_amount_sell_krw?: number | null } | null;
    const shipmentLineId = lineData?.shipment_line_id ? String(lineData.shipment_line_id) : null;
    if (!shipmentLineId) {
      toast.error("출고 확정 실패", { description: "shipment_line_id를 찾지 못했습니다." });
      return;
    }

    const manualTotalValue = isManualTotalOverride ? parseNumberInput(manualTotalAmountKrw) : 0;
    const materialAmount = Number(lineData?.material_amount_sell_krw ?? 0);
    const baseLaborOverride = isManualTotalOverride && manualTotalValue > 0
      ? manualTotalValue - materialAmount - resolvedExtraLaborTotal
      : null;
    if (isManualTotalOverride && manualTotalValue <= 0) {
      toast.error("총액 덮어쓰기 금액을 입력해주세요.");
      return;
    }
    if (baseLaborOverride !== null && baseLaborOverride < 0) {
      toast.error("총액이 재료비보다 작습니다.");
      return;
    }

    const updatePayload: Record<string, unknown> = {
      p_shipment_line_id: shipmentLineId,
      p_deduction_weight_g: deductionValue,
      p_base_labor_krw:
        baseLaborOverride !== null
          ? baseLaborOverride
          : manualLaborBase !== null
            ? manualLaborBase
            : Number.isFinite(baseValue)
              ? baseValue
              : 0,
      p_extra_labor_krw: resolvedExtraLaborTotal,
      p_extra_labor_items: extraLaborPayload,
      p_pricing_mode: isManualTotalOverride ? "AMOUNT_ONLY" : "RULE",
      p_manual_total_amount_krw: isManualTotalOverride ? manualTotalValue : null,
    };
    if (weightValue > 0) {
      updatePayload.p_measured_weight_g = weightValue;
    }

    await shipmentLineUpdateMutation.mutateAsync(updatePayload);

    if (shouldStorePickup) {
      await shipmentSetSourceLocationMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_source_location_code: "STORE",
        p_source_bin_code: resolvedSourceBin || null,
        p_actor_person_id: actorId,
        p_note: "set source location from shipments save",
      });
      await shipmentSetStorePickupMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_is_store_pickup: true,
        p_actor_person_id: actorId,
        p_note: "set from shipments confirm",
      });

      // ✅ 영수증 연결 (store pickup)
      const rid = normalizeId(linkedReceiptId);
      if (rid) {
        try {
          await receiptUsageUpsertMutation.mutateAsync({
            p_receipt_id: rid,
            p_entity_type: "SHIPMENT_HEADER",
            p_entity_id: shipmentId,
            p_actor_person_id: actorId,
            p_note: "link from shipments store pickup save",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "영수증 연결 실패";
          toast.error("영수증 연결 실패", { description: msg });
        }
      }

      toast.success("매장출고로 저장 완료", {
        description: "확정(시세 스냅샷)은 Workbench(당일출고)에서 ‘선택 영수증 확정’ 시점에만 진행됩니다.",
      });
      resetShipmentForm({ keepStorePickup: true });
      return;
    }

    await shipmentSetSourceLocationMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_source_location_code: resolvedSourceLocation,
      p_source_bin_code: resolvedSourceBin || null,
      p_actor_person_id: actorId,
      p_note: "set source location from shipments save",
    });

    await confirmMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_actor_person_id: actorId,
      p_note: "confirm from shipments save",
      p_emit_inventory: true,
      p_cost_mode: costMode,
      p_receipt_id: null,
      p_cost_lines: [],
      p_force: false,
    });

    // ✅ 영수증 연결 (normal confirm)
    const rid = normalizeId(linkedReceiptId);
    if (rid) {
      try {
        await receiptUsageUpsertMutation.mutateAsync({
          p_receipt_id: rid,
          p_entity_type: "SHIPMENT_HEADER",
          p_entity_id: shipmentId,
          p_actor_person_id: actorId,
          p_note: "link from shipments confirm",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "영수증 연결 실패";
        toast.error("영수증 연결 실패", { description: msg });
      }
    }
  };

  const displayedLines = useMemo(() => {
    const all = currentLinesQuery.data ?? [];
    if (showAllLines) return all;
    if (!currentShipmentLineId) return all;
    return all.filter((l) => String(l.shipment_line_id) === String(currentShipmentLineId));
  }, [currentLinesQuery.data, showAllLines, currentShipmentLineId]);

  const hasOtherLines = useMemo(() => {
    const all = currentLinesQuery.data ?? [];
    if (!currentShipmentLineId) return false;
    return all.some((l) => String(l.shipment_line_id) !== String(currentShipmentLineId));
  }, [currentLinesQuery.data, currentShipmentLineId]);

  // --- 영수증 목록(선택) ---
  const receiptsQuery = useQuery({
    queryKey: ["receipts", confirmModalOpen],
    enabled: confirmModalOpen,
    queryFn: async () => {
      const res = await fetch("/api/receipts?status=UPLOADED,LINKED&limit=50");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `receipts failed (${res.status})`);
      return (json.data ?? []) as ReceiptRow[];
    },
  });
  const receiptsErrorMessage = (receiptsQuery.error as { message?: string } | null)?.message ?? "영수증 조회 실패";

  // 로컬 프리뷰(업로드 전)
  useEffect(() => {
    if (!confirmModalOpen) return;
    if (!receiptFile) return;

    const objUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewSrc(objUrl);
    setReceiptPreviewOpenUrl(objUrl);
    setReceiptPreviewError(null);

    const isPdf =
      receiptFile.type === "application/pdf" || receiptFile.name.toLowerCase().endsWith(".pdf");
    setReceiptPreviewKind(isPdf ? "pdf" : "image");
    const todayKey = new Date().toISOString().slice(0, 10);
    const baseName = buildReceiptBaseName(todayKey, receiptVendorInitials, 1);
    setReceiptPreviewTitle(baseName);

    return () => URL.revokeObjectURL(objUrl);
  }, [confirmModalOpen, receiptFile, receiptVendorInitials]);

  // 원격 프리뷰(선택/업로드 후): receipt_id 기반
  useEffect(() => {
    if (!confirmModalOpen) return;
    if (receiptFile) return; // 로컬 우선

    if (!linkedReceiptId) {
      setReceiptPreviewSrc(null);
      setReceiptPreviewOpenUrl(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      setReceiptPreviewError(null);
      return;
    }

    const openUrl = `/api/receipt-preview?receipt_id=${encodeURIComponent(linkedReceiptId)}`;
    setReceiptPreviewOpenUrl(openUrl);
    setReceiptPreviewError(null);

    const receipts = receiptsQuery.data ?? [];
    const r = receipts.find((x) => x.receipt_id === linkedReceiptId);
    let title = `receipt-${linkedReceiptId.slice(0, 8)}`;

    if (r) {
      const dateKey = r.received_at.slice(0, 10);
      let index = 1;
      for (const receipt of receipts) {
        if (receipt.receipt_id === linkedReceiptId) break;
        if (receipt.received_at.slice(0, 10) === dateKey) index++;
      }
      title = buildReceiptBaseName(dateKey, receiptVendorInitials, index);
    }
    setReceiptPreviewTitle(title);

    let revoked = false;
    let objUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(openUrl);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `preview failed (${res.status})`);
        }

        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        const isPdf = ct.includes("pdf") || title.toLowerCase().endsWith(".pdf");
        setReceiptPreviewKind(isPdf ? "pdf" : "image");

        const blob = await res.blob();
        objUrl = URL.createObjectURL(blob);

        if (!revoked) {
          setReceiptPreviewSrc(objUrl);
          setReceiptPreviewError(null);
        }
      } catch (error) {
        const err = error as { message?: string } | null;
        if (!revoked) {
          setReceiptPreviewSrc(null);
          setReceiptPreviewKind(null);
          setReceiptPreviewError(err?.message ?? "이미지/PDF 로드 실패(프리뷰 API 응답을 확인하세요).");
        }
      }
    })();

    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [confirmModalOpen, receiptFile, linkedReceiptId, receiptsQuery.data, receiptVendorInitials]);

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      toast.error("업로드할 영수증 파일을 선택해주세요.");
      return;
    }

    setReceiptUploading(true);
    try {
      const fileName = receiptFile.name;
      const isPdf =
        receiptFile.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

      const fd = new FormData();
      fd.append("file0", receiptFile);

      const res = await fetch("/api/receipt-upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; receipt_id?: string; error?: string };

      if (!res.ok || !json?.ok || !json.receipt_id)
        throw new Error(json?.error ?? `upload failed (${res.status})`);

      const rid = String(json.receipt_id);

      setLinkedReceiptId(rid); // effect가 receipt_id로 프리뷰 로드
      setReceiptPreviewTitle(fileName);
      setReceiptPreviewKind(isPdf ? "pdf" : "image");
      setReceiptPreviewError(null);

      setReceiptFile(null);
      setReceiptFileInputKey((k) => k + 1);

      await receiptsQuery.refetch();
      toast.success("영수증 업로드 완료");
    } catch (error) {
      const err = error as { message?: string } | null;
      toast.error("영수증 업로드 실패", { description: err?.message ?? String(error) });
    } finally {
      setReceiptUploading(false);
    }
  };

  const openReceiptInNewTab = () => {
    const url = receiptPreviewOpenUrl || receiptPreviewSrc;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadReceipt = async () => {
    const url = receiptPreviewOpenUrl || receiptPreviewSrc;
    if (!url) return;
    const extension = receiptPreviewKind === "pdf" ? "pdf" : "png";
    const fileName = `${receiptPreviewTitle || "receipt"}.${extension}`;

    try {
      if (receiptPreviewOpenUrl) {
        const res = await fetch(receiptPreviewOpenUrl);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `download failed (${res.status})`);
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(objUrl);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
      }
    } catch (error) {
      const err = error as { message?: string } | null;
      toast.error("영수증 다운로드 실패", { description: err?.message ?? String(error) });
    }
  };

  const resetShipmentForm = (options?: { keepStorePickup?: boolean }) => {
    const keepStorePickup = options?.keepStorePickup ?? false;

    setConfirmModalOpen(false);
    setCurrentShipmentId(null);
    setCurrentShipmentLineId(null);
    setShowAllLines(false);
    setIsStorePickup((prev) => (keepStorePickup ? prev : false));
    setSourceBinCode("");

    setSelectedOrderLineId(null);
    setPrefillHydratedOrderLineId(null);
    setSelectedOrderMaterialCode(null);
    setSelectedOrderStatus(null);
    setPrefill(null);
    setSearchQuery("");
    setDebouncedQuery("");
    setWeightG("");
    setDeductionWeightG("");
    setApplyMasterDeductionWhenEmpty(true);
    setBaseLabor("");
    setExtraLaborItems([]);
    setIsVariationMode(false);
    setVariationNote("");
    setVendorDeltaAmount("");
    setVendorDeltaReason("ERROR");
    setVendorDeltaNote("");
    setStoneAdjustmentAmount("0");
    setStoneAdjustmentReason("FACTORY_MISTAKE");
    setStoneAdjustmentNote("");
    setManualTotalAmountKrw("");
    setCostMode("PROVISIONAL");
    setCostInputs({});

    setLinkedReceiptId(null);
    setReceiptFile(null);
    setReceiptUploading(false);
    setReceiptFileInputKey((k) => k + 1);

    setReceiptPreviewSrc(null);
    setReceiptPreviewOpenUrl(null);
    setReceiptPreviewKind(null);
    setReceiptPreviewTitle("");
    setReceiptPreviewError(null);
    setEffectivePriceData(null);
    setEffectivePriceState(null);
    bundleBlockToastRef.current = null;
  };

  // --- RPC: 출고 확정 ---
  const confirmMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentConfirm,
    successMessage: "출고 확정 완료",
    onSuccess: () => {
      resetShipmentForm();
    },
  });

  const handleFinalConfirm = async () => {
    const shouldStorePickup = isStorePickup;
    const resolvedSourceLocation = shouldStorePickup ? "STORE" : "OFFICE";
    const resolvedSourceBin = sourceBinCode.trim();
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", {
        description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요.",
      });
      return;
    }
    if (isBundlePricingBlocked) {
      toast.error("BOM 오류(확정 불가)", {
        description: bundlePricingBlockMessage,
      });
      return;
    }
    const shipmentId = normalizeId(currentShipmentId);
    if (!shipmentId) return;
    const currentLines = currentLinesQuery.data ?? [];
    const currentLine = currentShipmentLineId
      ? currentLines.find((line) => String(line.shipment_line_id) === String(currentShipmentLineId))
      : null;

    const currentLineId = currentShipmentLineId ? String(currentShipmentLineId) : null;
    const currentLineWeightText = currentLineId ? (weightG ?? "").trim() : "";

    // ✅ 확정 직전, 현재 라인의 차감중량을 한번 더 저장 (모달에서 수정했을 수 있음)
    if (currentShipmentLineId) {
      const dText = deductionWeightG ?? "";
      const masterDeduct = Number(masterLookupQuery.data?.deduction_weight_default_g ?? 0);
      const useMasterDeductionFallback = !hasReceiptDeduction && applyMasterDeductionWhenEmpty;
      const dValue = resolveDeductionValue(dText, masterDeduct, useMasterDeductionFallback);

      if (!Number.isFinite(dValue) || Number.isNaN(dValue) || dValue < 0) {
        toast.error("차감중량(g)을 올바르게 입력해주세요.");
        return;
      }

      const currentWeightValue =
        currentLineWeightText !== ""
          ? Number(currentLineWeightText)
          : Number(currentLine?.measured_weight_g ?? NaN);
      if (Number.isFinite(currentWeightValue) && dValue > currentWeightValue) {
        toast.error("차감중량은 중량보다 클 수 없습니다.");
        return;
      }

      const manualTotalValue = isManualTotalOverride ? parseNumberInput(manualTotalAmountKrw) : 0;
      const materialAmount = Number(currentLine?.material_amount_sell_krw ?? 0);
      const manualLaborBase = useManualLabor ? resolvedTotalLabor - resolvedExtraLaborTotal : null;
      const baseLaborOverride = isManualTotalOverride && manualTotalValue > 0
        ? manualTotalValue - materialAmount - resolvedExtraLaborTotal
        : null;
      if (isManualTotalOverride && manualTotalValue <= 0) {
        toast.error("총액 덮어쓰기 금액을 입력해주세요.");
        return;
      }
      if (baseLaborOverride !== null && baseLaborOverride < 0) {
        toast.error("총액이 재료비보다 작습니다.");
        return;
      }
      if (baseLaborOverride === null && manualLaborBase !== null && manualLaborBase < 0) {
        toast.error("직접 공임이 기타/알공임 합계보다 작습니다.");
        return;
      }

      const updatePayload: Record<string, unknown> = {
        p_shipment_line_id: String(currentShipmentLineId),
        p_deduction_weight_g: dValue,
        p_base_labor_krw:
          baseLaborOverride !== null
            ? baseLaborOverride
            : manualLaborBase !== null
              ? manualLaborBase
              : resolvedBaseLabor,
        p_extra_labor_krw: resolvedExtraLaborTotal,
        p_extra_labor_items: extraLaborPayload,
        p_pricing_mode: isManualTotalOverride ? "AMOUNT_ONLY" : "RULE",
        p_manual_total_amount_krw: isManualTotalOverride ? manualTotalValue : null,
      };
      if (currentLineWeightText !== "") {
        const weightValue = Number(currentLineWeightText);
        if (!Number.isFinite(weightValue) || Number.isNaN(weightValue) || weightValue <= 0) {
          toast.error("중량(g)을 올바르게 입력해주세요.");
          return;
        }
        updatePayload.p_measured_weight_g = weightValue;
      }
      await shipmentLineUpdateMutation.mutateAsync(updatePayload);

    }

    const missingWeightLines: ShipmentLineRow[] = [];
    for (const line of currentLines) {
      const lineId = line.shipment_line_id ? String(line.shipment_line_id) : "";
      if (!lineId) continue;
      const resolvedWeight =
        lineId === currentLineId && currentLineWeightText !== ""
          ? Number(currentLineWeightText)
          : Number(line.measured_weight_g ?? NaN);
      if (!Number.isFinite(resolvedWeight) || resolvedWeight <= 0) {
        missingWeightLines.push(line);
      }
    }

    if (missingWeightLines.length > 0) {
      const missingLabels = missingWeightLines
        .slice(0, 3)
        .map((line) => `${line.model_name ?? "-"} (${String(line.shipment_line_id).slice(0, 8)})`)
        .join(", ");
      const more = missingWeightLines.length > 3 ? ` 외 ${missingWeightLines.length - 3}건` : "";
      toast.error("중량이 없는 출고 라인이 있습니다.", {
        description: missingLabels ? `${missingLabels}${more}` : `라인 수: ${missingWeightLines.length}`,
      });
      return;
    }

    if (shouldStorePickup) {
      await shipmentSetSourceLocationMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_source_location_code: "STORE",
        p_source_bin_code: resolvedSourceBin || null,
        p_actor_person_id: actorId,
        p_note: "set source location from shipments confirm",
      });
      await shipmentSetStorePickupMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_is_store_pickup: true,
        p_actor_person_id: actorId,
        p_note: "set from shipments confirm",
      });
      toast.success("매장출고로 저장 완료", {
        description: "확정은 Workbench(당일출고)에서 진행하세요.",
      });
      resetShipmentForm({ keepStorePickup: true });
      return;
    }

    await shipmentSetSourceLocationMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_source_location_code: resolvedSourceLocation,
      p_source_bin_code: resolvedSourceBin || null,
      p_actor_person_id: actorId,
      p_note: "set source location from shipments confirm",
    });

    // ✅ MANUAL 모드 검증 (프론트엔드)
    if (costMode === "MANUAL") {
      // 검증 1: 모든 라인이 표시되어 있는지 확인
      if (!showAllLines) {
        toast.error("MANUAL 모드: 모든 라인을 표시해야 합니다.", {
          description: "우측 상단 '모든 라인 보기' 버튼을 클릭하세요.",
        });
        return;
      }

      // 검증 2: 모든 shipment line에 대해 비용이 입력되었는지 확인
      const allShipmentLines = currentLinesQuery.data ?? [];
      const missingCostLines = allShipmentLines.filter((line) => {
        const lineIdStr = String(line.shipment_line_id);
        const inputCost = costInputs[lineIdStr];
        return !inputCost || String(inputCost).trim() === "";
      });

      if (missingCostLines.length > 0) {
        const missingLabels = missingCostLines
          .slice(0, 3)
          .map((l) => l.master_model_key || `Line ${l.shipment_line_id}`)
          .join(", ");
        const more = missingCostLines.length > 3 ? ` 외 ${missingCostLines.length - 3}건` : "";
        toast.error("MANUAL 모드: 모든 라인에 비용을 입력해야 합니다.", {
          description: missingLabels ? `누락: ${missingLabels}${more}` : `누락 라인 수: ${missingCostLines.length}`,
        });
        return;
      }

      // 검증 3: 모든 비용이 0보다 커야 함
      const invalidCostLines = allShipmentLines.filter((line) => {
        const lineIdStr = String(line.shipment_line_id);
        const inputCost = costInputs[lineIdStr];
        const numCost = Number(inputCost);
        return Number.isNaN(numCost) || numCost <= 0;
      });

      if (invalidCostLines.length > 0) {
        const invalidLabels = invalidCostLines
          .slice(0, 3)
          .map((l) => l.master_model_key || `Line ${l.shipment_line_id}`)
          .join(", ");
        const more = invalidCostLines.length > 3 ? ` 외 ${invalidCostLines.length - 3}건` : "";
        toast.error("MANUAL 모드: 비용은 0보다 커야 합니다.", {
          description: invalidLabels ? `잘못된 값: ${invalidLabels}${more}` : `잘못된 라인 수: ${invalidCostLines.length}`,
        });
        return;
      }
    }

    // ✅ MANUAL 모드일 때만 현재 화면에 보이는 라인(기본: 지금 출고한 라인)만 전송
    const allowedLineIds = new Set(
      (displayedLines ?? [])
        .map((l) => (l.shipment_line_id ? String(l.shipment_line_id) : ""))
        .filter(Boolean)
    );

    const costLines =
      costMode === "MANUAL"
        ? Object.entries(costInputs)
          .filter(([lineId]) => allowedLineIds.has(String(lineId)))
          .map(([lineId, cost]) => ({
            shipment_line_id: lineId,
            unit_cost_krw: Number(cost),
          }))
          .filter((x) => !Number.isNaN(x.unit_cost_krw) && x.unit_cost_krw >= 0)
        : [];

    await confirmMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_actor_person_id: actorId,
      p_note: "confirm from web",
      p_emit_inventory: true,
      p_cost_mode: costMode,
      p_receipt_id: null,
      p_cost_lines: costLines,
      p_force: false,
    });

    // ✅ 영수증 연결만 (receipt_usage upsert)
  };

  const master = masterLookupQuery.data;
  const roundingUnit = roundingUnitQuery.data ?? 0;
  const showRoundingHint =
    Boolean(masterUnitPricingQuery.data?.is_unit_pricing) && Number(roundingUnit) > 0;


  const resolvedDeductionG = useMemo(() => {
    const useMasterDeductionFallback = !hasReceiptDeduction && applyMasterDeductionWhenEmpty;
    return resolveDeductionValue(
      deductionWeightG ?? "",
      Number(master?.deduction_weight_default_g ?? 0),
      useMasterDeductionFallback
    );
  }, [deductionWeightG, master?.deduction_weight_default_g, hasReceiptDeduction, applyMasterDeductionWhenEmpty]);

  const resolvedNetWeightG = useMemo(() => {
    const w = parseNumberInput(weightG);
    if (!Number.isFinite(w)) return null;
    return Math.max(w - (resolvedDeductionG ?? 0), 0);
  }, [weightG, resolvedDeductionG]);

  const resolvedBaseLabor = useMemo(() => parseNumberInput(baseLabor), [baseLabor]);

  const resolvedManualLabor = useMemo(() => parseNumberInput(manualLabor), [manualLabor]);

  const stoneLaborAmount = useMemo(() => {
    const found = extraLaborItems.find((item) => item.type === "STONE_LABOR");
    return found?.amount ?? "";
  }, [extraLaborItems]);

  const adjustmentLaborAmount = useMemo(() => {
    const found = extraLaborItems.find((item) => item.type === EXTRA_TYPE_ADJUSTMENT);
    return found?.amount ?? "0";
  }, [extraLaborItems]);

  const userEditableExtraLaborItems = useMemo(
    () =>
      extraLaborItems.filter(
        (item) =>
          item.type !== "STONE_LABOR" &&
          item.type !== EXTRA_TYPE_VENDOR_DELTA &&
          item.type !== EXTRA_TYPE_CUSTOM_VARIATION &&
          !isAutoEvidenceItem(item) &&
          !isAutoAbsorbItem(item)
      ),
    [extraLaborItems]
  );

  const autoEvidenceItems = useMemo(
    () => extraLaborItems.filter((item) => isAutoEvidenceItem(item)),
    [extraLaborItems]
  );

  const autoAbsorbItems = useMemo(
    () => extraLaborItems.filter((item) => isAutoAbsorbItem(item)),
    [extraLaborItems]
  );

  const resolvedStoneLabor = useMemo(() => parseNumberInput(stoneLaborAmount), [stoneLaborAmount]);
  const resolvedAdjustmentLabor = useMemo(
    () => parseNumberInput(adjustmentLaborAmount),
    [adjustmentLaborAmount]
  );

  const stoneRecommendation = useMemo(() => {
    const orderQty = Math.max(0, Number(orderLineDetailQuery.data?.qty ?? 0));
    const roles = [
      {
        role: "CENTER" as const,
        receiptQty: receiptMatchPrefillQuery.data?.stone_center_qty,
        inventoryQty: orderLineDetailQuery.data?.center_stone_qty,
        orderQtyPerPiece: orderLineDetailQuery.data?.center_stone_qty,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.center_stone_source),
        unitSell: Number(matchedMasterPricingQuery.data?.labor_center ?? masterLookupQuery.data?.labor_center ?? 0),
      },
      {
        role: "SUB1" as const,
        receiptQty: receiptMatchPrefillQuery.data?.stone_sub1_qty,
        inventoryQty: orderLineDetailQuery.data?.sub1_stone_qty,
        orderQtyPerPiece: orderLineDetailQuery.data?.sub1_stone_qty,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.sub1_stone_source),
        unitSell: Number(matchedMasterPricingQuery.data?.labor_side1 ?? masterLookupQuery.data?.labor_side1 ?? 0),
      },
      {
        role: "SUB2" as const,
        receiptQty: receiptMatchPrefillQuery.data?.stone_sub2_qty,
        inventoryQty: orderLineDetailQuery.data?.sub2_stone_qty,
        orderQtyPerPiece: orderLineDetailQuery.data?.sub2_stone_qty,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.sub2_stone_source),
        unitSell: Number(matchedMasterPricingQuery.data?.labor_side2 ?? masterLookupQuery.data?.labor_side2 ?? 0),
      },
    ].map((row) => {
      const hasReceiptQty = row.receiptQty !== null && row.receiptQty !== undefined;
      const hasInventoryQty =
        isInventoryIssueSource && row.inventoryQty !== null && row.inventoryQty !== undefined;
      const qtyUsed = hasInventoryQty
        ? Math.max(0, Number(row.inventoryQty ?? 0))
        : hasReceiptQty
          ? Math.max(0, Number(row.receiptQty ?? 0))
          : Math.max(0, Number(row.orderQtyPerPiece ?? 0)) * orderQty;
      return {
        role: row.role,
        supply: row.supply,
        unitSell: Math.max(0, Number.isFinite(row.unitSell) ? row.unitSell : 0),
        qtyUsed,
        qtySource: (hasInventoryQty ? "INVENTORY" : hasReceiptQty ? "RECEIPT" : "ORDER") as
          | "INVENTORY"
          | "RECEIPT"
          | "ORDER",
        subtotal: qtyUsed * Math.max(0, Number.isFinite(row.unitSell) ? row.unitSell : 0),
      };
    });

    const recommended = roles.reduce((sum, row) => sum + row.subtotal, 0);
    const receiptTotalQty = roles
      .filter((row) => row.qtySource === "RECEIPT")
      .reduce((sum, row) => sum + row.qtyUsed, 0);
    const orderTotalQty =
      Math.max(0, Number(orderLineDetailQuery.data?.center_stone_qty ?? 0)) * orderQty +
      Math.max(0, Number(orderLineDetailQuery.data?.sub1_stone_qty ?? 0)) * orderQty +
      Math.max(0, Number(orderLineDetailQuery.data?.sub2_stone_qty ?? 0)) * orderQty;

    return {
      roles,
      recommended,
      receiptTotalQty,
      orderTotalQty,
      deltaQtyTotal: receiptTotalQty - orderTotalQty,
    };
  }, [
    masterLookupQuery.data?.labor_center,
    masterLookupQuery.data?.labor_side1,
    masterLookupQuery.data?.labor_side2,
    matchedMasterPricingQuery.data?.labor_center,
    matchedMasterPricingQuery.data?.labor_side1,
    matchedMasterPricingQuery.data?.labor_side2,
    orderLineDetailQuery.data?.center_stone_qty,
    orderLineDetailQuery.data?.center_stone_source,
    orderLineDetailQuery.data?.qty,
    orderLineDetailQuery.data?.sub1_stone_qty,
    orderLineDetailQuery.data?.sub1_stone_source,
    orderLineDetailQuery.data?.sub2_stone_qty,
    orderLineDetailQuery.data?.sub2_stone_source,
    isInventoryIssueSource,
    receiptMatchPrefillQuery.data?.stone_center_qty,
    receiptMatchPrefillQuery.data?.stone_sub1_qty,
    receiptMatchPrefillQuery.data?.stone_sub2_qty,
  ]);

  const resolvedStoneAdjustment = useMemo(
    () => parseNumberInput(stoneAdjustmentAmount),
    [stoneAdjustmentAmount]
  );

  const finalStoneSell = useMemo(
    () => Math.max(0, stoneRecommendation.recommended + resolvedStoneAdjustment),
    [stoneRecommendation.recommended, resolvedStoneAdjustment]
  );

  const effectiveStoneLabor = useMemo(() => {
    if (stoneLaborAmount.trim() !== "") return resolvedStoneLabor;
    if (isVariationMode) return 0;
    return Math.max(0, stoneRecommendation.recommended);
  }, [isVariationMode, resolvedStoneLabor, stoneLaborAmount, stoneRecommendation.recommended]);

  const receiptStoneCostForMargin = useMemo(() => {
    const centerQty = Number(receiptMatchPrefillQuery.data?.stone_center_qty ?? 0);
    const sub1Qty = Number(receiptMatchPrefillQuery.data?.stone_sub1_qty ?? 0);
    const sub2Qty = Number(receiptMatchPrefillQuery.data?.stone_sub2_qty ?? 0);
    const centerUnit = Number(receiptMatchPrefillQuery.data?.stone_center_unit_cost_krw ?? 0);
    const sub1Unit = Number(receiptMatchPrefillQuery.data?.stone_sub1_unit_cost_krw ?? 0);
    const sub2Unit = Number(receiptMatchPrefillQuery.data?.stone_sub2_unit_cost_krw ?? 0);
    return (
      Math.max(0, centerQty) * Math.max(0, centerUnit) +
      Math.max(0, sub1Qty) * Math.max(0, sub1Unit) +
      Math.max(0, sub2Qty) * Math.max(0, sub2Unit)
    );
  }, [
    receiptMatchPrefillQuery.data?.stone_center_qty,
    receiptMatchPrefillQuery.data?.stone_center_unit_cost_krw,
    receiptMatchPrefillQuery.data?.stone_sub1_qty,
    receiptMatchPrefillQuery.data?.stone_sub1_unit_cost_krw,
    receiptMatchPrefillQuery.data?.stone_sub2_qty,
    receiptMatchPrefillQuery.data?.stone_sub2_unit_cost_krw,
  ]);

  const stoneMarginDisplay = useMemo(
    () => finalStoneSell - receiptStoneCostForMargin,
    [finalStoneSell, receiptStoneCostForMargin]
  );

  const resolvedEtcLaborItemsTotal = useMemo(
    () => userEditableExtraLaborItems.reduce((sum, item) => sum + parseNumberInput(item.amount), 0),
    [userEditableExtraLaborItems]
  );

  const resolvedOtherLaborCost = useMemo(() => parseNumberInput(otherLaborCost), [otherLaborCost]);

  const resolvedEtcLaborTotal = useMemo(
    () => resolvedEtcLaborItemsTotal + resolvedOtherLaborCost,
    [resolvedEtcLaborItemsTotal, resolvedOtherLaborCost]
  );

  const resolvedExtraLaborTotal = useMemo(
    () => resolvedEtcLaborTotal + effectiveStoneLabor,
    [effectiveStoneLabor, resolvedEtcLaborTotal]
  );

  const resolvedBaseLaborCost = useMemo(() => {
    const value =
      receiptMatchPrefillQuery.data?.selected_factory_labor_basic_cost_krw ??
      receiptMatchPrefillQuery.data?.receipt_labor_basic_cost_krw ??
      receiptMatchPrefillQuery.data?.shipment_base_labor_krw;
    return value === null || value === undefined ? null : Number(value);
  }, [receiptMatchPrefillQuery.data]);

  const baseLaborCostSource = useMemo(() => {
    if (receiptMatchPrefillQuery.data?.selected_factory_labor_basic_cost_krw !== null && receiptMatchPrefillQuery.data?.selected_factory_labor_basic_cost_krw !== undefined) {
      return "receipt" as const;
    }
    if (receiptMatchPrefillQuery.data?.receipt_labor_basic_cost_krw !== null && receiptMatchPrefillQuery.data?.receipt_labor_basic_cost_krw !== undefined) {
      return "receipt" as const;
    }
    if (receiptMatchPrefillQuery.data?.shipment_base_labor_krw !== null && receiptMatchPrefillQuery.data?.shipment_base_labor_krw !== undefined) {
      return "match" as const;
    }
    return "none" as const;
  }, [
    receiptMatchPrefillQuery.data?.selected_factory_labor_basic_cost_krw,
    receiptMatchPrefillQuery.data?.receipt_labor_basic_cost_krw,
    receiptMatchPrefillQuery.data?.shipment_base_labor_krw,
  ]);

  const masterBaseSell = useMemo(() => {
    const value =
      matchedMasterPricingQuery.data?.labor_base_sell ??
      masterLookupQuery.data?.labor_base_sell ??
      masterLookupQuery.data?.labor_basic;
    return value === null || value === undefined ? null : Number(value);
  }, [
    matchedMasterPricingQuery.data?.labor_base_sell,
    masterLookupQuery.data?.labor_base_sell,
    masterLookupQuery.data?.labor_basic,
  ]);

  const masterBaseCost = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.labor_base_cost ?? masterLookupQuery.data?.labor_base_cost;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.labor_base_cost, masterLookupQuery.data?.labor_base_cost]);

  const masterCenterSell = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.labor_center ?? masterLookupQuery.data?.labor_center;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.labor_center, masterLookupQuery.data?.labor_center]);

  const masterSub1Sell = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.labor_side1 ?? masterLookupQuery.data?.labor_side1;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.labor_side1, masterLookupQuery.data?.labor_side1]);

  const masterSub2Sell = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.labor_side2 ?? masterLookupQuery.data?.labor_side2;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.labor_side2, masterLookupQuery.data?.labor_side2]);

  const masterCenterQtyDefault = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.center_qty_default ?? masterLookupQuery.data?.center_qty_default;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.center_qty_default, masterLookupQuery.data?.center_qty_default]);

  const masterSub1QtyDefault = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.sub1_qty_default ?? masterLookupQuery.data?.sub1_qty_default;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.sub1_qty_default, masterLookupQuery.data?.sub1_qty_default]);

  const masterSub2QtyDefault = useMemo(() => {
    const value = matchedMasterPricingQuery.data?.sub2_qty_default ?? masterLookupQuery.data?.sub2_qty_default;
    return value === null || value === undefined ? null : Number(value);
  }, [matchedMasterPricingQuery.data?.sub2_qty_default, masterLookupQuery.data?.sub2_qty_default]);

  const masterTotalLaborSell = useMemo(() => {
    const hasAnySell =
      masterBaseSell !== null ||
      masterCenterSell !== null ||
      masterSub1Sell !== null ||
      masterSub2Sell !== null;
    if (!hasAnySell) return null;
    return (
      (masterBaseSell ?? 0) +
      (masterCenterSell ?? 0) * Math.max(masterCenterQtyDefault ?? 0, 0) +
      (masterSub1Sell ?? 0) * Math.max(masterSub1QtyDefault ?? 0, 0) +
      (masterSub2Sell ?? 0) * Math.max(masterSub2QtyDefault ?? 0, 0)
    );
  }, [
    masterBaseSell,
    masterCenterQtyDefault,
    masterCenterSell,
    masterSub1QtyDefault,
    masterSub1Sell,
    masterSub2QtyDefault,
    masterSub2Sell,
  ]);

  const masterBaseMargin = useMemo(() => {
    if (masterBaseSell === null || masterBaseCost === null) return null;
    return masterBaseSell - masterBaseCost;
  }, [masterBaseSell, masterBaseCost]);

  const baseMarginSource = useMemo(
    () => (masterBaseMargin === null ? "none" as const : "master" as const),
    [masterBaseMargin]
  );

  const isBaseOverridden = useMemo(() => {
    if (masterBaseMargin === null || resolvedBaseLaborCost === null) return false;
    return Math.round(resolvedBaseLaborCost + masterBaseMargin) !== Math.round(resolvedBaseLabor);
  }, [masterBaseMargin, resolvedBaseLaborCost, resolvedBaseLabor]);

  const resolvedBaseLaborMargin = useMemo(() => {
    if (resolvedBaseLaborCost === null) return null;
    return resolvedBaseLabor - resolvedBaseLaborCost;
  }, [resolvedBaseLabor, resolvedBaseLaborCost]);

  useEffect(() => {
    if (!selectedOrderLineId) return;
    if (prefillHydratedOrderLineId !== selectedOrderLineId) return;
    const data = receiptMatchPrefillQuery.data;
    if (!data) return;
    if (data.shipment_base_labor_krw !== null && data.shipment_base_labor_krw !== undefined) return;
    if (masterBaseMargin === null || masterBaseMargin === undefined) return;

    const receiptBaseCost =
      data.selected_factory_labor_basic_cost_krw ??
      data.receipt_labor_basic_cost_krw ??
      null;
    if (receiptBaseCost === null || receiptBaseCost === undefined) return;

    const currentBaseLabor = parseNumberInput(baseLabor);
    const isEmpty = (baseLabor ?? "").trim() === "";
    const isReceiptCostOnly = Math.round(currentBaseLabor) === Math.round(Number(receiptBaseCost));
    if (!isEmpty && !isReceiptCostOnly) return;

    const nextBaseLabor = Number(receiptBaseCost) + Number(masterBaseMargin);
    setBaseLabor(String(nextBaseLabor));
  }, [
    baseLabor,
    masterBaseMargin,
    prefillHydratedOrderLineId,
    receiptMatchPrefillQuery.data,
    selectedOrderLineId,
  ]);

  const resolvedTotalLabor = useMemo(
    () => (useManualLabor ? resolvedManualLabor : resolvedBaseLabor + resolvedExtraLaborTotal),
    [useManualLabor, resolvedManualLabor, resolvedBaseLabor, resolvedExtraLaborTotal]
  );

  const extraLaborPayload = useMemo(() => {
    const payload = extraLaborItems.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      amount: parseNumberInput(item.amount),
      meta: item.meta ?? null,
    }));

    const hasStoneLabor = payload.some((item) => item.type === "STONE_LABOR");
    if (!hasStoneLabor && !isVariationMode && stoneRecommendation.recommended > 0) {
      payload.push({
        id: "auto-stone-labor",
        type: "STONE_LABOR",
        label: "알공임",
        amount: Math.max(0, stoneRecommendation.recommended),
        meta: {
          engine: "stone_sell_from_master_v1",
          recommended: stoneRecommendation.recommended,
          adjustment: parseNumberInput(stoneAdjustmentAmount),
          adjustment_reason: stoneAdjustmentReason,
        },
      });
    }

    return payload;
  }, [
    extraLaborItems,
    isVariationMode,
    stoneAdjustmentAmount,
    stoneAdjustmentReason,
    stoneRecommendation.recommended,
  ]);

  const stoneEvidenceRows = useMemo(
    () => [
      {
        role: "CENTER" as const,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.center_stone_source),
        qtyReceipt: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.qtyUsed ?? null,
        qtyUsed: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.qtyUsed ?? null,
        qtySource: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.qtySource ?? null,
        qtyOrder: orderLineDetailQuery.data?.center_stone_qty ?? null,
        qtyMaster:
          matchedMasterPricingQuery.data?.center_qty_default ??
          masterLookupQuery.data?.center_qty_default ??
          null,
        unitSell: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.unitSell ?? null,
        unitCostMaster:
          matchedMasterPricingQuery.data?.labor_center_cost ?? masterLookupQuery.data?.labor_center_cost ?? null,
        subtotalSell: stoneRecommendation.roles.find((row) => row.role === "CENTER")?.subtotal ?? null,
        unitCostReceipt: receiptMatchPrefillQuery.data?.stone_center_unit_cost_krw ?? null,
        marginPerUnit: formatMargin(
          matchedMasterPricingQuery.data?.labor_center ?? masterLookupQuery.data?.labor_center,
          matchedMasterPricingQuery.data?.labor_center_cost ?? masterLookupQuery.data?.labor_center_cost
        ),
      },
      {
        role: "SUB1" as const,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.sub1_stone_source),
        qtyReceipt: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.qtyUsed ?? null,
        qtyUsed: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.qtyUsed ?? null,
        qtySource: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.qtySource ?? null,
        qtyOrder: orderLineDetailQuery.data?.sub1_stone_qty ?? null,
        qtyMaster:
          matchedMasterPricingQuery.data?.sub1_qty_default ??
          masterLookupQuery.data?.sub1_qty_default ??
          null,
        unitSell: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.unitSell ?? null,
        unitCostMaster:
          matchedMasterPricingQuery.data?.labor_sub1_cost ?? masterLookupQuery.data?.labor_sub1_cost ?? null,
        subtotalSell: stoneRecommendation.roles.find((row) => row.role === "SUB1")?.subtotal ?? null,
        unitCostReceipt: receiptMatchPrefillQuery.data?.stone_sub1_unit_cost_krw ?? null,
        marginPerUnit: formatMargin(
          matchedMasterPricingQuery.data?.labor_side1 ?? masterLookupQuery.data?.labor_side1,
          matchedMasterPricingQuery.data?.labor_sub1_cost ?? masterLookupQuery.data?.labor_sub1_cost
        ),
      },
      {
        role: "SUB2" as const,
        supply: normalizeStoneSource(orderLineDetailQuery.data?.sub2_stone_source),
        qtyReceipt: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.qtyUsed ?? null,
        qtyUsed: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.qtyUsed ?? null,
        qtySource: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.qtySource ?? null,
        qtyOrder: orderLineDetailQuery.data?.sub2_stone_qty ?? null,
        qtyMaster:
          matchedMasterPricingQuery.data?.sub2_qty_default ??
          masterLookupQuery.data?.sub2_qty_default ??
          null,
        unitSell: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.unitSell ?? null,
        unitCostMaster:
          matchedMasterPricingQuery.data?.labor_sub2_cost ?? masterLookupQuery.data?.labor_sub2_cost ?? null,
        subtotalSell: stoneRecommendation.roles.find((row) => row.role === "SUB2")?.subtotal ?? null,
        unitCostReceipt: receiptMatchPrefillQuery.data?.stone_sub2_unit_cost_krw ?? null,
        marginPerUnit: formatMargin(
          matchedMasterPricingQuery.data?.labor_side2 ?? masterLookupQuery.data?.labor_side2,
          matchedMasterPricingQuery.data?.labor_sub2_cost ?? masterLookupQuery.data?.labor_sub2_cost
        ),
      },
    ],
    [
      orderLineDetailQuery.data?.center_stone_source,
      orderLineDetailQuery.data?.center_stone_qty,
      orderLineDetailQuery.data?.sub1_stone_source,
      orderLineDetailQuery.data?.sub1_stone_qty,
      orderLineDetailQuery.data?.sub2_stone_source,
      orderLineDetailQuery.data?.sub2_stone_qty,
      receiptMatchPrefillQuery.data?.stone_center_unit_cost_krw,
      receiptMatchPrefillQuery.data?.stone_sub1_unit_cost_krw,
      receiptMatchPrefillQuery.data?.stone_sub2_unit_cost_krw,
      matchedMasterPricingQuery.data?.center_qty_default,
      matchedMasterPricingQuery.data?.labor_center,
      matchedMasterPricingQuery.data?.labor_center_cost,
      matchedMasterPricingQuery.data?.sub1_qty_default,
      matchedMasterPricingQuery.data?.labor_side1,
      matchedMasterPricingQuery.data?.labor_sub1_cost,
      matchedMasterPricingQuery.data?.sub2_qty_default,
      matchedMasterPricingQuery.data?.labor_side2,
      matchedMasterPricingQuery.data?.labor_sub2_cost,
      masterLookupQuery.data?.center_qty_default,
      masterLookupQuery.data?.labor_center,
      masterLookupQuery.data?.labor_center_cost,
      masterLookupQuery.data?.sub1_qty_default,
      masterLookupQuery.data?.labor_side1,
      masterLookupQuery.data?.labor_sub1_cost,
      masterLookupQuery.data?.sub2_qty_default,
      masterLookupQuery.data?.labor_side2,
      masterLookupQuery.data?.labor_sub2_cost,
      stoneRecommendation.roles,
    ]
  );

  useEffect(() => {
    if (!selectedOrderLineId) return;
    if (!isVariationMode) {
      upsertManagedExtraLaborItem(EXTRA_TYPE_CUSTOM_VARIATION, "변형 조정", "0", null);
      return;
    }
    const variationAmount =
      extraLaborItems.find((item) => item.type === EXTRA_TYPE_CUSTOM_VARIATION)?.amount ?? "";
    upsertManagedExtraLaborItem(EXTRA_TYPE_CUSTOM_VARIATION, "변형 조정", String(variationAmount), {
      note: variationNote.trim() || undefined,
    });
  }, [isVariationMode, selectedOrderLineId, variationNote, extraLaborItems, upsertManagedExtraLaborItem]);

  useEffect(() => {
    if (!selectedOrderLineId || isVariationMode) return;
    const existingStone = extraLaborItems.find((item) => item.type === "STONE_LABOR");
    if (existingStone && String(existingStone.amount ?? "").trim() !== "") return;
    applyRecommendedStoneLabor(false);
  }, [extraLaborItems, isVariationMode, selectedOrderLineId, stoneRecommendation.recommended]);

  useEffect(() => {
    if (!selectedOrderLineId) return;
    const stoneItem = extraLaborItems.find((item) => item.type === "STONE_LABOR");
    const engine = String((stoneItem?.meta as Record<string, unknown> | null)?.engine ?? "");
    if (!stoneItem || engine !== "stone_sell_from_master_v1") return;
    applyRecommendedStoneLabor(true);
  }, [
    extraLaborItems,
    selectedOrderLineId,
    stoneAdjustmentAmount,
    stoneAdjustmentNote,
    stoneAdjustmentReason,
    stoneRecommendation.recommended,
  ]);

  useEffect(() => {
    if (!selectedOrderLineId || isVariationMode) {
      upsertManagedExtraLaborItem(EXTRA_TYPE_VENDOR_DELTA, "공장 차이(Δ)", "0", null);
      return;
    }
    upsertManagedExtraLaborItem(EXTRA_TYPE_VENDOR_DELTA, "공장 차이(Δ)", vendorDeltaAmount, {
      reason: vendorDeltaReason,
      note: vendorDeltaNote.trim() || undefined,
    });
  }, [
    isVariationMode,
    selectedOrderLineId,
    vendorDeltaAmount,
    vendorDeltaReason,
    vendorDeltaNote,
    upsertManagedExtraLaborItem,
  ]);

  useEffect(() => {
    if (!selectedOrderLineId) return;
    upsertManagedExtraLaborItem(EXTRA_TYPE_ADJUSTMENT, "알공임 조정(±)", stoneAdjustmentAmount, {
      reason: stoneAdjustmentReason,
      note: stoneAdjustmentNote.trim() || undefined,
      source: "STONE_LABOR",
    });
  }, [
    selectedOrderLineId,
    stoneAdjustmentAmount,
    stoneAdjustmentNote,
    stoneAdjustmentReason,
    upsertManagedExtraLaborItem,
  ]);

  const valuation = shipmentValuationQuery.data;
  const pricingLockedAt = valuation?.pricing_locked_at ?? shipmentHeaderQuery.data?.pricing_locked_at ?? null;
  const pricingSource = valuation?.pricing_source ?? shipmentHeaderQuery.data?.pricing_source ?? null;
  const isConfirming =
    confirmMutation.isPending ||
    shipmentSetStorePickupMutation.isPending ||
    shipmentSetSourceLocationMutation.isPending;
  const shipmentIdForResync = normalizeId(currentShipmentId);
  const isShipmentConfirmed =
    Boolean(shipmentHeaderQuery.data?.confirmed_at) || shipmentHeaderQuery.data?.status === "CONFIRMED";
  const canResyncAr = Boolean(shipmentIdForResync) && isShipmentConfirmed && !arInvoiceResyncMutation.isPending;
  const bundlePricingBlockMessage = isEffectiveBundle
    ? effectivePriceState?.isLoading
      ? "BUNDLE 유효가격 계산 중(확정 대기)"
      : effectivePriceState?.isError
        ? `유효가격 조회 실패(확정 불가): ${effectivePriceState.errorMessage ?? "유효가격 조회 실패"}`
        : !effectivePriceData
          ? "BUNDLE 유효가격 데이터가 없어 확정할 수 없습니다."
          : effectivePriceData.ok === false
            ? (effectivePriceData.error_message ?? "BUNDLE BOM 오류")
            : null
    : null;
  const isBundlePricingBlocked =
    !isStorePickup &&
    !isShipmentConfirmed &&
    isEffectiveBundle &&
    Boolean(bundlePricingBlockMessage);

  useEffect(() => {
    if (!isBundlePricingBlocked) {
      bundleBlockToastRef.current = null;
      return;
    }
    const message = bundlePricingBlockMessage ?? "BOM 오류로 확정할 수 없습니다.";
    if (bundleBlockToastRef.current === message) return;
    bundleBlockToastRef.current = message;
    toast.error("BOM 오류(확정 불가)", { description: message });
  }, [bundlePricingBlockMessage, isBundlePricingBlocked]);

  const handleArResync = async () => {
    if (!shipmentIdForResync) return;
    await arInvoiceResyncMutation.mutateAsync({
      p_shipment_id: shipmentIdForResync,
    });
  };

  // --- UI Helpers ---
  const currentStep = !selectedOrderLineId
    ? 1
    : prefillQuery.isLoading || !prefill
      ? 2
      : currentShipmentId || confirmModalOpen
        ? 4
        : 3;

  const steps = [
    { id: 1, label: "Lookup" },
    { id: 2, label: "Prefill" },
    { id: 3, label: "Draft" },
    { id: 4, label: "Confirm" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--panel-border)] shadow-sm transition-all">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <ActionBar
            title="출고 관리"
            subtitle="주문 기반 출고 및 원가 확정"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleArResync}
                  disabled={!canResyncAr}
                >
                  {arInvoiceResyncMutation.isPending ? "재계산 중..." : "AR 재계산(999 포함)"}
                </Button>
                <Link href="/ar/v2">
                  <Button variant="secondary" size="sm">
                    AR 페이지로 이동
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLookupOpen(true);
                    setTimeout(() => lookupInputRef.current?.focus(), 0);
                  }}
                >
                  출고입력
                </Button>
                <Link href="/purchase_cost_worklist">
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Hammer className="w-4 h-4" />
                    원가 작업대
                  </Button>
                </Link>
              </div>
            }
          />
          <div className="flex items-center gap-2 mt-2 text-xs text-[var(--muted)]">
            <Badge tone="neutral" className="gap-1">
              <Package className="w-3 h-3" />
              출고대기
            </Badge>
            <ArrowRight className="w-3 h-3 text-[var(--muted)]" />
            <Badge tone="active" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              확정
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--panel-border)]">
          <button
            onClick={() => setActiveTab("create")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === "create"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <Package className="w-4 h-4" />
            출고 작성
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === "confirmed"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            확정 내역
          </button>
        </div>

        {activeTab === "create" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Worklist */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="h-[calc(100vh-250px)] flex flex-col shadow-sm border-[var(--panel-border)]">
                <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--surface)] p-4 space-y-3">
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3 shadow-sm",
                      includeStorePickup ? "bg-emerald-500/10" : "bg-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">status</Badge>
                      <span className="text-xs text-[var(--muted)]">매장출고</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIncludeStorePickup((prev) => !prev)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        includeStorePickup
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-red-500/20 bg-red-500/5 text-red-300"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          includeStorePickup ? "bg-emerald-400" : "bg-red-300"
                        )}
                      />
                      {includeStorePickup ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Search className="w-4 h-4 text-[var(--muted)]" />
                      주문 검색
                    </h3>
                    <button
                      type="button"
                      onClick={() => setOnlyReadyToShip((v) => !v)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border transition-colors",
                        onlyReadyToShip
                          ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                          : "bg-[var(--panel)] text-[var(--muted)] border-[var(--panel-border)]"
                      )}
                    >
                      {onlyReadyToShip ? "미출고만" : "전체 주문"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={lookupInputRef}
                      placeholder="모델명 / 고객명 / 주문번호"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!lookupOpen) setLookupOpen(true);
                      }}
                      onFocus={() => setLookupOpen(true)}
                      className="bg-[var(--input-bg)]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-xs"
                      onClick={() => {
                        setSearchQuery("");
                        setOnlyReadyToShip(true);
                        setIncludeStorePickup(false);
                        setSelectedOrderLineId(null);
                        setPrefillHydratedOrderLineId(null);
                        setSelectedOrderMaterialCode(null);
                        setSelectedOrderStatus(null);
                        setSelectedOrderDates(null);
                        setLookupOpen(true);
                        setTimeout(() => lookupInputRef.current?.focus(), 0);
                      }}
                    >
                      초기화
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="flex-1 overflow-y-auto p-0">
                  {lookupOpen ? (
                    <div className="flex flex-col overflow-x-auto">
                      <div className="sticky top-0 z-10 grid min-w-[500px] grid-cols-[76px_120px_minmax(140px,1.2fr)_60px_50px_50px] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)] border-b border-[var(--panel-border)]">
                        <span className="text-[var(--foreground)]">발주일(장기)</span>
                        <span>고객명</span>
                        <span>모델명</span>
                        <span>소재</span>
                        <span>색상</span>
                        <span>사이즈</span>
                      </div>
                      <div className="divide-y divide-[var(--panel-border)]">
                        {orderLookupQuery.isLoading ? (
                          <div className="p-8 text-center text-sm text-[var(--muted)] flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            불러오는 중...
                          </div>
                        ) : orderLookupQuery.isError ? (
                          <div className="p-4 text-sm text-[var(--danger)] bg-[var(--danger)]/10 m-2 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {orderLookupErrorMessage}
                          </div>
                        ) : filteredLookupRows.length === 0 ? (
                          <div className="p-8 text-center text-sm text-[var(--muted)]">
                            검색 결과가 없습니다.
                          </div>
                        ) : (
                          filteredLookupRows.map((row) => {
                            const id = row.order_line_id ?? "";
                            const isSelected = selectedOrderLineId === id;
                            const isDemoted = longPendingDemoteIds.has(String(id));
                            const orderDate = row.sent_to_vendor_at ?? row.order_date ?? null;
                            const inboundDate = row.inbound_at ?? null;
                            const customerLabel = row.customer_name ?? row.client_name ?? "-";
                            const modelFallback = orderLineModelMap.get(id);
                            const lookupModelFallback = orderLookupModelMap.get(id);
                            const modelRaw = [
                              row.model_name ?? modelFallback?.model_name ?? lookupModelFallback ?? row.model_no ?? "",
                            ]
                              .filter(Boolean)
                              .join("");
                            const modelLabel = modelRaw.replace(/\s+/g, " ").trim() || "-";
                            const materialLabel = row.material_code ?? modelFallback?.material_code ?? "-";
                            const colorLabel = row.color ?? "-";
                            const sizeLabel = row.size ?? "-";
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => handleSelectOrder(row)}
                                className={cn(
                                  "w-full px-4 py-2 text-left transition-all hover:bg-[var(--panel-hover)]",
                                  isSelected
                                    ? "bg-[var(--primary)]/5 border-l-4 border-l-[var(--primary)]"
                                    : "border-l-4 border-l-transparent"
                                )}
                              >
                                <div className="grid min-w-[500px] grid-cols-[76px_120px_minmax(140px,1.2fr)_60px_50px_50px] gap-2 items-center text-xs">
                                  <span className="text-black dark:text-white tabular-nums font-bold">
                                    {formatDateCompact(orderDate)}
                                    <span className="ml-1 inline-flex items-center align-middle">
                                      <input
                                        type="checkbox"
                                        checked={isDemoted}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onChange={(event) => {
                                          event.stopPropagation();
                                          const checked = event.currentTarget.checked;
                                          const key = String(id);
                                          setLongPendingDemoteIds((prev) => {
                                            const next = new Set(prev);
                                            if (checked) next.add(key);
                                            else next.delete(key);
                                            return next;
                                          });
                                        }}
                                        className="h-3.5 w-3.5 rounded border border-[var(--panel-border)] accent-blue-600 cursor-pointer"
                                        aria-label="장기미출고"
                                        title="장기미출고"
                                      />
                                    </span>
                                    {formatDday(orderDate) ? (
                                      <span className="ml-1 text-[10px] text-[var(--muted)]">
                                        ({formatDday(orderDate)})
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="truncate" title={customerLabel}>{customerLabel}</span>
                                  <div className="min-w-0 flex items-center">
                                    <span className="min-w-0 truncate whitespace-nowrap font-semibold" title={modelLabel}>
                                      {modelLabel}
                                    </span>
                                  </div>
                                  <span className="text-[var(--muted)]">{materialLabel}</span>
                                  <span className="text-[var(--muted)]">{colorLabel}</span>
                                  <span className="text-[var(--muted)]">{sizeLabel}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : selectedOrderLineId ? (
                    <div className="p-4">
                      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface)] p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">선택된 주문</div>
                            <div className="text-base font-semibold text-[var(--foreground)]">
                              <span className="font-extrabold text-emerald-700">{prefill?.client_name ?? "-"}</span>
                              <span className="mx-1 text-[var(--muted)]">·</span>
                              <span className="font-extrabold text-amber-700">{prefill?.model_no ?? "-"}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                            onClick={() => {
                              setLookupOpen(true);
                              setTimeout(() => lookupInputRef.current?.focus(), 0);
                            }}
                          >
                            주문 변경
                          </Button>
                        </div>
                        <div className="grid grid-cols-[1fr_120px] gap-4">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">발주일</span>
                              <div className="font-medium tabular-nums">
                                {formatDateCompact(selectedOrderDates?.orderDate ?? prefill?.order_date)}
                                {formatDday(selectedOrderDates?.orderDate ?? prefill?.order_date) ? (
                                  <span className="ml-1 text-[10px] text-[var(--muted)]">
                                    ({formatDday(selectedOrderDates?.orderDate ?? prefill?.order_date)})
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">입고일</span>
                              <div className="font-medium tabular-nums">
                                {formatDateCompact(selectedOrderDates?.inboundDate)}
                                {formatDday(selectedOrderDates?.inboundDate) ? (
                                  <span className="ml-1 text-[10px] text-[var(--muted)]">
                                    ({formatDday(selectedOrderDates?.inboundDate)})
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">거래처</span>
                              <div className="font-medium">{prefill?.client_name ?? "-"}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">모델명</span>
                              <div className="font-semibold">{prefill?.model_no ?? "-"}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">소재</span>
                              <div className="font-medium">
                                {selectedOrderMaterialCode
                                  ?? prefill?.material_code
                                  ?? orderLineDetailQuery.data?.material_code
                                  ?? receiptMatchPrefillQuery.data?.selected_material_code
                                  ?? "-"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">색상</span>
                              <div className="font-medium">{prefill?.color ?? "-"}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">사이즈</span>
                              <div className="font-medium">{prefill?.size ?? "-"}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">variant_key</span>
                              <div className="font-medium">{resolvedVariantKey ?? "(DEFAULT)"}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[var(--muted)]">도금/도금색상</span>
                              <div className="font-medium">
                                {prefill?.plating_status
                                  ? `Y / ${prefill.plating_color ?? "-"}`
                                  : "N / -"}
                              </div>
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="text-[var(--muted)]">중심석 공급</span>
                              <div className="font-medium truncate" title={stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.center_stone_source))}>
                                {stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.center_stone_source))}
                              </div>
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="text-[var(--muted)]">보조1석 공급</span>
                              <div className="font-medium truncate" title={stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.sub1_stone_source))}>
                                {stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.sub1_stone_source))}
                              </div>
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="text-[var(--muted)]">보조2석 공급</span>
                              <div className="font-medium truncate" title={stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.sub2_stone_source))}>
                                {stoneSourceLabel(normalizeStoneSource(orderLineDetailQuery.data?.sub2_stone_source))}
                              </div>
                            </div>
                          </div>
                          <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]">
                            {getMasterPhotoUrl(prefill?.photo_url) ? (
                              <img
                                src={getMasterPhotoUrl(prefill?.photo_url) || undefined}
                                alt={prefill?.model_no ?? "모델 이미지"}
                                className="h-full w-full object-cover"
                                loading="eager"
                                onError={(e) => {
                                  if (process.env.NODE_ENV === "development") {
                                    console.error("[Master Photo] Failed to load:", prefill?.photo_url);
                                  }
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                                <Package className="w-6 h-6 opacity-40" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">마스터 핵심값</div>
                            <Badge tone="active" className="text-[10px]">CATALOG</Badge>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                              <div className="text-[11px] text-[var(--muted)]">마스터 중량(g)</div>
                              <div className="text-sm font-semibold">{renderNumber(masterLookupQuery.data?.weight_default_g ?? null)}</div>
                            </div>
                            <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                              <div className="text-[11px] text-[var(--muted)]">마스터 차감중량(g)</div>
                              <div className="text-sm font-semibold">{renderNumber(masterLookupQuery.data?.deduction_weight_default_g ?? null)}</div>
                            </div>
                            <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                              <div className="text-[11px] text-[var(--muted)]">기본공임(판매)</div>
                              <div className="text-sm font-semibold">{renderNumber(masterBaseSell, "원")}</div>
                            </div>
                            <div className="rounded-md border border-amber-200 bg-white px-3 py-2">
                              <div className="text-[11px] text-[var(--muted)]">합계공임(판매)</div>
                              <div className="text-sm font-bold text-amber-900">{renderNumber(masterTotalLaborSell, "원")}</div>
                            </div>
                          </div>
                        </div>
                        {effectiveMasterId ? (
                          <EffectivePriceCard
                            masterId={effectiveMasterId}
                            qty={effectiveQty}
                            variantKey={resolvedVariantKey}
                            title="유효가격 프리뷰"
                            showBreakdown
                            onDataChange={setEffectivePriceData}
                            onStateChange={setEffectivePriceState}
                          />
                        ) : null}
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                          <div className="text-xs font-semibold text-[var(--muted)] mb-2">비고</div>
                          <div className="text-sm font-semibold text-[var(--foreground)] whitespace-pre-wrap min-h-[48px]">
                            {prefill?.note ?? orderLineDetailQuery.data?.memo ?? "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] p-6 text-center space-y-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="text-sm">주문을 검색하여 선택하세요</p>
                    </div>
                  )}
                </CardBody>
              </Card>

            </div>

            {/* Right Panel: Detail & Input */}
            <div className="lg:col-span-8 space-y-6">
              {/* Stepper Visual */}
              <div className="flex items-center justify-between px-1">
                {steps.map((step, i) => {
                  const isCompleted = step.id < currentStep;
                  const isCurrent = step.id === currentStep;

                  return (
                    <div key={step.id} className="flex items-center gap-3 flex-1 last:flex-none">
                      <div
                        className={cn(
                          "flex items-center gap-2 transition-colors",
                          isCompleted || isCurrent ? "text-[var(--primary)]" : "text-[var(--muted)] opacity-50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                            isCompleted
                              ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                              : isCurrent
                                ? "bg-[var(--panel)] text-[var(--primary)] border-[var(--primary)]"
                                : "bg-[var(--panel)] border-[var(--panel-border)]"
                          )}
                        >
                          {step.id}
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          className={cn(
                            "h-px flex-1 mx-2 min-w-[20px]",
                            step.id < currentStep ? "bg-[var(--primary)]/40" : "bg-[var(--panel-border)]"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 이하 JSX는 너가 준 그대로라서 생략 없이 이어져야 함 */}
              {/* 너가 붙인 나머지 JSX/모달/확정 로직은 그대로 유지하면 됨 */}
              {/* ======= 여기 아래부터는 네 원본 코드와 동일 ======= */}

              {selectedOrderLineId ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="border-[var(--panel-border)] shadow-sm overflow-visible">
                    <CardHeader className="bg-[var(--surface)] border-b border-[var(--panel-border)] py-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--muted)]" />
                        계산근거
                      </h3>
                    </CardHeader>
                    <CardBody className="p-4 min-w-0">
                      <ShipmentPricingEvidencePanel
                        className="min-w-0"
                        baseLaborSellKrw={resolvedBaseLabor}
                        factoryBasicCostKrw={resolvedBaseLaborCost}
                        masterBaseSellKrw={masterBaseSell}
                        masterBaseCostKrw={masterBaseCost}
                        masterBaseMarginKrw={masterBaseMargin}
                        baseCostSource={baseLaborCostSource}
                        baseMarginSource={baseMarginSource}
                        isBaseOverridden={isBaseOverridden}
                        extraLaborSellKrw={resolvedExtraLaborTotal}
                        factoryOtherCostBaseKrw={resolvedOtherLaborCost}
                        stoneRows={stoneEvidenceRows}
                        isInventorySource={isInventoryIssueSource}
                        expectedBaseLaborSellKrw={resolvedBaseLabor}
                        expectedExtraLaborSellKrw={resolvedExtraLaborTotal}
                        shipmentBaseLaborKrw={receiptMatchPrefillQuery.data?.shipment_base_labor_krw ?? null}
                        receiptStoneOtherCostKrw={
                          receiptMatchPrefillQuery.data?.selected_factory_labor_other_cost_krw ??
                          receiptMatchPrefillQuery.data?.receipt_labor_other_cost_krw ??
                          null
                        }
                        recommendedStoneSellKrw={stoneRecommendation.recommended}
                        finalStoneSellKrw={finalStoneSell}
                        stoneAdjustmentKrw={resolvedStoneAdjustment}
                        stoneQtyDeltaTotal={stoneRecommendation.deltaQtyTotal}
                        isVariationMode={isVariationMode}
                      />
                    </CardBody>
                  </Card>

                  {/* Input Form */}
                  <Card className="border-[var(--panel-border)] shadow-md">
                    <CardHeader className="border-b border-[var(--panel-border)] py-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <Scale className="w-4 h-4" />
                          출고 정보 입력
                        </h3>
                        {orderHasVariation ? (
                          <Badge tone="warning" className="text-xs">
                            변형 주문
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardBody className="p-6 space-y-6">
                      <div className="space-y-4">
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/40 p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-[var(--foreground)]">변형/알공임 설정</span>
                            <Button size="sm" variant="secondary" onClick={() => setIsVariationSectionOpen((prev) => !prev)}>
                              {isVariationSectionOpen ? "닫기" : "열기"}
                            </Button>
                          </div>

                          {isVariationSectionOpen ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                                  <input
                                    type="checkbox"
                                    checked={isVariationMode}
                                    onChange={(event) => setIsVariationMode(event.target.checked)}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                  />
                                  변형 모드
                                </label>
                                {isVariationMode ? (
                                  <Badge tone="warning" className="text-[10px]">자동추천 비활성</Badge>
                                ) : null}
                                <Button size="sm" variant="secondary" onClick={() => applyRecommendedStoneLabor(true)}>
                                  추천 적용
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-1.5">
                                  <div className="text-[var(--muted)]">추천 알공임(마스터 기준)</div>
                                  <div className="text-sm font-semibold tabular-nums">{renderNumber(stoneRecommendation.recommended, "원")}</div>
                                </div>
                                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-1.5">
                                  <div className="text-[var(--muted)]">조정(±)</div>
                                  <Input
                                    value={stoneAdjustmentAmount}
                                    onChange={(e) => setStoneAdjustmentAmount(e.target.value)}
                                    inputMode="numeric"
                                    className="h-7 tabular-nums text-xs"
                                  />
                                </div>
                                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-1.5">
                                  <div className="text-[var(--muted)]">최종 알공임</div>
                                  <div className="text-sm font-semibold tabular-nums">{renderNumber(finalStoneSell, "원")}</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr] gap-2">
                                <div className="space-y-1">
                                  <label className="text-xs text-[var(--muted)]">조정 사유</label>
                                  <select
                                    className="h-8 w-full rounded-md border border-[var(--panel-border)] bg-[var(--input-bg)] px-2 text-xs"
                                    value={stoneAdjustmentReason}
                                    onChange={(e) =>
                                      setStoneAdjustmentReason(
                                        ["FACTORY_MISTAKE", "PRICE_UP", "VARIANT", "OTHER"].includes(e.target.value)
                                          ? (e.target.value as StoneAdjustmentReason)
                                          : "OTHER"
                                      )
                                    }
                                  >
                                    <option value="FACTORY_MISTAKE">공장 오차/실수</option>
                                    <option value="PRICE_UP">단가 인상</option>
                                    <option value="VARIANT">변형</option>
                                    <option value="OTHER">기타</option>
                                  </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs text-[var(--muted)]">조정 메모</label>
                                  <Input
                                    placeholder="조정 사유 메모"
                                    value={stoneAdjustmentNote}
                                    onChange={(e) => setStoneAdjustmentNote(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>

                              {stoneRecommendation.deltaQtyTotal !== 0 ? (
                                <div className="text-xs text-amber-700">
                                  마스터 개수 대비 영수증 개수 차이: {renderNumber(stoneRecommendation.deltaQtyTotal)}
                                  {isVariationMode
                                    ? " (변형이므로 자동추천 기본 비활성)"
                                    : " (공장 오차/사이즈 차이 가능, 조정(±) 권장)"}
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/30 p-3">
                          <div className="space-y-1">
                            <span className="text-xs text-[var(--muted)]">총중량 (중량-차감중량)</span>
                            <div className="text-xl font-extrabold tracking-tight">
                              {resolvedNetWeightG === null ? "-" : renderNumber(Number(resolvedNetWeightG.toFixed(3)), "g")}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-[var(--muted)]">
                              총공임 ({useManualLabor ? "직접입력" : "기본+기타"})
                            </span>
                            <div className="text-xl font-extrabold tracking-tight">
                              {renderNumber(resolvedTotalLabor, "원")}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
                              <input
                                type="checkbox"
                                checked={useManualLabor}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  setUseManualLabor(checked);
                                  if (checked && manualLabor.trim() === "") {
                                    setManualLabor(String(resolvedBaseLabor + resolvedExtraLaborTotal));
                                  }
                                }}
                                className="h-3.5 w-3.5 accent-[var(--brand)]"
                              />
                              총공임 직접입력
                            </label>
                            <Input
                              placeholder="0"
                              value={manualLabor}
                              onChange={(e) => setManualLabor(e.target.value)}
                              inputMode="numeric"
                              className="tabular-nums h-9"
                              disabled={!useManualLabor}
                            />
                            <span className="text-[10px] text-[var(--muted)]">직접입력 시 기본+기타 합계 대신 사용</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">중량 (g)</label>
                            <Input
                              placeholder="0.00"
                              value={weightG}
                              onChange={(e) => setWeightG(e.target.value)}
                              inputMode="decimal"
                              className="tabular-nums text-lg h-12"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--foreground)]">
                              차감중량 (g)
                              <span className="text-[var(--muted)] font-normal ml-1 text-xs">(선택)</span>
                            </label>
                            <Input
                              placeholder={master?.deduction_weight_default_g ? `${master.deduction_weight_default_g} (기본값)` : "0.00"}
                              value={deductionWeightG}
                              onChange={(e) => setDeductionWeightG(e.target.value)}
                              inputMode="decimal"
                              className="tabular-nums text-lg h-12"
                            />
                            {hasReceiptDeduction ? (
                              <div className="text-[11px] text-[var(--muted)]">
                                영수증 차감중량 사용 중 (마스터 자동 차감 미적용)
                              </div>
                            ) : Number(master?.deduction_weight_default_g ?? 0) > 0 ? (
                              <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                                <input
                                  type="checkbox"
                                  checked={applyMasterDeductionWhenEmpty}
                                  onChange={(e) => setApplyMasterDeductionWhenEmpty(e.target.checked)}
                                  className="accent-[var(--primary)]"
                                />
                                차감중량 비었을 때 마스터 차감({master?.deduction_weight_default_g}) 적용
                              </label>
                            ) : (
                              <div className="text-[11px] text-[var(--muted)]">마스터 차감중량 없음</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-[var(--foreground)]">
                              <span>기본공임 (원)+마진</span>
                              <span className="text-xs text-[var(--muted)]">마진 {renderNumber(resolvedBaseLaborMargin)}</span>
                            </div>
                            <Input
                              placeholder="0"
                              value={baseLabor}
                              onChange={(e) => setBaseLabor(e.target.value)}
                              inputMode="numeric"
                              className="tabular-nums text-lg h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-[var(--foreground)]">
                              <span>기타공임 (원)+마진</span>
                              <span className="text-xs text-[var(--muted)]">마진 {renderNumber(resolvedEtcLaborTotal - resolvedOtherLaborCost)}</span>
                            </div>
                            <Input
                              placeholder="0"
                              value={resolvedEtcLaborTotal.toLocaleString()}
                              readOnly
                              inputMode="numeric"
                              className="tabular-nums text-lg h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-[var(--foreground)]">
                              <span>알공임</span>
                              <span className="text-xs text-[var(--muted)]">마진 {renderNumber(stoneMarginDisplay)}</span>
                            </div>
                            <Input
                              placeholder="0"
                              value={String(finalStoneSell)}
                              onChange={(e) => {
                                const nextFinal = parseNumberInput(e.target.value);
                                const nextAdjustment = nextFinal - stoneRecommendation.recommended;
                                setStoneAdjustmentAmount(String(nextAdjustment));
                                applyRecommendedStoneLabor(true);
                              }}
                              inputMode="numeric"
                              className="tabular-nums text-lg h-12"
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/40 p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-[var(--foreground)]">기타공임 내역</span>
                            <div className="flex items-center gap-2 overflow-x-auto">
                              {OTHER_LABOR_OPTIONS.map((option) => (
                                <Button
                                  key={option.value}
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleAddExtraLabor(option.value)}
                                  className="whitespace-nowrap"
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">
                              <span className="text-xs text-[var(--muted)]">기타원가</span>
                              <div className="tabular-nums h-7 w-24 flex items-center justify-end">
                                {renderNumber(resolvedOtherLaborCost)}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {userEditableExtraLaborItems.length === 0 ? (
                              <div className="text-xs text-[var(--muted)]">추가된 내역이 없습니다.</div>
                            ) : (
                              userEditableExtraLaborItems.map((item) => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <div className="text-xs font-medium text-[var(--foreground)] min-w-[90px]">
                                    {item.label}
                                  </div>
                                  <Input
                                    placeholder="0"
                                    value={item.amount}
                                    onChange={(e) => handleExtraLaborAmountChange(item.id, e.target.value)}
                                    inputMode="numeric"
                                    className="tabular-nums h-9"
                                  />
                                  {item.type === EXTRA_TYPE_ADJUSTMENT ? (
                                    <>
                                      <select
                                        className="h-9 rounded-md border border-[var(--panel-border)] bg-[var(--input-bg)] px-2 text-xs"
                                        value={String((item.meta as Record<string, unknown> | null)?.reason ?? "OTHER")}
                                        onChange={(e) => handleExtraLaborMetaChange(item.id, "reason", e.target.value)}
                                      >
                                        <option value="FACTORY_MISTAKE">공장 오차/실수</option>
                                        <option value="PRICE_UP">단가 인상</option>
                                        <option value="VARIANT">변형</option>
                                        <option value="OTHER">기타</option>
                                      </select>
                                      <Input
                                        placeholder="메모"
                                        value={String((item.meta as Record<string, unknown> | null)?.note ?? "")}
                                        onChange={(e) => handleExtraLaborMetaChange(item.id, "note", e.target.value)}
                                        className="h-9"
                                      />
                                    </>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveExtraLabor(item.id)}
                                    className="text-[var(--muted)]"
                                  >
                                    삭제
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                            <button
                              type="button"
                              className="w-full text-left text-xs font-semibold"
                              onClick={() => setIsAutoEvidenceOpen((prev) => !prev)}
                            >
                              자동 계산 내역(고급) {isAutoEvidenceOpen ? "접기" : `펼치기 (${autoEvidenceItems.length})`}
                            </button>
                            {isAutoEvidenceOpen ? (
                              <div className="mt-2 space-y-1">
                                {autoEvidenceItems.length === 0 ? (
                                  <div className="text-xs text-[var(--muted)]">자동 증빙 라인이 없습니다.</div>
                                ) : (
                                  autoEvidenceItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="text-[var(--foreground)]">{item.label}</span>
                                      <span className="tabular-nums text-[var(--muted)]">{renderNumber(parseNumberInput(item.amount))}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                            <button
                              type="button"
                              className="w-full text-left text-xs font-semibold"
                              onClick={() => setIsAutoAbsorbOpen((prev) => !prev)}
                            >
                              자동 흡수공임(고급) {isAutoAbsorbOpen ? "접기" : `펼치기 (${autoAbsorbItems.length})`}
                            </button>
                            {isAutoAbsorbOpen ? (
                              <div className="mt-2 space-y-1">
                                {autoAbsorbItems.length === 0 ? (
                                  <div className="text-xs text-[var(--muted)]">자동 흡수공임 라인이 없습니다.</div>
                                ) : (
                                  autoAbsorbItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="text-[var(--foreground)]">{item.label}</span>
                                      <span className="tabular-nums text-[var(--muted)]">{renderNumber(parseNumberInput(item.amount))}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-[var(--panel-border)]">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedOrderLineId(null);
                            setPrefillHydratedOrderLineId(null);
                            setSelectedOrderMaterialCode(null);
                            setSelectedOrderStatus(null);
                            setPrefill(null);
                            setSearchQuery("");
                            setDebouncedQuery("");
                            setWeightG("");
                            setDeductionWeightG("");
                            setApplyMasterDeductionWhenEmpty(true);
                            setBaseLabor("");
                            setOtherLaborCost("");
                            setExtraLaborItems([]);
                            setIsStorePickup(false);
                            setSourceBinCode("");
                          }}
                          className="text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          초기화
                        </Button>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                            <input
                              type="checkbox"
                              checked={isStorePickup}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setIsStorePickup(checked);
                              }}
                              className="h-4 w-4"
                            />
                            매장출고
                          </label>
                          <div className="h-9 min-w-[180px] text-sm rounded-md bg-[var(--chip)] border-none px-3 flex items-center">
                            출고 위치: {effectiveSourceLocationCode}
                          </div>
                          <select
                            value={sourceBinCode}
                            onChange={(event) => setSourceBinCode(event.target.value)}
                            className="h-9 min-w-[180px] text-sm rounded-md bg-[var(--chip)] border-none px-3"
                          >
                            <option value="">출고 bin(선택)</option>
                            {sourceBinOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <Button
                            variant="primary"
                            size="lg"
                            onClick={handleSaveShipment}
                            disabled={shipmentUpsertMutation.isPending}
                            className="px-8 shadow-lg shadow-[var(--primary)]/20"
                          >
                            {shipmentUpsertMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
                                {isStorePickup ? "저장 중..." : "확정 중..."}
                              </div>
                            ) : isStorePickup ? (
                              "매장출고 저장 (워크벤치에서 확정)"
                            ) : (
                              "출고 확정"
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              ) : (
                <div className="h-[400px] border-2 border-dashed border-[var(--panel-border)] rounded-xl flex flex-col items-center justify-center text-[var(--muted)] gap-4 bg-[var(--surface)]/50">
                  <div className="w-16 h-16 rounded-full bg-[var(--panel)] border border-[var(--panel-border)] flex items-center justify-center shadow-sm">
                    <ArrowRight className="w-6 h-6 text-[var(--muted)]" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-[var(--foreground)]">주문을 선택해주세요</p>
                    <p className="text-sm">왼쪽 목록에서 출고할 주문을 선택하면 입력폼이 나타납니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Confirmed Tab - Empty State */
          <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
            <div className="w-20 h-20 bg-[var(--success)]/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-semibold">확정된 출고 내역</h3>
              <p className="text-[var(--muted)]">
                확정된 출고 내역은 전체 히스토리 페이지에서 조회 및 관리할 수 있습니다.
              </p>
            </div>
            <Link href="/shipments_main">
              <Button variant="secondary" className="gap-2">
                전체 내역 보러가기
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Confirm Modal - Preserved Logic */}
      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="출고 확정" className="max-w-6xl">
        <div className="space-y-6">
          {isStorePickup ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <div className="font-semibold">매장출고는 Shipments에서 확정되지 않습니다.</div>
                <div className="text-xs text-amber-700">
                  Workbench(당일출고)에서 ‘선택 영수증 확정’으로 확정하세요.
                </div>
              </div>
            </div>
          ) : null}
          {/* Summary Section */}
          <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                {/* Master Photo in Confirm Modal - Using prefill data */}
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--panel)] to-[var(--background)] border-2 border-[var(--primary)]/40 shadow-sm">
                  {getMasterPhotoUrl(prefill?.photo_url) ? (
                    <img
                      src={getMasterPhotoUrl(prefill?.photo_url) || undefined}
                      alt={prefill?.model_no ?? "모델 이미지"}
                      className="h-full w-full object-cover"
                      loading="eager"
                      onLoad={() => console.log("[Master Photo Modal] Loaded:", getMasterPhotoUrl(prefill?.photo_url))}
                      onError={(e) => {
                        if (process.env.NODE_ENV === 'development') {
                          console.error("[Master Photo Modal] Failed:", prefill?.photo_url);
                        }
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center text-[var(--muted)]",
                      getMasterPhotoUrl(prefill?.photo_url) ? "absolute inset-0 -z-10" : ""
                    )}
                  >
                    <Package className="w-8 h-8 opacity-40" />
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="text-sm font-bold text-[var(--primary)]">확정 대상 주문</div>
                  <div className="text-xs text-[var(--primary)]">
                    {prefill?.order_no ?? "-"} / {prefill?.client_name ?? "-"} / {prefill?.model_no ?? "-"}
                  </div>
                </div>
              </div>
              <Badge tone="active">작성 중</Badge>
            </div>

            <div className="space-y-3 pt-3 border-t border-[var(--primary)]/20">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">총중량</span>
                  <span className="text-sm font-semibold">
                    {resolvedNetWeightG === null ? "-" : renderNumber(Number(resolvedNetWeightG.toFixed(3)), "g")}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">총공임</span>
                  <span className="text-sm font-semibold">{renderNumber(resolvedTotalLabor, "원")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">중량</span>
                  <Input
                    className="h-7 text-xs w-16 bg-[var(--input-bg)] tabular-nums"
                    placeholder="0.00"
                    value={weightG}
                    onChange={(e) => setWeightG(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">차감</span>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs w-16 bg-[var(--input-bg)] tabular-nums"
                      placeholder="0.00"
                      value={deductionWeightG}
                      onChange={(e) => setDeductionWeightG(e.target.value)}
                      inputMode="decimal"
                    />
                    {hasReceiptDeduction ? (
                      <span className="text-[10px] text-[var(--muted)]">영수증 차감 적용</span>
                    ) : (
                      <span className="text-[10px] text-[var(--primary)]">(마스터: {master?.deduction_weight_default_g ?? "-"})</span>
                    )}
                  </div>
                  {!hasReceiptDeduction && Number(master?.deduction_weight_default_g ?? 0) > 0 ? (
                    <label className="mt-1 flex items-center gap-1 text-[10px] text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={applyMasterDeductionWhenEmpty}
                        onChange={(e) => setApplyMasterDeductionWhenEmpty(e.target.checked)}
                        className="accent-[var(--primary)]"
                      />
                      빈 값이면 마스터 차감 적용
                    </label>
                  ) : null}
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">기본공임 (원)+마진</span>
                  <span className="text-[10px] text-[var(--muted)] block">마진 {renderNumber(resolvedBaseLaborMargin)}</span>
                  <Input
                    className="h-7 text-xs w-24 bg-[var(--input-bg)] tabular-nums"
                    placeholder="0"
                    value={baseLabor}
                    onChange={(e) => setBaseLabor(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">기타공임 (원)+마진</span>
                  <span className="text-[10px] text-[var(--muted)] block">마진 {renderNumber(resolvedEtcLaborTotal - resolvedOtherLaborCost)}</span>
                  <Input
                    className="h-7 text-xs w-24 bg-[var(--input-bg)] tabular-nums"
                    placeholder="0"
                    value={String(resolvedEtcLaborTotal)}
                    readOnly
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">알공임</span>
                  <span className="text-[10px] text-[var(--muted)] block">별도입력</span>
                  <Input
                    className="h-7 text-xs w-24 bg-[var(--input-bg)] tabular-nums"
                    placeholder="0"
                    value={String(finalStoneSell)}
                    onChange={(e) => {
                      const nextFinal = parseNumberInput(e.target.value);
                      const nextAdjustment = nextFinal - stoneRecommendation.recommended;
                      setStoneAdjustmentAmount(String(nextAdjustment));
                      applyRecommendedStoneLabor(true);
                    }}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">총액 덮어쓰기 (AMOUNT_ONLY)</span>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-[10px] text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={isManualTotalOverride}
                        onChange={(event) => {
                          const nextValue = event.target.checked;
                          setIsManualTotalOverride(nextValue);
                          if (!nextValue) setManualTotalAmountKrw("");
                        }}
                        className="h-3 w-3"
                      />
                      총액 덮어쓰기
                    </label>
                    <Input
                      className="h-7 text-xs w-28 bg-[var(--input-bg)] tabular-nums"
                      placeholder="0"
                      value={manualTotalAmountKrw}
                      onChange={(e) => setManualTotalAmountKrw(e.target.value)}
                      inputMode="numeric"
                      disabled={!isManualTotalOverride}
                    />
                  </div>
                </div>
              </div>

              {showRoundingHint ? (
                <div className="rounded-md border border-[var(--primary)]/20 bg-[var(--surface)]/60 px-3 py-2 text-[10px] text-[var(--muted)]">
                  이 모델은 확정 시 RULE 판매가가 {Number(roundingUnit).toLocaleString()}원 단위로 올림됩니다.
                </div>
              ) : null}

              <div className="rounded-md border border-[var(--primary)]/20 bg-[var(--surface)]/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[var(--primary)]">
                  <span className="font-semibold">기타공임 내역</span>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {OTHER_LABOR_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddExtraLabor(option.value)}
                        className="whitespace-nowrap"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">
                    <span className="text-[10px] text-[var(--primary)]">기타원가</span>
                    <div className="h-7 text-xs w-20 bg-[var(--input-bg)] tabular-nums flex items-center justify-end">
                      {renderNumber(resolvedOtherLaborCost)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {userEditableExtraLaborItems.length === 0 ? (
                    <div className="text-[10px] text-[var(--muted)]">추가된 내역이 없습니다.</div>
                  ) : (
                    userEditableExtraLaborItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--primary)] min-w-[80px]">
                          {item.label}
                        </span>
                        <Input
                          className="h-7 text-xs w-20 bg-[var(--input-bg)] tabular-nums"
                          placeholder="0"
                          value={item.amount}
                          onChange={(e) => handleExtraLaborAmountChange(item.id, e.target.value)}
                          inputMode="numeric"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExtraLabor(item.id)}
                          className="text-[var(--muted)]"
                        >
                          삭제
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <button
                    type="button"
                    className="w-full text-left text-[10px] font-semibold"
                    onClick={() => setIsAutoEvidenceOpen((prev) => !prev)}
                  >
                    자동 계산 내역(고급) {isAutoEvidenceOpen ? "접기" : `펼치기 (${autoEvidenceItems.length})`}
                  </button>
                  {isAutoEvidenceOpen ? (
                    <div className="mt-2 space-y-1">
                      {autoEvidenceItems.length === 0 ? (
                        <div className="text-[10px] text-[var(--muted)]">자동 증빙 라인이 없습니다.</div>
                      ) : (
                        autoEvidenceItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 text-[10px]">
                            <span>{item.label}</span>
                            <span className="tabular-nums text-[var(--muted)]">{renderNumber(parseNumberInput(item.amount))}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <button
                    type="button"
                    className="w-full text-left text-[10px] font-semibold"
                    onClick={() => setIsAutoAbsorbOpen((prev) => !prev)}
                  >
                    자동 흡수공임(고급) {isAutoAbsorbOpen ? "접기" : `펼치기 (${autoAbsorbItems.length})`}
                  </button>
                  {isAutoAbsorbOpen ? (
                    <div className="mt-2 space-y-1">
                      {autoAbsorbItems.length === 0 ? (
                        <div className="text-[10px] text-[var(--muted)]">자동 흡수공임 라인이 없습니다.</div>
                      ) : (
                        autoAbsorbItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 text-[10px]">
                            <span>{item.label}</span>
                            <span className="tabular-nums text-[var(--muted)]">{renderNumber(parseNumberInput(item.amount))}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 pt-4 border-t border-[var(--primary)]/20">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                <input
                  type="checkbox"
                  checked={isStorePickup}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsStorePickup(checked);
                  }}
                  className="h-4 w-4"
                />
                매장출고 (확정은 Workbench에서 진행)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">출고 위치</span>
                  <select
                    value={effectiveSourceLocationCode}
                    disabled
                    className="h-8 w-full rounded-md bg-[var(--input-bg)] px-2 text-xs"
                  >
                    <option value={effectiveSourceLocationCode}>{effectiveSourceLocationCode}</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">출고 bin(선택)</span>
                  <select
                    value={sourceBinCode}
                    onChange={(event) => setSourceBinCode(event.target.value)}
                    className="h-8 w-full rounded-md bg-[var(--input-bg)] px-2 text-xs"
                  >
                    <option value="">선택</option>
                    {sourceBinOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">가격 확정</span>
                  <span className="text-sm font-semibold tabular-nums">{formatDateTimeKst(pricingLockedAt)}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">확정 소스</span>
                  <span className="text-sm font-semibold tabular-nums">{pricingSource ?? "-"}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">Gold 스냅샷</span>
                  <span className="text-sm font-semibold">
                    {valuation?.gold_krw_per_g_snapshot === null || valuation?.gold_krw_per_g_snapshot === undefined
                      ? "-"
                      : renderNumber(valuation.gold_krw_per_g_snapshot)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[var(--primary)] block mb-1">Silver 스냅샷</span>
                  <span className="text-sm font-semibold">
                    {valuation?.silver_krw_per_g_snapshot === null || valuation?.silver_krw_per_g_snapshot === undefined
                      ? "-"
                      : renderNumber(valuation.silver_krw_per_g_snapshot)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--primary)]/20">
              {isShipmentConfirmed ? (
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone="active">확정값</Badge>
                    <span className="text-xs text-[var(--muted)]">shipment_line 저장값</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--muted)] block mb-1">재료비(판매)</span>
                      <span className="font-semibold">{formatKrw(currentLine?.material_amount_sell_krw ?? null)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)] block mb-1">기본공임</span>
                      <span className="font-semibold">{formatKrw(currentLine?.base_labor_krw ?? null)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)] block mb-1">기타공임</span>
                      <span className="font-semibold">{formatKrw(currentLine?.extra_labor_krw ?? null)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)] block mb-1">중량</span>
                      <span className="font-semibold">{renderNumber(currentLine?.measured_weight_g ?? null, "g")}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--muted)]">프리뷰 값은 현재 시세/환율 기준으로 달라질 수 있습니다.</p>
                </div>
              ) : effectiveMasterId ? (
                <>
                  <EffectivePriceCard
                    masterId={effectiveMasterId}
                    qty={effectiveQty}
                    variantKey={resolvedVariantKey}
                    title="유효가격 프리뷰"
                    showBreakdown
                    onDataChange={setEffectivePriceData}
                    onStateChange={setEffectivePriceState}
                  />
                  {isBundlePricingBlocked ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="danger">BOM 오류(확정 불가)</Badge>
                      <span className="text-xs text-red-700">{bundlePricingBlockMessage ?? "BUNDLE BOM 오류"}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-[var(--muted)]">매칭된 master가 없어 유효가격 프리뷰를 표시할 수 없습니다.</div>
              )}
            </div>
          </div>

          {/* Cost Mode Selection */}
          <div className="space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Hammer className="w-4 h-4" />
              원가 모드 선택
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setCostMode("PROVISIONAL")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  costMode === "PROVISIONAL"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--panel-border)] hover:border-[var(--panel-border)]"
                )}
              >
                <span className="font-semibold">임시원가 (PROVISIONAL)</span>
                <span className="text-xs text-[var(--muted)]">나중에 원가를 확정합니다</span>
              </button>
              <button
                onClick={() => setCostMode("MANUAL")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  costMode === "MANUAL"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--panel-border)] hover:border-[var(--panel-border)]"
                )}
              >
                <span className="font-semibold">수기입력 (MANUAL)</span>
                <span className="text-xs text-[var(--muted)]">지금 즉시 단가를 입력합니다</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Receipt & Cost Detail */}
            <div className="space-y-4">
              <Card className="border-[var(--panel-border)]">
                <CardHeader className="py-3 border-b border-[var(--panel-border)] bg-[#fcfcfd]">
                  <div className="text-sm font-semibold">영수증 연결 (선택)</div>
                </CardHeader>
                <CardBody className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--muted)]">파일 업로드</div>
                    <div className="flex gap-2">
                      <Input
                        key={receiptFileInputKey}
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        className="text-xs"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleUploadReceipt}
                        disabled={receiptUploading || !receiptFile}
                      >
                        {receiptUploading ? "업로드..." : "업로드"}
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[var(--panel-border)]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[var(--panel)] px-2 text-[var(--muted)]">OR</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--muted)]">기존 영수증 선택</div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchSelect
                          placeholder="영수증 검색..."
                          options={(() => {
                            const receipts = receiptsQuery.data ?? [];
                            const dateIndexMap = new Map<string, number>();
                            const sortedReceipts = [...receipts].sort((a, b) =>
                              new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
                            );
                            return sortedReceipts.map((r) => {
                              const dateKey = r.received_at.slice(0, 10);
                              const currentIndex = (dateIndexMap.get(dateKey) || 0) + 1;
                              dateIndexMap.set(dateKey, currentIndex);
                              const displayName = `영수증_${dateKey.replace(/-/g, '')}_${currentIndex}`;
                              return {
                                label: `${displayName} (${r.status})`,
                                value: r.receipt_id,
                              };
                            });
                          })()}
                          value={linkedReceiptId ?? undefined}
                          onChange={(v) => {
                            setReceiptFile(null);
                            setLinkedReceiptId(v);
                            setReceiptPreviewError(null);
                          }}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={openReceiptInNewTab}
                        disabled={!receiptPreviewOpenUrl && !receiptPreviewSrc}
                      >
                        새 창
                      </Button>
                    </div>
                    {receiptsQuery.isError && (
                      <div className="text-xs text-red-600">{receiptsErrorMessage}</div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {costMode === "MANUAL" ? (
                <Card className="border-[var(--panel-border)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--panel-border)] bg-[#fcfcfd] flex items-center justify-between">
                    <div className="text-sm font-semibold">라인별 단가 입력</div>
                    {hasOtherLines && (
                      <button
                        onClick={() => setShowAllLines((v) => !v)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {showAllLines ? "현재 라인만 보기" : "전체 라인 보기"}
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#f8f9fc] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-medium text-[var(--muted)]">MODEL</th>
                          <th className="px-4 py-2 font-medium text-[var(--muted)]">QTY</th>
                          <th className="px-4 py-2 font-medium text-[var(--muted)]">단가 (KRW)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {currentLinesQuery.isLoading ? (
                          <tr><td colSpan={3} className="px-4 py-4 text-center text-[var(--muted)]">로딩 중...</td></tr>
                        ) : !currentLinesQuery.isLoading && displayedLines.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-4 text-center text-[var(--muted)]">표시할 라인이 없습니다.</td></tr>
                        ) : (
                          displayedLines
                            .filter((l) => Boolean(l.shipment_line_id))
                            .map((l) => {
                              const lineId = String(l.shipment_line_id);
                              return (
                                <tr key={lineId} className="hover:bg-[#f8f9fc]">
                                  <td className="px-4 py-2 font-medium">{l.model_name ?? "-"}</td>
                                  <td className="px-4 py-2 tabular-nums">{l.qty ?? 0}</td>
                                  <td className="px-4 py-2">
                                    <Input
                                      placeholder="0"
                                      value={costInputs[lineId] ?? ""}
                                      onChange={(e) => setCostInputs((prev) => ({ ...prev, [lineId]: e.target.value }))}
                                      className="h-8 tabular-nums"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--panel-border)] p-4 text-center text-sm text-[var(--muted)] bg-[var(--panel)]/50">
                  임시원가 모드에서는 단가를 입력하지 않습니다.
                </div>
              )}
            </div>

            {/* Right: Receipt Preview */}
            <div className="space-y-2">
              <div className="text-sm font-semibold flex items-center justify-between">
                <span>영수증 미리보기</span>
                <div className="flex items-center gap-2">
                  {receiptPreviewTitle && (
                    <span className="text-xs text-[var(--muted)] truncate max-w-[200px]">
                      {receiptPreviewTitle}
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadReceipt}
                    disabled={!receiptPreviewOpenUrl && !receiptPreviewSrc}
                  >
                    다운로드
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--panel-border)] bg-[#2a2a2a] h-[500px] overflow-hidden relative flex items-center justify-center">
                {receiptPreviewError ? (
                  <div className="text-red-400 text-sm px-4 text-center">{receiptPreviewError}</div>
                ) : receiptPreviewSrc ? (
                  receiptPreviewKind === "pdf" ? (
                    <iframe title="preview" src={receiptPreviewSrc} className="w-full h-full" />
                  ) : (
                    <img src={receiptPreviewSrc} alt="preview" className="max-w-full max-h-full object-contain" />
                  )
                ) : (
                  <div className="text-[var(--muted)] text-sm flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 opacity-20" />
                    <span>미리보기 없음</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--panel-border)]">
            <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>취소</Button>
            <Button
              variant="primary"
              onClick={handleFinalConfirm}
              disabled={isConfirming || isBundlePricingBlocked}
              className="px-6"
            >
              {isBundlePricingBlocked
                ? "BOM 오류(확정 불가)"
                : isConfirming
                  ? "처리 중..."
                  : isStorePickup
                    ? "매장출고 저장 (워크벤치에서 확정)"
                    : "출고 확정"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
