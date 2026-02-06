"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { NumberText } from "@/components/ui/number-text";
import { SearchSelect } from "@/components/ui/search-select";
import { Modal } from "@/components/ui/modal";
import { Grid2x2, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-utils";
import { deriveCategoryCodeFromModelName } from "@/lib/model-name";
import { CatalogGalleryGrid } from "@/components/catalog/CatalogGalleryGrid";
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
};

type CatalogDetail = {
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
  note: string;
  releaseDate: string;
  modifiedDate: string;
};

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
  line_count: number;
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
  { label: "00", value: "00" },
];

type VendorOption = { label: string; value: string };

const laborProfileOptions = [
  { label: "수동", value: "MANUAL" },
  { label: "밴드", value: "BAND" },
];

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
  if (label.includes("00")) return "00";
  return "";
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
  const [masterId, setMasterId] = useState("");
  const [modelName, setModelName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [vendorPrefixMap, setVendorPrefixMap] = useState<Record<string, string>>({});
  const [masterRowsById, setMasterRowsById] = useState<Record<string, Record<string, unknown>>>({});
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [materialCode, setMaterialCode] = useState("");
  const [weightDefault, setWeightDefault] = useState("");
  const [deductionWeight, setDeductionWeight] = useState("");
  const [platingSell, setPlatingSell] = useState(0);
  const [platingCost, setPlatingCost] = useState(0);
  const [laborProfileMode, setLaborProfileMode] = useState("MANUAL");
  const [laborBandCode, setLaborBandCode] = useState("");
  const [note, setNote] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [modifiedDate, setModifiedDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [centerQty, setCenterQty] = useState(0);
  const [sub1Qty, setSub1Qty] = useState(0);
  const [sub2Qty, setSub2Qty] = useState(0);
  const [centerStoneName, setCenterStoneName] = useState("");
  const [sub1StoneName, setSub1StoneName] = useState("");
  const [sub2StoneName, setSub2StoneName] = useState("");
  const [laborBaseSell, setLaborBaseSell] = useState(0);
  const [laborCenterSell, setLaborCenterSell] = useState(0);
  const [laborSub1Sell, setLaborSub1Sell] = useState(0);
  const [laborSub2Sell, setLaborSub2Sell] = useState(0);
  const [laborBaseCost, setLaborBaseCost] = useState(0);
  const [laborCenterCost, setLaborCenterCost] = useState(0);
  const [laborSub1Cost, setLaborSub1Cost] = useState(0);
  const [laborSub2Cost, setLaborSub2Cost] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [goldPrice, setGoldPrice] = useState(0);
  const [silverModifiedPrice, setSilverModifiedPrice] = useState(0);
  const [isUnitPricing, setIsUnitPricing] = useState(false);

  const [showBomPanel, setShowBomPanel] = useState(false);
  const [recipeVariantKey, setRecipeVariantKey] = useState("");
  const [recipeNote, setRecipeNote] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [componentType, setComponentType] = useState<"PART" | "MASTER">("MASTER");
  const [showAdvancedComponents, setShowAdvancedComponents] = useState(false);
  const [componentQuery, setComponentQuery] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [qtyPerUnit, setQtyPerUnit] = useState("1");
  const [unit, setUnit] = useState<"EA" | "G" | "M">("EA");
  const [lineNote, setLineNote] = useState("");
  const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null);
  const bomToastRef = useRef(false);

  const schema = getSchemaClient();
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

  // Fetch market prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/market-ticks");
        const result = await response.json();
        if (result.data) {
          setGoldPrice(result.data.gold);
          setSilverModifiedPrice(result.data.silver);
        }
      } catch (error) {
        console.error("Failed to fetch market ticks:", error);
      }
    };
    fetchPrices();
  }, []);

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


  // 1. 필터 상태 추가 (검색어, 재질, 카테고리)
  const [filterQuery, setFilterQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // 2. 필터링 및 정렬 로직 구현 (기존 sortedCatalogItems 교체)
  const sortedCatalogItems = useMemo(() => {
    let filtered = [...catalogItemsState];

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
  }, [catalogItemsState, sortBy, sortOrder, masterRowsById, filterMaterial, filterCategory, filterQuery]);
  const activePageSize = view === "gallery" ? 4 : 5;
  const totalPages = Math.max(1, Math.ceil(sortedCatalogItems.length / activePageSize));
  const totalCount = sortedCatalogItems.length;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * activePageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * activePageSize, totalCount);
  const pageItems = useMemo(() => {
    const start = (page - 1) * activePageSize;
    return sortedCatalogItems.slice(start, start + activePageSize);
  }, [sortedCatalogItems, page, activePageSize]);


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
    const netWeight = weight - deduction;
    if (material === "925") {
      return silverModifiedPrice * netWeight * 0.925;
    } else if (material === "14K" || material === "14") {
      return goldPrice * netWeight * 0.6435;
    } else if (material === "18K" || material === "18") {
      return goldPrice * netWeight * 0.825;
    } else if (material === "24K" || material === "24") {
      return goldPrice * netWeight;
    } else if (material === "00") {
      return 0;
    }
    return 0;
  }, [goldPrice, silverModifiedPrice]);

  function roundUpToThousand(value: number) {
    return Math.ceil(value / 1000) * 1000;
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
      note: String(row.note ?? ""),
      releaseDate: String(row.created_at ?? "").slice(0, 10),
      modifiedDate: String(row.updated_at ?? "").slice(0, 10),
    };
  }, [masterRowsById, selectedItem]);

  useEffect(() => {
    setShowBomPanel(false);
    setSelectedRecipeId(null);
    setRecipeVariantKey("");
    setRecipeNote("");
    setComponentQuery("");
    setSelectedComponentId(null);
    setComponentType("MASTER");
    setShowAdvancedComponents(false);
  }, [selectedMasterId]);

  const recipesQuery = useQuery({
    queryKey: ["bom", "recipes", selectedMasterId],
    enabled: Boolean(schema) && Boolean(selectedMasterId) && showBomPanel,
    queryFn: async () => {
      if (!schema || !selectedMasterId) return [];
      const view = CONTRACTS.views.bomRecipeWorklist;
      const { data, error } = await schema
        .from(view)
        .select("*")
        .eq("product_master_id", selectedMasterId)
        .order("variant_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BomRecipeRow[];
    },
  });

  const recipeOptions = useMemo(() => {
    const rows = recipesQuery.data ?? [];
    return rows.map((r) => ({
      label: `${r.variant_key ? r.variant_key : "(DEFAULT)"} · lines=${r.line_count}${r.is_active ? "" : " · INACTIVE"}`,
      value: r.bom_id,
    }));
  }, [recipesQuery.data]);

  const linesQuery = useQuery({
    queryKey: ["bom", "lines", selectedRecipeId],
    enabled: Boolean(schema) && Boolean(selectedRecipeId) && showBomPanel,
    queryFn: async () => {
      if (!schema || !selectedRecipeId) return [];
      const view = CONTRACTS.views.bomRecipeLinesEnriched;
      const { data, error } = await schema
        .from(view)
        .select("*")
        .eq("bom_id", selectedRecipeId)
        .eq("is_void", false)
        .order("line_no", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BomLineRow[];
    },
  });

  const componentSearchQuery = useQuery({
    queryKey: ["bom", "componentSearch", componentType, componentQuery],
    enabled: showBomPanel && componentQuery.trim().length > 0,
    queryFn: async () => {
      if (componentType === "PART") {
        const res = await fetch(`/api/part-items?q=${encodeURIComponent(componentQuery.trim())}`);
        const json = (await res.json()) as { data?: PartSummary[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "부속 검색 실패");
        return json.data ?? [];
      }
      const res = await fetch(`/api/master-items?model=${encodeURIComponent(componentQuery.trim())}`);
      const json = (await res.json()) as { data?: MasterSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "마스터 검색 실패");
      return json.data ?? [];
    },
  });

  const componentOptions = useMemo(() => {
    const data = componentSearchQuery.data ?? [];
    if (componentType === "PART") {
      return (data as PartSummary[]).map((p) => ({
        label: `${p.part_name}${p.spec_text ? ` (${p.spec_text})` : ""}`,
        value: p.part_id,
      }));
    }
    return (data as MasterSummary[]).map((m) => ({ label: m.model_name, value: m.master_id }));
  }, [componentSearchQuery.data, componentType]);

  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) return null;
    const data = componentSearchQuery.data ?? [];
    if (componentType === "PART") {
      return (data as PartSummary[]).find((p) => p.part_id === selectedComponentId) ?? null;
    }
    return (data as MasterSummary[]).find((m) => m.master_id === selectedComponentId) ?? null;
  }, [componentSearchQuery.data, selectedComponentId, componentType]);

  const upsertRecipeMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.bomRecipeUpsert,
    successMessage: "레시피 저장 완료",
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
      linesQuery.refetch();
      recipesQuery.refetch();
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

  const notifyWriteDisabled = () => {
    if (bomToastRef.current) return;
    toast.error("쓰기 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 또는 RPC 설정을 확인하세요.");
    bomToastRef.current = true;
  };

  useEffect(() => {
    if (!canWrite && !bomToastRef.current && showBomPanel) {
      notifyWriteDisabled();
    }
  }, [canWrite, showBomPanel]);

  const handleCreateRecipe = async () => {
    if (!selectedMasterId) return toast.error("제품(마스터)을 먼저 선택해 주세요.");
    if (!canWrite) return notifyWriteDisabled();

    await upsertRecipeMutation.mutateAsync({
      p_product_master_id: selectedMasterId,
      p_variant_key: recipeVariantKey.trim() ? recipeVariantKey.trim() : null,
      p_is_active: true,
      p_note: recipeNote.trim() ? recipeNote.trim() : null,
      p_meta: {},
      p_bom_id: null,
      p_actor_person_id: actorId,
      p_note2: "upsert from web",
    });
  };

  const handleAddLine = async () => {
    if (!selectedRecipeId) return toast.error("레시피를 먼저 선택해 주세요.");
    if (!selectedComponentId) return toast.error("구성품을 먼저 선택해 주세요.");
    if (!canWrite) return notifyWriteDisabled();

    const qty = Number(qtyPerUnit);
    if (Number.isNaN(qty) || qty <= 0) return toast.error("수량(1개당 사용량)은 0보다 커야 합니다.");

    await addLineMutation.mutateAsync({
      p_bom_id: selectedRecipeId,
      p_component_ref_type: componentType,
      p_component_master_id: componentType === "MASTER" ? selectedComponentId : null,
      p_component_part_id: componentType === "PART" ? selectedComponentId : null,
      p_qty_per_unit: qty,
      p_unit: unit,
      p_note: lineNote.trim() ? lineNote.trim() : null,
      p_meta: {},
      p_actor_person_id: actorId,
      p_note2: "add line from web",
    });
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
    setVoidConfirmId(null);
  };

  const createRecipeDisabled = !selectedMasterId || upsertRecipeMutation.isPending || !canWrite;
  const addLineDisabled = !selectedRecipeId || !selectedComponentId || addLineMutation.isPending || !canWrite;
  const voidActionDisabled = voidLineMutation.isPending || !canWrite;

  const materialPrice = useMemo(() => {
    if (!selectedItem || !selectedDetail) return 0;
    const weight = parseFloat(selectedDetail.weight ?? "0") || 0;
    const deduction = parseFloat(selectedDetail.deductionWeight ?? "0") || 0;
    return calculateMaterialPrice(selectedDetail.materialCode ?? "00", weight, deduction);
  }, [selectedItem, selectedDetail, calculateMaterialPrice]);

  const detailLaborSell = selectedDetail
    ? selectedDetail.laborBaseSell +
      selectedDetail.laborCenterSell * selectedDetail.centerQty +
      selectedDetail.laborSub1Sell * selectedDetail.sub1Qty +
      selectedDetail.laborSub2Sell * selectedDetail.sub2Qty
    : totalLaborSell;
  const detailLaborCost = selectedDetail
    ? selectedDetail.laborBaseCost +
      selectedDetail.laborCenterCost * selectedDetail.centerQty +
      selectedDetail.laborSub1Cost * selectedDetail.sub1Qty +
      selectedDetail.laborSub2Cost * selectedDetail.sub2Qty
    : totalLaborCost;
  const totalEstimatedCost = roundUpToThousand(materialPrice + detailLaborCost);
  const totalEstimatedSell = roundUpToThousand(materialPrice + detailLaborSell);


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
    setMasterId(crypto.randomUUID());
    setCategoryTouched(false);
    setModelName("");
    setVendorId("");
    setCategoryCode("");
    setMaterialCode("");
    setWeightDefault("");
    setDeductionWeight("");
    setCenterQty(0);
    setSub1Qty(0);
    setSub2Qty(0);
    setCenterStoneName("");
    setSub1StoneName("");
    setSub2StoneName("");
    setLaborBaseSell(0);
    setLaborCenterSell(0);
    setLaborSub1Sell(0);
    setLaborSub2Sell(0);
    setLaborBaseCost(0);
    setLaborCenterCost(0);
    setLaborSub1Cost(0);
    setLaborSub2Cost(0);
    setPlatingSell(0);
    setPlatingCost(0);
    setLaborProfileMode("MANUAL");
    setLaborBandCode("");
    setNote("");
    setReleaseDate(today);
    setModifiedDate("");
    setImageUrl(null);
    setImagePath(null);
    setIsUnitPricing(false);
  };

  const handleOpenNew = () => {
    setIsEditMode(false);
    resetForm();
    setRegisterOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedItem || !selectedItemId) return;
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
    setCategoryTouched(true);
    setCategoryCode(detail?.categoryCode ?? "");
    setMaterialCode(detail?.materialCode ?? materialCodeFromLabel(selectedItem.material));
    setWeightDefault(row?.weight_default_g ? String(row.weight_default_g) : "");
    setDeductionWeight(row?.deduction_weight_default_g ? String(row.deduction_weight_default_g) : "");
    setCenterQty(detail?.centerQty ?? 0);
    setSub1Qty(detail?.sub1Qty ?? 0);
    setSub2Qty(detail?.sub2Qty ?? 0);
    setCenterStoneName(detail?.centerStoneName ?? "");
    setSub1StoneName(detail?.sub1StoneName ?? "");
    setSub2StoneName(detail?.sub2StoneName ?? "");
    setLaborBaseSell(detail?.laborBaseSell ?? 0);
    setLaborCenterSell(detail?.laborCenterSell ?? 0);
    setLaborSub1Sell(detail?.laborSub1Sell ?? 0);
    setLaborSub2Sell(detail?.laborSub2Sell ?? 0);
    setLaborBaseCost(detail?.laborBaseCost ?? 0);
    setLaborCenterCost(detail?.laborCenterCost ?? 0);
    setLaborSub1Cost(detail?.laborSub1Cost ?? 0);
    setLaborSub2Cost(detail?.laborSub2Cost ?? 0);
    setPlatingSell(detail?.platingSell ?? 0);
    setPlatingCost(detail?.platingCost ?? 0);
    setLaborProfileMode(detail?.laborProfileMode ?? "MANUAL");
    setLaborBandCode(detail?.laborBandCode ?? "");
    setNote(detail?.note ?? "");
    setReleaseDate(detail?.releaseDate ?? selectedItem.date);
    setModifiedDate(today);

    // Populate image data
    setImageUrl(row?.image_url ? String(row.image_url) : null);
    setImagePath(row?.image_path ? String(row.image_path) : null);
    setIsUnitPricing(Boolean(row?.is_unit_pricing));

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

    const normalizedLaborProfileMode =
      laborProfileMode === "BAND" && !laborBandCode.trim() ? "MANUAL" : laborProfileMode;
    const normalizedLaborBandCode =
      normalizedLaborProfileMode === "BAND" ? laborBandCode.trim() || null : null;

    const payload = {
      master_id: masterId || null,
      model_name: modelName,
      category_code: categoryCode || null,
      material_code_default: materialCode || null,
      weight_default_g: weightDefault ? Number(weightDefault) : null,
      deduction_weight_default_g: deductionWeight ? Number(deductionWeight) : 0,
      center_qty_default: centerQty,
      sub1_qty_default: sub1Qty,
      sub2_qty_default: sub2Qty,
      center_stone_name_default: centerStoneName || null,
      sub1_stone_name_default: sub1StoneName || null,
      sub2_stone_name_default: sub2StoneName || null,
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

  return (
    <>
      <div className="space-y-4" id="catalog.root">
        <ActionBar
          title={
            <div className="flex items-center gap-3">
              <span>상품 카탈로그</span>
              <span className="rounded-full bg-[var(--chip)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                410개
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
                    "flex h-8 w-8 items-center justify-center rounded-[10px]",
                    view === "list" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)]"
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
                    "flex h-8 w-8 items-center justify-center rounded-[10px]",
                    view === "gallery" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)]"
                  )}
                >
                  <Grid2x2 size={16} />
                </button>
              </div>
            </div>
          }
          id="catalog.actionBar"
        />
        <div id="catalog.body">
          <SplitLayout
            className="gap-6 items-start"
            left={
              <div className="flex flex-col gap-3 h-full" id="catalog.listPanel">
                <div className="sticky top-3 z-10 flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)]/95 px-4 py-3 shadow-sm ring-1 ring-[var(--panel-border)]/60 backdrop-blur">
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
                  ) : view === "list" ? (
                    /* [리스트 뷰] */
                    <div className="space-y-3">
                      {pageItems.map((item) => (
                        <Card
                          key={item.id}
                          className={cn(
                            "cursor-pointer p-3 transition",
                            getMaterialBgColor(
                              String(
                                masterRowsById[item.id]?.material_code_default ??
                                "00"
                              )
                            ),
                            item.id === selectedItemId
                              ? "ring-2 ring-[var(--primary)]"
                              : "hover:opacity-90"
                          )}
                          onClick={() => setSelectedItemId(item.id)}
                          onDoubleClick={handleOpenEdit} // ✅ 카드 전체 더블클릭 -> 수정창 열기
                        >
                          <div className="flex gap-4">
                            {/* 이미지 영역 */}
                            <div
                              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--panel)] to-[var(--background)]"
                              onDoubleClick={(e) => {
                                // ✅ 이미지 더블클릭 시: 상위(카드)로 전파 막고(=수정창 안열림), 이미지 프리뷰 실행
                                e.stopPropagation();
                                if (item.imageUrl)
                                  setPreviewImage(item.imageUrl);
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
                              <p className="text-sm text-[var(--muted)]">
                                {item.name}
                              </p>
                              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                                {[
                                  { label: "중량", value: item.weight },
                                  { label: "재질", value: item.material },
                                  { label: "스톤", value: item.stone },
                                  {
                                    label: "공급처",
                                    value: vendorLabelById.get(item.vendor) ?? item.vendor,
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
                  ) : (
                    /* [갤러리 뷰] */
                    <CatalogGalleryGrid
                      items={pageItems}
                      selectedItemId={selectedItemId}
                      masterRowsById={masterRowsById}
                      calculateMaterialPrice={calculateMaterialPrice}
                      getMaterialBgColor={getMaterialBgColor}
                      setSelectedItemId={setSelectedItemId}
                      handleOpenEdit={handleOpenEdit}
                      setPreviewImage={setPreviewImage}
                    />
                  )}
                </div>
              </div>
            }
            right={
              <div className="space-y-3" id="catalog.detailPanel">
                {/* 1. 상단 필터 영역 (연동 완료) */}
                <div className="grid grid-cols-12 gap-2">
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
                    className="col-span-12 md:col-span-8"
                    value={filterQuery}
                    onChange={(e) => {
                      setFilterQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {/* 2. 메인 컨텐츠 영역 */}
                <div
                  className={cn(
                    // ✅ 고정폭(예: 700px) 때문에 좌측이 과도하게 눌려 '세로로 이상하게 쌓이는' 문제를 방지
                    // - 우측(예약) 폭은 420~520px 사이에서만 커지도록 제한
                    // - 2xl(대형 화면)에서만 2열(상세+예약)로 붙이고, 그 이하에서는 자연스럽게 세로 스택(=깨짐 방지)
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

                      {/* 가격 통계 박스들 */}
                      <div className="grid grid-cols-2 gap-2 flex-1 min-w-0 xl:grid-cols-1">
                        <div className="flex flex-col items-center justify-center text-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                          <p className="text-xs text-[var(--muted)]">
                            예상 총 금액 (판매)
                          </p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            <NumberText value={totalEstimatedSell} /> 원
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                          <p className="text-xs text-[var(--muted)]">
                            예상 총 금액 (원가)
                          </p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            <NumberText value={totalEstimatedCost} /> 원
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                          <p className="text-xs text-[var(--muted)]">판매 합계공임</p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            <NumberText value={detailLaborSell} /> 원
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                          <p className="text-xs text-[var(--muted)]">원가 합계공임</p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            <NumberText value={detailLaborCost} /> 원
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B. 상세 정보 카드 */}
                    <Card id="catalog.detail.merged">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-[var(--foreground)]">
                              상세 정보
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleOpenEdit}
                              disabled={!selectedItem}
                            >
                              마스터 수정
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowBomPanel((prev) => !prev)}
                              disabled={!selectedItem}
                              className={cn(
                                showBomPanel && "border-[var(--primary)] text-[var(--primary)]"
                              )}
                            >
                              부속
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody className="space-y-3">
                        <div className="grid grid-cols-6 gap-2">
                          <Input
                            className="col-span-3"
                            placeholder="모델명"
                            value={selectedItem?.model ?? ""}
                            readOnly
                          />
                          <Input
                            className="col-span-1"
                            placeholder="공급처"
                            value={selectedVendorName}
                            readOnly
                          />
                          <Select value={selectedDetail?.materialCode ?? ""} disabled>
                            <option value="">소재</option>
                            {materialOptions.map((material) => (
                              <option key={material.value} value={material.value}>
                                {material.label}
                              </option>
                            ))}
                          </Select>
                          <Select value={selectedDetail?.categoryCode ?? ""} disabled>
                            <option value="">카테고리 코드</option>
                            {categoryOptions.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </Select>
                          <Input
                            className="col-span-2"
                            placeholder="순중량 (g)"
                            value={(() => {
                              const weight = parseFloat(String(selectedDetail?.weight ?? ""));
                              const deduction = parseFloat(String(selectedDetail?.deductionWeight ?? ""));
                              if (!Number.isFinite(weight)) return "";
                              const safeDeduction = Number.isFinite(deduction) ? deduction : 0;
                              return `${(weight - safeDeduction).toFixed(2)} g`;
                            })()}
                            readOnly
                          />
                          <Input
                            className="col-span-2"
                            placeholder="총중량 (g)"
                            value={selectedDetail?.weight ?? ""}
                            readOnly
                          />
                          <Input
                            className="col-span-2"
                            placeholder="차감 중량 (g)"
                            value={selectedDetail?.deductionWeight ?? ""}
                            readOnly
                          />
                        </div>
                        <div>
                          <div className="mb-2 grid grid-cols-10 gap-2 text-xs font-semibold text-[var(--muted)]">
                            <div className="col-span-2 text-center">항목</div>
                            <div className="col-span-3 text-center">공임 (판매)</div>
                            <div className="col-span-2 text-center">수량</div>
                            <div className="col-span-3 text-center">공임 (원가)</div>
                          </div>
                          <div className="space-y-2">
                            {/* 합계공임 */}
                            <div className="grid grid-cols-10 gap-2">
                              <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  합계공임
                                </span>
                              </div>
                              <Input
                                className="col-span-3 text-center"
                                placeholder="합계 (판매)"
                                value={selectedDetail?.laborTotalSell ?? ""}
                                readOnly
                              />
                              <div className="col-span-2" />
                              <Input
                                className="col-span-3 text-center"
                                placeholder="합계 (원가)"
                                value={selectedDetail?.laborTotalCost ?? ""}
                                readOnly
                              />
                            </div>
                            {/* 기본공임 */}
                            <div className="grid grid-cols-10 gap-2">
                              <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  기본공임
                                </span>
                              </div>
                              <Input
                                className="col-span-3 text-center"
                                placeholder="기본 (판매)"
                                value={selectedDetail?.laborBaseSell ?? ""}
                                readOnly
                              />
                              <div className="col-span-2" />
                              <Input
                                className="col-span-3 text-center"
                                placeholder="기본 (원가)"
                                value={selectedDetail?.laborBaseCost ?? ""}
                                readOnly
                              />
                            </div>
                            {/* 중심공임 */}
                            <div className="grid grid-cols-10 gap-2">
                              <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  중심공임
                                </span>
                              </div>
                              <Input
                                className="col-span-3 text-center"
                                placeholder="센터 (판매)"
                                value={selectedDetail?.laborCenterSell ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-2 text-center"
                                placeholder="중심석"
                                value={selectedDetail?.centerQty ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-3 text-center"
                                placeholder="센터 (원가)"
                                value={selectedDetail?.laborCenterCost ?? ""}
                                readOnly
                              />
                            </div>
                            {/* 보조1공임 */}
                            <div className="grid grid-cols-10 gap-2">
                              <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  보조1공임
                                </span>
                              </div>
                              <Input
                                className="col-span-3 text-center"
                                placeholder="서브1 (판매)"
                                value={selectedDetail?.laborSub1Sell ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-2 text-center"
                                placeholder="보조1석"
                                value={selectedDetail?.sub1Qty ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-3 text-center"
                                placeholder="서브1 (원가)"
                                value={selectedDetail?.laborSub1Cost ?? ""}
                                readOnly
                              />
                            </div>
                            {/* 보조2공임 */}
                            <div className="grid grid-cols-10 gap-2">
                              <div className="col-span-2 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  보조2공임
                                </span>
                              </div>
                              <Input
                                className="col-span-3 text-center"
                                placeholder="서브2 (판매)"
                                value={selectedDetail?.laborSub2Sell ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-2 text-center"
                                placeholder="보조2석"
                                value={selectedDetail?.sub2Qty ?? ""}
                                readOnly
                              />
                              <Input
                                className="col-span-3 text-center"
                                placeholder="서브2 (원가)"
                                value={selectedDetail?.laborSub2Cost ?? ""}
                                readOnly
                              />
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* C. 추가 메모 카드 */}
                    <Card id="catalog.detail.raw" className="-mt-2">
                      <CardHeader>
                        <ActionBar title="추가 메모" />
                      </CardHeader>
                      <CardBody className="py-3">
                        <Textarea
                          placeholder="내부 메모"
                          value={selectedDetail?.note ?? ""}
                          readOnly
                        />
                      </CardBody>
                    </Card>

                    {showBomPanel ? (
                      <div className="space-y-4" id="catalog.detail.bom">
                        <ActionBar
                          title="자재명세서(BOM)"
                          subtitle="부속/메달 구성품을 마스터 기준으로 관리합니다."
                          actions={
                            <span
                              className="inline-flex"
                              title={!selectedMasterId ? "마스터를 먼저 선택해 주세요." : !canWrite ? writeDisabledReason : undefined}
                            >
                              <Button onClick={handleCreateRecipe} disabled={createRecipeDisabled}>
                                레시피 저장
                              </Button>
                            </span>
                          }
                        />

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
                          <SplitLayout
                            left={
                              <div className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <div className="text-sm font-semibold">선택된 마스터</div>
                                  </CardHeader>
                                  <CardBody className="space-y-2">
                                    <div className="text-sm font-semibold text-[var(--foreground)]">
                                      {selectedItem?.model ?? "-"}
                                    </div>
                                    <div className="text-xs text-[var(--muted)]">master_id: {selectedMasterId}</div>
                                  </CardBody>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <div className="text-sm font-semibold">레시피(Variant) 선택</div>
                                  </CardHeader>
                                  <CardBody className="space-y-3">
                                    <SearchSelect
                                      label="레시피 선택"
                                      placeholder="레시피를 선택하세요"
                                      options={recipeOptions}
                                      value={selectedRecipeId ?? undefined}
                                      onChange={(v) => setSelectedRecipeId(v)}
                                    />
                                  </CardBody>
                                </Card>
                              </div>
                            }
                            right={
                              <div className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <div className="text-sm font-semibold">레시피 상세</div>
                                  </CardHeader>
                                  <CardBody className="space-y-3">
                                    <Input
                                      placeholder="variant_key (예: suffix / color / size). 비우면 DEFAULT"
                                      value={recipeVariantKey}
                                      onChange={(e) => setRecipeVariantKey(e.target.value)}
                                    />
                                    <Textarea
                                      placeholder="메모(선택)"
                                      value={recipeNote}
                                      onChange={(e) => setRecipeNote(e.target.value)}
                                    />
                                    <div className="text-xs text-[var(--muted)]">
                                      현재 선택된 마스터 기준으로 레시피를 저장합니다.
                                    </div>
                                  </CardBody>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold">구성품(부속/메달) 추가</div>
                                      <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={showAdvancedComponents}
                                          onChange={(e) => {
                                            setShowAdvancedComponents(e.target.checked);
                                            if (!e.target.checked) {
                                              setComponentType("MASTER");
                                              setSelectedComponentId(null);
                                              setComponentQuery("");
                                            }
                                          }}
                                          className="rounded border-[var(--panel-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                                        />
                                        Advanced: PART
                                      </label>
                                    </div>
                                  </CardHeader>
                                  <CardBody className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      {showAdvancedComponents ? (
                                        <Select
                                          aria-label="구성품 타입"
                                          value={componentType}
                                          onChange={(e) => {
                                            const v = (e.target.value as "PART" | "MASTER") ?? "MASTER";
                                            setComponentType(v);
                                            setSelectedComponentId(null);
                                            setComponentQuery("");
                                          }}
                                        >
                                          <option value="MASTER">MASTER (메달/완제품)</option>
                                          <option value="PART">PART (부속/스톤)</option>
                                        </Select>
                                      ) : (
                                        <div className="flex items-center px-3 text-sm font-medium text-[var(--muted-strong)] bg-[var(--subtle-bg)] border border-[var(--panel-border)] rounded-[var(--radius)] h-10 select-none">
                                          MASTER (메달/완제품)
                                        </div>
                                      )}

                                      <Select aria-label="단위" value={unit} onChange={(e) => setUnit(e.target.value as "EA" | "G" | "M")}>
                                        <option value="EA">EA</option>
                                        <option value="G">G</option>
                                        <option value="M">M</option>
                                      </Select>
                                    </div>

                                    <Input
                                      placeholder={componentType === "PART" ? "부속명 검색" : "마스터 모델명 검색"}
                                      value={componentQuery}
                                      onChange={(e) => setComponentQuery(e.target.value)}
                                    />

                                    <SearchSelect
                                      label="구성품 선택"
                                      placeholder="위에서 검색어 입력"
                                      options={componentOptions}
                                      value={selectedComponentId ?? undefined}
                                      onChange={(v) => setSelectedComponentId(v)}
                                    />

                                    {selectedComponent ? (
                                      <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <Badge tone="neutral">{componentType}</Badge>
                                          {componentType === "MASTER" && (selectedComponent as MasterSummary).category_code ? (
                                            <Badge tone="primary">{(selectedComponent as MasterSummary).category_code}</Badge>
                                          ) : null}
                                          {componentType === "PART" && (selectedComponent as PartSummary).part_kind ? (
                                            <Badge tone="warning">{(selectedComponent as PartSummary).part_kind}</Badge>
                                          ) : null}
                                        </div>
                                        <div className="font-semibold text-[var(--foreground)]">
                                          {componentType === "MASTER"
                                            ? (selectedComponent as MasterSummary).model_name
                                            : (selectedComponent as PartSummary).part_name}
                                        </div>
                                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                                          <div>
                                            unit_default: {componentType === "PART" ? (selectedComponent as PartSummary).unit_default ?? "-" : "-"}
                                          </div>
                                          <div>
                                            spec_text: {componentType === "PART" ? (selectedComponent as PartSummary).spec_text ?? "-" : "-"}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}

                                    <div className="grid grid-cols-2 gap-2">
                                      <Input aria-label="1개당 사용량" value={qtyPerUnit} onChange={(e) => setQtyPerUnit(e.target.value)} />
                                      <Input aria-label="메모(선택)" value={lineNote} onChange={(e) => setLineNote(e.target.value)} />
                                    </div>

                                    <span className="inline-flex" title={!canWrite ? writeDisabledReason : undefined}>
                                      <Button onClick={handleAddLine} disabled={addLineDisabled}>
                                        구성품 추가
                                      </Button>
                                    </span>

                                    <div className="text-xs text-[var(--muted)]">
                                      출고 확정 시 레시피가 있으면 구성품이 자동 OUT 기록됩니다.
                                    </div>
                                  </CardBody>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <div className="text-sm font-semibold">현재 구성품 목록</div>
                                  </CardHeader>
                                  <CardBody className="space-y-2">
                                    {!selectedRecipeId ? (
                                      <p className="text-sm text-[var(--muted)]">레시피를 선택하면 구성품이 표시됩니다.</p>
                                    ) : linesQuery.isLoading ? (
                                      <p className="text-sm text-[var(--muted)]">불러오는 중...</p>
                                    ) : (linesQuery.data ?? []).length === 0 ? (
                                      <p className="text-sm text-[var(--muted)]">등록된 구성품이 없습니다.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-12 gap-3 px-3 text-xs text-[var(--muted)]">
                                          <div className="col-span-5">구성품</div>
                                          <div className="col-span-2">qty_per_unit</div>
                                          <div className="col-span-1">unit</div>
                                          <div className="col-span-3">note</div>
                                          <div className="col-span-1 text-right">VOID</div>
                                        </div>
                                        {(linesQuery.data ?? []).map((line) => {
                                          const name =
                                            line.component_ref_type === "PART"
                                              ? line.component_part_name ?? "(unknown part)"
                                              : line.component_master_model_name ?? "(unknown master)";
                                          return (
                                            <div
                                              key={line.bom_line_id}
                                              className="grid grid-cols-12 gap-3 items-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                                            >
                                              <div className="col-span-5 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                  <Badge tone={line.component_ref_type === "MASTER" ? "primary" : "neutral"}>
                                                    {line.component_ref_type}
                                                  </Badge>
                                                  <div className="truncate text-sm font-semibold">{name}</div>
                                                </div>
                                                <div className="truncate text-xs text-[var(--muted)]">line_no={line.line_no}</div>
                                              </div>
                                              <div className="col-span-2 text-sm">{line.qty_per_unit}</div>
                                              <div className="col-span-1 text-sm">{line.unit}</div>
                                              <div className="col-span-3 text-xs text-[var(--muted)] truncate">
                                                {line.note ? line.note : "-"}
                                              </div>
                                              <div className="col-span-1 flex justify-end">
                                                <span className="inline-flex" title={!canWrite ? writeDisabledReason : undefined}>
                                                  <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => setVoidConfirmId(line.bom_line_id)}
                                                    disabled={voidActionDisabled}
                                                    className="shrink-0"
                                                  >
                                                    VOID
                                                  </Button>
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </CardBody>
                                </Card>
                              </div>
                            }
                          />
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
                    ) : null}
                  </div>

                  {/* [오른쪽 기둥] 예약 공간 */}
                  <aside className="min-w-0 rounded-[14px] border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-4 sticky top-24 self-start">
                    <div className="flex h-[min(62vh,680px)] items-center justify-center">
                      <p className="text-xs text-[var(--muted)]">예약 공간</p>
                    </div>
                  </aside>
                </div>
              </div>
            }
          />
        </div>
      </div>
      <Modal
        open={registerOpen}
        onClose={() => {
          setRegisterOpen(false);
          setIsSaving(false);
          setUploadError(null);
          setUploadingImage(false);
        }}
        title={isEditMode ? "마스터 수정" : "새 상품 등록"}
        className="max-w-6xl"
      >
        <div
          className="grid gap-6 lg:grid-cols-[320px,1fr]"
          // ✅ [유지] 내부 내용물을 더블클릭했을 때는 닫히지 않도록 이벤트 전파를 막습니다.
          // 이 코드가 있어야 배경 더블클릭 감지(useEffect)가 정상 작동합니다.
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
                  accept="image/*"
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
            className="flex flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="pr-2">
              <div className="grid gap-6 lg:grid-cols-2 h-full">
                {/* 2-1. 좌측 열: 기본 정보 및 비고 */}
                <div className="flex flex-col gap-4 h-full">
                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        기본 정보
                      </p>
                      <span className="text-xs text-[var(--muted)]">
                        필수 항목 포함
                      </span>
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
                            if (!categoryTouched && derived) {
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
                            setCategoryTouched(true);
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
                        />
                      </Field>
                      <Field label="단가제 (확정 시 RULE 올림 적용)">
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-sm">
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
                          <div className="text-[11px] text-[var(--muted)] leading-relaxed">
                            <p>체크된 모델은 확정 시 RULE 계산 판매가가 설정된 올림 단위로 자동 올림됩니다.</p>
                            <p>총액 덮어쓰기는 제외됩니다.</p>
                            {!canToggleUnitPricing ? <p>저장 후 설정 가능</p> : null}
                          </div>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 flex flex-col">
                    <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                      비고
                    </p>
                    <Textarea
                      placeholder="상품에 대한 상세 정보를 입력하세요."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="resize-none h-[17rem]"
                    />
                  </div>
                </div>

                {/* 2-2. 우측 열: 공임 및 프로파일 설정 */}
                <div className="space-y-4">
                  <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        공임 및 구성
                      </p>
                      <div className="flex gap-2">
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
                      <div className="text-center font-semibold text-[var(--muted)]">
                        원가 (Cost)
                      </div>

                      {/* Base */}
                      <div className="text-center font-medium text-[var(--foreground)]">
                        기본
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={laborBaseSell}
                        onChange={(e) =>
                          setLaborBaseSell(toNumber(e.target.value))
                        }
                      />
                      <div className="text-center text-[var(--muted)]">-</div>
                      <Input
                        type="number"
                        min={0}
                        value={laborBaseCost}
                        onChange={(e) =>
                          setLaborBaseCost(toNumber(e.target.value))
                        }
                      />

                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Center */}
                      <div className="text-center text-[var(--muted)]">센터석</div>
                      <Input
                        className="col-span-3"
                        placeholder="센터석 이름"
                        value={centerStoneName}
                        onChange={(e) => setCenterStoneName(e.target.value)}
                      />
                      <div className="text-center font-medium text-[var(--foreground)]">
                        센터
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={laborCenterSell}
                        onChange={(e) =>
                          setLaborCenterSell(toNumber(e.target.value))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-[var(--input-bg)]"
                        value={centerQty}
                        onChange={(e) => setCenterQty(toNumber(e.target.value))}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborCenterCost}
                        onChange={(e) =>
                          setLaborCenterCost(toNumber(e.target.value))
                        }
                      />
                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Sub1 */}
                      <div className="text-center text-[var(--muted)]">서브1석</div>
                      <Input
                        className="col-span-3"
                        placeholder="서브1석 이름"
                        value={sub1StoneName}
                        onChange={(e) => setSub1StoneName(e.target.value)}
                      />
                      <div className="text-center font-medium text-[var(--foreground)]">
                        서브1
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={laborSub1Sell}
                        onChange={(e) =>
                          setLaborSub1Sell(toNumber(e.target.value))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-[var(--input-bg)]"
                        value={sub1Qty}
                        onChange={(e) => setSub1Qty(toNumber(e.target.value))}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborSub1Cost}
                        onChange={(e) =>
                          setLaborSub1Cost(toNumber(e.target.value))
                        }
                      />
                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)]/70" />

                      {/* Sub2 */}
                      <div className="text-center text-[var(--muted)]">서브2석</div>
                      <Input
                        className="col-span-3"
                        placeholder="서브2석 이름"
                        value={sub2StoneName}
                        onChange={(e) => setSub2StoneName(e.target.value)}
                      />
                      <div className="text-center font-medium text-[var(--foreground)]">
                        서브2
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={laborSub2Sell}
                        onChange={(e) =>
                          setLaborSub2Sell(toNumber(e.target.value))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="수량"
                        className="text-center bg-[var(--input-bg)]"
                        value={sub2Qty}
                        onChange={(e) => setSub2Qty(toNumber(e.target.value))}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={laborSub2Cost}
                        onChange={(e) =>
                          setLaborSub2Cost(toNumber(e.target.value))
                        }
                      />

                      <div className="col-span-4 h-px bg-dashed border-t border-[var(--panel-border)] my-2" />

                      {/* Plating */}
                      <div className="text-center font-medium text-[var(--muted)]">
                        도금
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={platingSell}
                        onChange={(e) =>
                          setPlatingSell(toNumber(e.target.value))
                        }
                      />
                      <div className="text-center text-[var(--muted)]">-</div>
                      <Input
                        type="number"
                        min={0}
                        value={platingCost}
                        onChange={(e) =>
                          setPlatingCost(toNumber(e.target.value))
                        }
                      />

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
                        value={totalLaborSell}
                      />
                      <div className="text-center text-[var(--muted)]">-</div>
                      <Input
                        type="number"
                        min={0}
                        readOnly
                        autoFormat={false}
                        className="text-right font-bold bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--panel-border)]"
                        value={totalLaborCost}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--panel-border)] bg-[var(--panel)] pt-4">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setRegisterOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={!canSave || isSaving}>
                저장
              </Button>
            </div>
          </form>
        </div>
      </Modal>
      {/* Custom Lightbox Overlay */}
      {previewImage && (
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
      )}
    </>
  );
}
