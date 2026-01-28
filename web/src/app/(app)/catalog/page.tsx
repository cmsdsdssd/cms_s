"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Grid2x2, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
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

const catalogItems: CatalogItem[] = [
  {
    id: "4949R",
    model: "4949R",
    name: "다이아 밴드",
    date: "2025-12-16",
    status: "판매 중",
    tone: "active",
    weight: "3.45 g",
    material: "14K 로즈골드",
    stone: "다이아 0.2ct",
    vendor: "글로벌 젬스",
    color: "로즈(P)",
    cost: "₩185,000",
    grades: ["₩450", "₩420", "₩390", "₩350"],
  },
  {
    id: "5980R",
    model: "5980R",
    name: "클래식 웨딩",
    date: "2025-12-15",
    status: "이미지 대기",
    tone: "warning",
    weight: "5.10 g",
    material: "18K 화이트골드",
    stone: "없음",
    vendor: "로컬 아티산",
    color: "화이트(W)",
    cost: "₩210,000",
    grades: ["₩550", "₩520", "₩490", "₩450"],
  },
  {
    id: "4184B",
    model: "4184B",
    name: "빈티지 펜던트",
    date: "2025-12-14",
    status: "신규",
    tone: "neutral",
    weight: "2.15 g",
    material: "14K 옐로골드",
    stone: "사파이어",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩140,000",
    grades: ["₩320", "₩300", "₩280", "₩250"],
  },
  {
    id: "6220W",
    model: "6220W",
    name: "모던 링",
    date: "2025-12-12",
    status: "판매 중",
    tone: "active",
    weight: "3.80 g",
    material: "18K 화이트골드",
    stone: "다이아 0.1ct",
    vendor: "아뜰리에 K",
    color: "화이트(W)",
    cost: "₩210,000",
    grades: ["₩520", "₩500", "₩470", "₩430"],
  },
  {
    id: "7012G",
    model: "7012G",
    name: "클래식 체인",
    date: "2025-12-10",
    status: "판매 중",
    tone: "active",
    weight: "4.05 g",
    material: "14K 옐로골드",
    stone: "없음",
    vendor: "실버라인",
    color: "옐로(Y)",
    cost: "₩160,000",
    grades: ["₩330", "₩310", "₩290", "₩260"],
  },
  {
    id: "8831P",
    model: "8831P",
    name: "피어싱 라인",
    date: "2025-12-08",
    status: "이미지 대기",
    tone: "warning",
    weight: "1.40 g",
    material: "14K 로즈골드",
    stone: "없음",
    vendor: "로즈 아뜰리에",
    color: "로즈(P)",
    cost: "₩120,000",
    grades: ["₩280", "₩260", "₩240", "₩220"],
  },
  {
    id: "9902N",
    model: "9902N",
    name: "네크리스 라인",
    date: "2025-12-07",
    status: "판매 중",
    tone: "active",
    weight: "6.20 g",
    material: "18K 옐로골드",
    stone: "루비",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩260,000",
    grades: ["₩650", "₩620", "₩580", "₩540"],
  },
  {
    id: "3091B",
    model: "3091B",
    name: "브레이슬릿",
    date: "2025-12-05",
    status: "신규",
    tone: "neutral",
    weight: "5.75 g",
    material: "14K 옐로골드",
    stone: "없음",
    vendor: "로컬 아티산",
    color: "옐로(Y)",
    cost: "₩190,000",
    grades: ["₩420", "₩400", "₩380", "₩360"],
  },
  {
    id: "5511W",
    model: "5511W",
    name: "베이직 링",
    date: "2025-12-03",
    status: "판매 중",
    tone: "active",
    weight: "2.95 g",
    material: "18K 화이트골드",
    stone: "없음",
    vendor: "럭스 스튜디오",
    color: "화이트(W)",
    cost: "₩150,000",
    grades: ["₩360", "₩340", "₩320", "₩300"],
  },
  {
    id: "7208G",
    model: "7208G",
    name: "팬던트 라이트",
    date: "2025-12-01",
    status: "이미지 대기",
    tone: "warning",
    weight: "2.05 g",
    material: "14K 옐로골드",
    stone: "진주",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩135,000",
    grades: ["₩310", "₩295", "₩275", "₩250"],
  },
];

// pageSize is dynamic based on view

const categoryOptions = [
  { label: "팔찌", value: "BRACELET" },
  { label: "목걸이", value: "NECKLACE" },
  { label: "귀걸이", value: "EARRING" },
  { label: "반지", value: "RING" },
  { label: "피어싱", value: "PIERCING" },
  { label: "펜던트", value: "PENDANT" },
  { label: "시계", value: "WATCH" },
  { label: "키링", value: "KEYRING" },
  { label: "상징", value: "SYMBOL" },
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
  if (materialCode === "925") return "bg-gradient-to-br from-[#d8dfe7] to-[#e8ecf0]"; // Silver
  if (materialCode === "14" || materialCode === "18") return "bg-gradient-to-br from-[#f9e8e5] to-[#fdf5f3]"; // Rose Gold (light)
  if (materialCode === "24") return "bg-gradient-to-br from-[#fef3d9] to-[#fffcf3]"; // Gold (light)
  if (materialCode === "00") return "bg-white"; // White
  return "bg-white"; // Default
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const [catalogItemsState, setCatalogItemsState] = useState<CatalogItem[]>(catalogItems);
  const [view, setView] = useState<"list" | "gallery">("gallery");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"model" | "modified">("model");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(catalogItems[0]?.id ?? null);
  const [masterId, setMasterId] = useState("");
  const [modelName, setModelName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [masterRowsById, setMasterRowsById] = useState<Record<string, Record<string, unknown>>>({});
  const [categoryCode, setCategoryCode] = useState("");
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

  const canSave = true;

  const today = new Date().toISOString().slice(0, 10);
  const totalLaborSell =
    laborBaseSell + laborCenterSell * centerQty + laborSub1Sell * sub1Qty + laborSub2Sell * sub2Qty;
  const totalLaborCost =
    laborBaseCost + laborCenterCost * centerQty + laborSub1Cost * sub1Qty + laborSub2Cost * sub2Qty;


  const sortedCatalogItems = useMemo(() => {
    const sorted = [...catalogItemsState].sort((a, b) => {
      if (sortBy === "model") {
        return sortOrder === "asc"
          ? a.model.localeCompare(b.model)
          : b.model.localeCompare(a.model);
      } else {
        // Sort by modified date (using date field as proxy for modified)
        return sortOrder === "asc"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [catalogItemsState, sortBy, sortOrder]);

  const activePageSize = view === "gallery" ? 12 : 5;
  const totalPages = Math.ceil(sortedCatalogItems.length / activePageSize);
  const pageItems = useMemo(() => {
    const start = (page - 1) * activePageSize;
    return sortedCatalogItems.slice(start, start + activePageSize);
  }, [sortedCatalogItems, page, activePageSize]);

  const selectedItem = useMemo(
    () => catalogItemsState.find((item) => item.id === selectedItemId) ?? null,
    [catalogItemsState, selectedItemId]
  );

  // Calculate material price based on material code
  const calculateMaterialPrice = (material: string, weight: number, deduction: number) => {
    const netWeight = weight - deduction;
    if (material === "925") {
      return silverModifiedPrice * netWeight;
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
  };


  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/vendors");
      const result = (await response.json()) as {
        data?: { party_id?: string; name?: string }[];
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "공급처 조회 실패";
      toast.error("처리 실패", { description: message });
    }
  }, []);

  const fetchCatalogItems = useCallback(async () => {
    try {
      const response = await fetch("/api/master-items");
      const result = (await response.json()) as { data?: Record<string, unknown>[]; error?: string };
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "데이터 조회 실패");
      }
      const mapped = result.data.map((row: Record<string, unknown>) => {
        const modelName = String(row.model_name ?? "-");
        const masterId = String(row.master_id ?? modelName);
        const createdAt = String(row.created_at ?? "");
        const materialCode = String(row.material_code_default ?? "-");
        const weight = row.weight_default_g ? `${row.weight_default_g} g` : "-";
        const laborTotal = row.labor_total_cost ?? row.labor_total_sell;
        const cost = typeof laborTotal === "number" ? `₩${new Intl.NumberFormat("ko-KR").format(laborTotal)}` : "-";
        const active = "판매 중";

        return {
          id: masterId,
          model: modelName,
          name: String(row.name ?? modelName),
          date: createdAt ? createdAt.slice(0, 10) : "-",
          status: active,
          tone: "active" as const,
          weight,
          material: materialCode,
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
      if (mapped.length > 0 && !selectedItemId) {
        setSelectedItemId(mapped[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "데이터 조회 실패";
      toast.error("처리 실패", { description: message });
    }
  }, [selectedItemId]);

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

    const laborTotalSellValue =
      (row.labor_total_sell as number | undefined) ??
      (row.labor_base_sell as number | undefined) ??
      0;
    const laborTotalCostValue =
      (row.labor_total_cost as number | undefined) ??
      (row.labor_base_cost as number | undefined) ??
      0;

    return {
      categoryCode: String(row.category_code ?? ""),
      materialCode: String(row.material_code_default ?? ""),
      weight: row.weight_default_g ? `${row.weight_default_g} g` : "",
      deductionWeight: row.deduction_weight_default_g ? String(row.deduction_weight_default_g) : "",
      centerQty: Number(row.center_qty_default ?? 0),
      sub1Qty: Number(row.sub1_qty_default ?? 0),
      sub2Qty: Number(row.sub2_qty_default ?? 0),
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

  const materialPrice = useMemo(() => {
    if (!selectedItem || !selectedDetail) return 0;
    const weight = parseFloat(selectedDetail.weight ?? "0") || 0;
    const deduction = parseFloat(selectedDetail.deductionWeight ?? "0") || 0;
    return calculateMaterialPrice(selectedDetail.materialCode ?? "00", weight, deduction);
  }, [selectedItem, selectedDetail, goldPrice, silverModifiedPrice]);

  const totalEstimatedCost = materialPrice + totalLaborCost;
  const totalEstimatedSell = materialPrice + totalLaborSell;


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
    setModelName("");
    setVendorId("");
    setCategoryCode("");
    setMaterialCode("");
    setWeightDefault("");
    setDeductionWeight("");
    setCenterQty(0);
    setSub1Qty(0);
    setSub2Qty(0);
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
    setVendorId(vendorOptions.find((option) => option.label === selectedItem.vendor)?.value ?? "");
    setCategoryCode(detail?.categoryCode ?? "");
    setMaterialCode(detail?.materialCode ?? materialCodeFromLabel(selectedItem.material));
    setWeightDefault(row?.weight_default_g ? String(row.weight_default_g) : "");
    setDeductionWeight(row?.deduction_weight_default_g ? String(row.deduction_weight_default_g) : "");
    setCenterQty(detail?.centerQty ?? 0);
    setSub1Qty(detail?.sub1Qty ?? 0);
    setSub2Qty(detail?.sub2Qty ?? 0);
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

    setRegisterOpen(true);
  };

  const handleSave = () => {
    if (!canSave) {
      toast.error("처리 실패", { description: "잠시 후 다시 시도해 주세요" });
      return;
    }
    if (!modelName) {
      toast.error("처리 실패", { description: "모델명이 필요합니다." });
      return;
    }

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
      labor_profile_mode: laborProfileMode,
      labor_band_code: laborBandCode || null,
      vendor_party_id: isUuid(vendorId) ? vendorId : null,
      note,
      image_path: imagePath || null,
    } as const;

    setIsSaving(true);
    fetch("/api/master-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "저장에 실패했습니다.");
        }
        toast.success("저장 완료");
        await fetchCatalogItems();
        setSelectedItemId(masterId);
        setRegisterOpen(false);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
        toast.error("처리 실패", { description: message });
      })
      .finally(() => {
        setIsSaving(false);
      });

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
              <div className="flex items-center rounded-[12px] border border-[var(--panel-border)] bg-white p-1">
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
            className="gap-4 items-stretch"
            left={
              <div className="flex flex-col gap-3 h-full" id="catalog.listPanel">
                <div className="flex-1">
                  {view === "list" ? (
                    <div className="space-y-3">
                      {pageItems.map((item) => (
                        <Card
                          key={item.id}
                          className={cn(
                            "cursor-pointer p-3 transition",
                            getMaterialBgColor(String(masterRowsById[item.id]?.material_code_default ?? "00")),
                            item.id === selectedItemId ? "ring-2 ring-[var(--primary)]" : "hover:opacity-90"
                          )}
                          onClick={() => setSelectedItemId(item.id)}
                          onDoubleClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                        >
                          <div className="flex gap-4">
                            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#e7edf5] to-[#f7faff]">
                              <div className="absolute right-2 top-2 h-6 w-6 rounded-full border border-white/80 bg-white/80" />
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
                                  <p className="text-lg font-semibold text-[var(--foreground)]">{item.model}</p>
                                </div>
                                <div className="text-xs text-[var(--muted)]">{item.date}</div>
                              </div>
                              <p className="text-sm text-[var(--muted)]">{item.name}</p>
                              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                {[
                                  { label: "중량", value: item.weight },
                                  { label: "재질", value: item.material },
                                  { label: "스톤", value: item.stone },
                                  { label: "공급처", value: item.vendor },
                                ].map((meta) => (
                                  <div
                                    key={meta.label}
                                    className="rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-1"
                                  >
                                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                      {meta.label}
                                    </p>
                                    <p className="text-xs font-semibold text-[var(--foreground)]">{meta.value}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-5 gap-2 text-xs">
                                <div className="text-[var(--muted)]">색상</div>
                                <div className="text-[var(--muted)]">원가</div>
                                <div className="text-[var(--muted)]">등급1</div>
                                <div className="text-[var(--muted)]">등급2</div>
                                <div className="text-[var(--muted)]">등급3</div>
                                <div className="font-semibold text-[var(--foreground)]">{item.color}</div>
                                <div className="font-semibold text-[var(--foreground)]">{item.cost}</div>
                                <div className="font-semibold text-[var(--foreground)]">{item.grades[0]}</div>
                                <div className="font-semibold text-[var(--foreground)]">{item.grades[1]}</div>
                                <div className="font-semibold text-[var(--foreground)]">{item.grades[2]}</div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 auto-rows-fr">
                      {pageItems.map((item) => (
                        <Card
                          key={item.id}
                          className={cn(
                            "cursor-pointer overflow-hidden transition h-full flex flex-col",
                            getMaterialBgColor(String(masterRowsById[item.id]?.material_code_default ?? "00")),
                            item.id === selectedItemId ? "ring-2 ring-[var(--primary)]" : "hover:opacity-90"
                          )}
                          onClick={() => setSelectedItemId(item.id)}
                          onDoubleClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                        >
                          <div className="relative aspect-square bg-gradient-to-br from-[#e7edf5] to-[#f7faff]">
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
                          <div className="space-y-2 p-4 flex-1">
                            <p className="text-sm font-semibold text-black truncate">{item.model}</p>
                            <div className="grid grid-cols-10 gap-2 text-xs">
                              <div className="col-span-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5">예상 총 금액</p>
                                <p className="font-semibold text-[var(--foreground)]">
                                  {(() => {
                                    const row = masterRowsById[item.id];
                                    if (!row) return "-";
                                    const weight = parseFloat(item.weight) || 0;
                                    const deduction = parseFloat(String(row.deduction_weight_default_g ?? 0)) || 0;
                                    const materialCode = String(row.material_code_default ?? "00");
                                    const matPrice = calculateMaterialPrice(materialCode, weight, deduction);
                                    const laborSell = (row.labor_total_sell as number | undefined) ?? (row.labor_base_sell as number | undefined) ?? 0;
                                    return Math.round(matPrice + laborSell).toLocaleString("ko-KR") + " 원";
                                  })()}
                                </p>
                              </div>
                              <div className="col-span-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5">예상 중량</p>
                                <p className="font-semibold text-[var(--foreground)]">
                                  {(() => {
                                    const row = masterRowsById[item.id];
                                    const weight = parseFloat(item.weight) || 0;
                                    const deduction = parseFloat(String(row?.deduction_weight_default_g ?? 0)) || 0;
                                    if (deduction > 0) {
                                      return `${weight.toFixed(2)}g (-${deduction.toFixed(2)})`;
                                    }
                                    return `${weight.toFixed(2)}g`;
                                  })()}
                                </p>
                              </div>
                              <div className="col-span-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5">판매 합계공임</p>
                                <p className="font-semibold text-[var(--foreground)]">
                                  {(() => {
                                    const row = masterRowsById[item.id];
                                    const laborSell = (row?.labor_total_sell as number | undefined) ?? (row?.labor_base_sell as number | undefined) ?? 0;
                                    return laborSell.toLocaleString("ko-KR") + " 원";
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3">
                  <p className="text-xs text-[var(--muted)]">
                    {(page - 1) * activePageSize + 1} - {Math.min(page * activePageSize, catalogItemsState.length)} / {catalogItemsState.length}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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
              </div>
            }
            right={
              <div className="space-y-3" id="catalog.detailPanel">
                <div className="grid grid-cols-12 gap-2">
                  <Select className="col-span-12 md:col-span-2">
                    <option>재질 전체</option>
                    {materialOptions.map((material) => (
                      <option key={material.value} value={material.value}>
                        {material.label}
                      </option>
                    ))}
                  </Select>
                  <Select className="col-span-12 md:col-span-2">
                    <option>전체 카테고리</option>
                    {categoryOptions.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </Select>
                  <Input placeholder="모델명, 태그 검색" className="col-span-12 md:col-span-8" />
                </div>
                <div className="flex gap-4">
                  {selectedItem?.imageUrl && (
                    <div className="h-[300px] w-[300px] shrink-0 overflow-hidden rounded-[12px] border border-[var(--panel-border)] bg-white cursor-pointer"
                      onDoubleClick={() => setPreviewImage(selectedItem.imageUrl)}>
                      <img
                        src={selectedItem.imageUrl}
                        alt={selectedItem.model}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 w-[300px] shrink-0">
                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-3 py-2">
                      <p className="text-xs text-[var(--muted)]">예상 총 금액 (판매)</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {Math.round(totalEstimatedSell).toLocaleString("ko-KR")} 원
                      </p>
                    </div>
                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-3 py-2">
                      <p className="text-xs text-[var(--muted)]">예상 총 금액 (원가)</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {Math.round(totalEstimatedCost).toLocaleString("ko-KR")} 원
                      </p>
                    </div>
                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-3 py-2">
                      <p className="text-xs text-[var(--muted)]">판매 합계공임</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {totalLaborSell.toLocaleString("ko-KR")} 원
                      </p>
                    </div>
                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-3 py-2">
                      <p className="text-xs text-[var(--muted)]">원가 합계공임</p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {totalLaborCost.toLocaleString("ko-KR")} 원
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 h-[300px] rounded-[12px] border border-dashed border-[var(--panel-border)] bg-[#f8fafc] flex items-center justify-center">
                    <p className="text-xs text-[var(--muted)]">예약 공간</p>
                  </div>
                </div>
                <Card id="catalog.detail.merged">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-[var(--foreground)]">상세 정보</span>
                        <Button variant="secondary" size="sm" onClick={handleOpenEdit} disabled={!selectedItem}>
                          마스터 수정
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="모델명" value={selectedItem?.model ?? ""} readOnly />
                      <Input placeholder="공급처" value={selectedItem?.vendor ?? ""} readOnly />
                      <Select value={selectedDetail?.materialCode ?? ""} disabled>
                        <option value="">기본 재질</option>
                        {materialOptions.map((material) => (
                          <option key={material.value} value={material.value}>
                            {material.label}
                          </option>
                        ))}
                      </Select>
                      <Select value={selectedDetail?.categoryCode ?? ""} disabled>
                        <option value="">카테고리</option>
                        {categoryOptions.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </Select>
                      <Input placeholder="기본 중량 (g)" value={selectedDetail?.weight ?? ""} readOnly />
                      <Input placeholder="차감 중량 (g)" value={selectedDetail?.deductionWeight ?? ""} readOnly />
                    </div>
                    <div>
                      <div className="mb-2 grid grid-cols-10 gap-2 text-xs font-semibold text-[var(--muted)]">
                        <div className="col-span-3 text-center">항목</div>
                        <div className="col-span-3 text-center">공임 (판매)</div>
                        <div className="col-span-1 text-center">수량</div>
                        <div className="col-span-3 text-center">공임 (원가)</div>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-10 gap-2">
                          <div className="col-span-3 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">합계공임</span>
                          </div>
                          <Input className="col-span-3 text-center" placeholder="합계 (판매)" value={selectedDetail?.laborTotalSell ?? ""} readOnly />
                          <div className="col-span-1" />
                          <Input className="col-span-3 text-center" placeholder="합계 (원가)" value={selectedDetail?.laborTotalCost ?? ""} readOnly />
                        </div>
                        <div className="grid grid-cols-10 gap-2">
                          <div className="col-span-3 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">기본공임</span>
                          </div>
                          <Input className="col-span-3 text-center" placeholder="기본 (판매)" value={selectedDetail?.laborBaseSell ?? ""} readOnly />
                          <div className="col-span-1" />
                          <Input className="col-span-3 text-center" placeholder="기본 (원가)" value={selectedDetail?.laborBaseCost ?? ""} readOnly />
                        </div>
                        <div className="grid grid-cols-10 gap-2">
                          <div className="col-span-3 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">중심공임</span>
                          </div>
                          <Input className="col-span-3 text-center" placeholder="센터 (판매)" value={selectedDetail?.laborCenterSell ?? ""} readOnly />
                          <Input className="col-span-1 text-center" placeholder="중심석" value={selectedDetail?.centerQty ?? ""} readOnly />
                          <Input className="col-span-3 text-center" placeholder="센터 (원가)" value={selectedDetail?.laborCenterCost ?? ""} readOnly />
                        </div>
                        <div className="grid grid-cols-10 gap-2">
                          <div className="col-span-3 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">보조1공임</span>
                          </div>
                          <Input className="col-span-3 text-center" placeholder="서브1 (판매)" value={selectedDetail?.laborSub1Sell ?? ""} readOnly />
                          <Input className="col-span-1 text-center" placeholder="보조1석" value={selectedDetail?.sub1Qty ?? ""} readOnly />
                          <Input className="col-span-3 text-center" placeholder="서브1 (원가)" value={selectedDetail?.laborSub1Cost ?? ""} readOnly />
                        </div>
                        <div className="grid grid-cols-10 gap-2">
                          <div className="col-span-3 flex items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[#f7f9fc] px-2 py-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">보조2공임</span>
                          </div>
                          <Input className="col-span-3 text-center" placeholder="서브2 (판매)" value={selectedDetail?.laborSub2Sell ?? ""} readOnly />
                          <Input className="col-span-1 text-center" placeholder="보조2석" value={selectedDetail?.sub2Qty ?? ""} readOnly />
                          <Input className="col-span-3 text-center" placeholder="서브2 (원가)" value={selectedDetail?.laborSub2Cost ?? ""} readOnly />
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card id="catalog.detail.raw">
                  <CardHeader>
                    <ActionBar title="추가 메모" />
                  </CardHeader>
                  <CardBody className="py-3">
                    <Textarea placeholder="내부 메모" value={selectedDetail?.note ?? ""} readOnly />
                  </CardBody>
                </Card>
              </div>
            }
          />
        </div>
      </div>
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="새 상품 등록"
        className="max-w-6xl max-h-[86vh] overflow-hidden"
      >
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--foreground)]">
                <span>대표 이미지</span>
                {uploadingImage ? <span className="text-xs text-[var(--muted)]">업로드 중...</span> : null}
              </div>
              <label className="group relative flex h-56 w-56 mx-auto cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-white text-center">
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
                    <div className="text-sm font-semibold text-[var(--foreground)]">이미지 업로드</div>
                    <div className="text-xs text-[var(--muted)]">
                      JPG, PNG 파일을 드래그하거나 클릭해서 추가하세요.
                    </div>
                    <div className="text-[11px] text-[var(--muted-weak)]">권장 비율 1:1 · 최대 10MB</div>
                  </div>
                )}
              </label>
              {uploadError ? <p className="mt-2 text-xs text-red-500">{uploadError}</p> : null}
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
                  <Button variant="secondary" size="sm" type="button" onClick={handleImageRemove}>
                    삭제
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <form
            className="flex max-h-[68vh] flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">비고</p>
                <Textarea
                  placeholder="상품에 대한 상세 정보를 입력하세요."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--foreground)]">기본 정보</p>
                    <span className="text-xs text-[var(--muted)]">필수 항목 포함</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="모델명">
                      <Input placeholder="모델명*" value={modelName} onChange={(event) => setModelName(event.target.value)} />
                    </Field>
                    <Field label="공급처">
                      <Select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                        <option value="">공급처 선택</option>
                        {vendorOptions.map((vendor) => (
                          <option key={vendor.value} value={vendor.value}>
                            {vendor.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="기본 재질">
                      <Select value={materialCode} onChange={(event) => setMaterialCode(event.target.value)}>
                        <option value="">기본 재질 선택</option>
                        {materialOptions.map((material) => (
                          <option key={material.value} value={material.value}>
                            {material.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="카테고리">
                      <Select value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)}>
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
                        onChange={(event) => setWeightDefault(event.target.value)}
                      />
                    </Field>
                    <Field label="차감 중량 (g)">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="차감 중량"
                        value={deductionWeight}
                        onChange={(event) => setDeductionWeight(event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
                  <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">스톤 기본값</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="센터 스톤 수">
                      <Input
                        type="number"
                        min={0}
                        placeholder="센터"
                        value={centerQty}
                        onChange={(event) => setCenterQty(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브1 스톤 수">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브1"
                        value={sub1Qty}
                        onChange={(event) => setSub1Qty(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브2 스톤 수">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브2"
                        value={sub2Qty}
                        onChange={(event) => setSub2Qty(toNumber(event.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="mt-4 rounded-[14px] border border-[var(--panel-border)] bg-[#f8fafc] p-3">
                    <p className="mb-3 text-xs font-semibold text-[var(--muted)]">도금 기본값</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="도금 판매 기본값">
                        <Input
                          type="number"
                          min={0}
                          placeholder="판매"
                          value={platingSell}
                          onChange={(event) => setPlatingSell(toNumber(event.target.value))}
                        />
                      </Field>
                      <Field label="도금 원가 기본값">
                        <Input
                          type="number"
                          min={0}
                          placeholder="원가"
                          value={platingCost}
                          onChange={(event) => setPlatingCost(toNumber(event.target.value))}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
                  <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">공임 (판매)</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="기본 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="기본"
                        value={laborBaseSell}
                        onChange={(event) => setLaborBaseSell(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="센터 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="센터"
                        value={laborCenterSell}
                        onChange={(event) => setLaborCenterSell(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브1 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브1"
                        value={laborSub1Sell}
                        onChange={(event) => setLaborSub1Sell(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브2 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브2"
                        value={laborSub2Sell}
                        onChange={(event) => setLaborSub2Sell(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="합계 공임">
                      <Input type="number" min={0} placeholder="합계" value={totalLaborSell} readOnly />
                    </Field>
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
                  <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">공임 (원가)</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="기본 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="기본"
                        value={laborBaseCost}
                        onChange={(event) => setLaborBaseCost(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="센터 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="센터"
                        value={laborCenterCost}
                        onChange={(event) => setLaborCenterCost(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브1 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브1"
                        value={laborSub1Cost}
                        onChange={(event) => setLaborSub1Cost(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="서브2 공임">
                      <Input
                        type="number"
                        min={0}
                        placeholder="서브2"
                        value={laborSub2Cost}
                        onChange={(event) => setLaborSub2Cost(toNumber(event.target.value))}
                      />
                    </Field>
                    <Field label="합계 공임">
                      <Input type="number" min={0} placeholder="합계" value={totalLaborCost} readOnly />
                    </Field>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4 lg:col-span-2">
                  <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">프로파일 및 메모</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="공임 프로파일">
                      <Select value={laborProfileMode} onChange={(event) => setLaborProfileMode(event.target.value)}>
                        {laborProfileOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="공임 밴드 코드">
                      <Input placeholder="B1 ~ B6" value={laborBandCode} onChange={(event) => setLaborBandCode(event.target.value)} />
                    </Field>
                    {isEditMode ? (
                      <Field label="수정일">
                        <Input type="date" value={modifiedDate} readOnly />
                      </Field>
                    ) : (
                      <Field label="생성일">
                        <Input type="date" value={releaseDate} readOnly />
                      </Field>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--panel-border)] bg-white pt-4">
              <Button variant="secondary" type="button" onClick={() => setRegisterOpen(false)}>
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
            className="absolute right-6 top-6 z-[101] flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
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
