"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberText } from "@/components/ui/number-text";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Grid2x2, List, Search, X, Filter, Download, Plus, Eye, Edit2, Trash2, Check, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
/* eslint-disable @next/next/no-img-element */

// Types
type CatalogItem = {
  id: string;
  masterId: string;
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
  cost: number | null;
  grades: string[];
  imageUrl?: string | null;
  categoryCode?: string;
  materialCode?: string;
  weightDefault?: number;
  deductionWeight?: number;
  centerQty?: number;
  sub1Qty?: number;
  sub2Qty?: number;
  laborBaseSell?: number;
  laborCenterSell?: number;
  laborSub1Sell?: number;
  laborSub2Sell?: number;
  laborTotalSell?: number;
  laborBaseCost?: number;
  laborCenterCost?: number;
  laborSub1Cost?: number;
  laborSub2Cost?: number;
  laborTotalCost?: number;
  platingSell?: number;
  platingCost?: number;
  note?: string;
};

// Constants
const categoryOptions = [
  { label: "팔찌", value: "BRACELET", color: "#3b82f6" },
  { label: "발찌", value: "ANKLET", color: "#8b5cf6" },
  { label: "목걸이", value: "NECKLACE", color: "#ec4899" },
  { label: "귀걸이", value: "EARRING", color: "#f59e0b" },
  { label: "반지", value: "RING", color: "#ef4444" },
  { label: "피어싱", value: "PIERCING", color: "#10b981" },
  { label: "펜던트", value: "PENDANT", color: "#6366f1" },
  { label: "시계", value: "WATCH", color: "#14b8a6" },
  { label: "키링", value: "KEYRING", color: "#f97316" },
  { label: "상징", value: "SYMBOL", color: "#64748b" },
  { label: "부속", value: "ACCESSORY", color: "#84cc16" },
  { label: "기타", value: "ETC", color: "#9ca3af" },
];

const materialOptions = [
  { label: "14K", value: "14", color: "#f59e0b" },
  { label: "18K", value: "18", color: "#eab308" },
  { label: "24K", value: "24", color: "#ca8a04" },
  { label: "925", value: "925", color: "#64748b" },
  { label: "00", value: "00", color: "#9ca3af" },
];

type VendorOption = { label: string; value: string };

// Helper function to calculate labor sell price dynamically
function calculateLaborSell(item: CatalogItem): number {
  const base = item.laborBaseSell || 0;
  const center = (item.laborCenterSell || 0) * (item.centerQty || 0);
  const sub1 = (item.laborSub1Sell || 0) * (item.sub1Qty || 0);
  const sub2 = (item.laborSub2Sell || 0) * (item.sub2Qty || 0);
  return base + center + sub1 + sub2;
}

// Helper function to calculate labor cost dynamically
function calculateLaborCost(item: CatalogItem): number {
  const base = item.laborBaseCost || 0;
  const center = (item.laborCenterCost || 0) * (item.centerQty || 0);
  const sub1 = (item.laborSub1Cost || 0) * (item.sub1Qty || 0);
  const sub2 = (item.laborSub2Cost || 0) * (item.sub2Qty || 0);
  return base + center + sub1 + sub2;
}

// Modern ProductCard Component with 3D Tilt Effect
function ProductCard({
  item,
  isSelected,
  isMultiSelected,
  onSelect,
  onMultiSelect,
  onEdit,
  onView,
  onDelete,
  materialPrice,
}: {
  item: CatalogItem;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string) => void;
  onMultiSelect: (id: string) => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  materialPrice: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (y - 0.5) * -10,
      y: (x - 0.5) * 10,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onMultiSelect(item.id);
    } else {
      onSelect(item.id);
    }
  }, [item.id, onSelect, onMultiSelect]);

  const category = categoryOptions.find(c => c.value === item.categoryCode);
  const material = materialOptions.find(m => m.value === item.material);
  const laborSell = calculateLaborSell(item);
  const totalPrice = materialPrice + laborSell;

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative cursor-pointer",
        "transition-all duration-300 ease-[var(--ease-out)]",
        isSelected && "z-10"
      )}
      style={{ perspective: "1000px" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 bg-[var(--panel)]",
          "transition-all duration-300",
          "shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
          isHovered && "shadow-[0_20px_40px_rgba(0,0,0,0.15)]",
          isSelected
            ? "border-[var(--primary)] ring-4 ring-[var(--primary)]/20"
            : isMultiSelected
            ? "border-[var(--success)] ring-2 ring-[var(--success)]/20"
            : "border-[var(--panel-border)]",
          "hover:border-[var(--primary)]/50"
        )}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered ? 20 : 0}px)`,
          transition: isHovered ? "transform 0.1s ease-out" : "transform 0.3s ease-out",
        }}
      >
        {/* Selection indicator */}
        {(isSelected || isMultiSelected) && (
          <div className={cn(
            "absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full shadow-lg",
            isSelected ? "bg-[var(--primary)] text-white" : "bg-[var(--success)] text-white"
          )}>
            <Check size={14} />
          </div>
        )}

        {/* Quick actions on hover */}
        <div className={cn(
          "absolute right-3 top-3 z-20 flex gap-2",
          "transition-all duration-200",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel)]/90 text-[var(--foreground)] shadow-md hover:bg-[var(--primary)] hover:text-white transition-colors"
            title="상세 보기"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel)]/90 text-[var(--foreground)] shadow-md hover:bg-[var(--warning)] hover:text-white transition-colors"
            title="수정"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel)]/90 text-[var(--foreground)] shadow-md hover:bg-[var(--danger)] hover:text-white transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Image container */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[var(--panel)] to-[var(--background)]">
          {/* Category & Material badges */}
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
            {category && (
              <Badge
                tone="primary"
                className="text-xs px-2 py-0.5"
                style={{ backgroundColor: `${category.color}20`, color: category.color, borderColor: `${category.color}40` }}
              >
                {category.label}
              </Badge>
            )}
            {material && (
              <Badge
                tone="neutral"
                className="text-xs px-2 py-0.5"
                style={{ backgroundColor: `${material.color}20`, color: material.color, borderColor: `${material.color}40` }}
              >
                {material.label}
              </Badge>
            )}
          </div>

          {/* Image */}
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.model}
              className={cn(
                "h-full w-full object-cover transition-transform duration-500",
                isHovered && "scale-110"
              )}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--chip)]">
                  <Grid2x2 size={24} className="text-[var(--muted)]" />
                </div>
                <span className="text-sm">이미지 없음</span>
              </div>
            </div>
          )}

          {/* Gradient overlay on hover */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent",
            "transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )} />
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-[var(--foreground)] truncate text-base">
              {item.model}
            </h3>
            <p className="text-sm text-[var(--muted)] truncate">{item.name}</p>
          </div>

          {/* Price info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[var(--chip)] p-2">
              <p className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">판매가</p>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {totalPrice > 0 ? (
                  <span>
                    ₩<NumberText value={totalPrice} />
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--chip)] p-2">
              <p className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">공임</p>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {laborSell > 0 ? (
                  <span>
                    ₩<NumberText value={laborSell} />
                  </span>
                ) : (
                  "-"
                )}
              </p>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{item.weight}</span>
            <span>{item.vendor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ProductListRow Component
function ProductListRow({
  item,
  isSelected,
  isMultiSelected,
  onSelect,
  onMultiSelect,
  onEdit,
  onView,
  onDelete,
  materialPrice,
}: {
  item: CatalogItem;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string) => void;
  onMultiSelect: (id: string) => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  materialPrice: number;
}) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onMultiSelect(item.id);
    } else {
      onSelect(item.id);
    }
  }, [item.id, onSelect, onMultiSelect]);

  const category = categoryOptions.find(c => c.value === item.categoryCode);
  const material = materialOptions.find(m => m.value === item.material);
  const laborSell = calculateLaborSell(item);
  const totalPrice = materialPrice + laborSell;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group flex items-center gap-4 p-3 rounded-xl border cursor-pointer",
        "transition-all duration-200 hover:shadow-md",
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
          : isMultiSelected
          ? "border-[var(--success)] bg-[var(--success-soft)]"
          : "border-[var(--panel-border)] bg-[var(--panel)] hover:border-[var(--primary)]/50"
      )}
    >
      {/* Checkbox */}
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded border transition-colors",
        (isSelected || isMultiSelected)
          ? isSelected
            ? "bg-[var(--primary)] border-[var(--primary)] text-white"
            : "bg-[var(--success)] border-[var(--success)] text-white"
          : "border-[var(--panel-border)] bg-[var(--background)]"
      )}>
        {(isSelected || isMultiSelected) && <Check size={12} />}
      </div>

      {/* Thumbnail */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--chip)]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.model} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
            <Grid2x2 size={20} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <p className="font-semibold text-[var(--foreground)] truncate">{item.model}</p>
          <p className="text-sm text-[var(--muted)] truncate">{item.name}</p>
        </div>

        <div className="col-span-2 flex gap-1.5">
          {category && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${category.color}20`, color: category.color }}
            >
              {category.label}
            </span>
          )}
          {material && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${material.color}20`, color: material.color }}
            >
              {material.label}
            </span>
          )}
        </div>

        <div className="col-span-2 text-sm text-[var(--foreground)]">{item.weight}</div>

        <div className="col-span-2 text-sm font-semibold text-[var(--primary)]">
                {totalPrice > 0 ? (
                  <span>
                    ₩<NumberText value={totalPrice} />
                  </span>
                ) : (
                  "-"
                )}
        </div>

        <div className="col-span-2 text-sm text-[var(--muted)]">{item.vendor}</div>

        <div className="col-span-1 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="p-2 rounded-lg hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--foreground)]"
            title="상세 보기"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--foreground)]"
            title="수정"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg hover:bg-[var(--danger-soft)] text-[var(--muted)] hover:text-[var(--danger)]"
            title="삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail Modal Component
function ProductDetailModal({
  item,
  open,
  onClose,
  onEdit,
  onDelete,
  materialPrice,
}: {
  item: CatalogItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  materialPrice: number;
}) {
  if (!item) return null;

  const category = categoryOptions.find(c => c.value === item.categoryCode);
  const material = materialOptions.find(m => m.value === item.material);
  const laborSell = calculateLaborSell(item);
  const laborCost = calculateLaborCost(item);
  const totalPrice = materialPrice + laborSell;
  const totalCost = materialPrice + laborCost;

  return (
    <Modal open={open} onClose={onClose} title="상품 상세 정보" className="max-w-3xl">
      <div className="space-y-6">
        {/* Header with image */}
        <div className="flex gap-6">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-xl bg-[var(--chip)]">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.model} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                <Grid2x2 size={48} />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {category && (
                  <Badge tone="primary" style={{ backgroundColor: `${category.color}20`, color: category.color, borderColor: `${category.color}40` }}>
                    {category.label}
                  </Badge>
                )}
                {material && (
                  <Badge tone="neutral" style={{ backgroundColor: `${material.color}20`, color: material.color, borderColor: `${material.color}40` }}>
                    {material.label}
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">{item.model}</h2>
              <p className="text-[var(--muted)]">{item.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--chip)] p-3">
                <p className="text-xs text-[var(--muted)]">예상 총 금액 (판매)</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
              {totalPrice > 0 ? (
                <span>
                  ₩<NumberText value={totalPrice} />
                </span>
              ) : (
                "-"
              )}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--chip)] p-3">
                <p className="text-xs text-[var(--muted)]">예상 총 금액 (원가)</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
              {totalCost > 0 ? (
                <span>
                  ₩<NumberText value={totalCost} />
                </span>
              ) : (
                "-"
              )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">중량</p>
            <p className="font-medium">{item.weight}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">공급처</p>
            <p className="font-medium">{item.vendor}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">스톤</p>
            <p className="font-medium">{item.stone}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">중심석</p>
            <p className="font-medium">{item.centerQty || 0}개</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">보조1</p>
            <p className="font-medium">{item.sub1Qty || 0}개</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">보조2</p>
            <p className="font-medium">{item.sub2Qty || 0}개</p>
          </div>
        </div>

        {/* Labor costs */}
        <div className="rounded-xl border border-[var(--panel-border)] overflow-hidden">
          <div className="bg-[var(--chip)] px-4 py-2 font-medium text-sm">공임 정보</div>
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-[var(--muted)]">항목</div>
              <div className="text-[var(--muted)] text-right">판매가</div>
              <div className="text-[var(--muted)] text-right">원가</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>기본공임</div>
              <div className="text-right font-medium">
                ₩<NumberText value={item.laborBaseSell || 0} />
              </div>
              <div className="text-right font-medium">
                ₩<NumberText value={item.laborBaseCost || 0} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>중심공임 × {item.centerQty || 0}</div>
              <div className="text-right font-medium">
                ₩<NumberText value={(item.laborCenterSell || 0) * (item.centerQty || 0)} />
              </div>
              <div className="text-right font-medium">
                ₩<NumberText value={(item.laborCenterCost || 0) * (item.centerQty || 0)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>합계공임</div>
              <div className="text-right font-bold text-[var(--primary)]">
                ₩<NumberText value={laborSell} />
              </div>
              <div className="text-right font-bold text-[var(--foreground)]">
                ₩<NumberText value={laborCost} />
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        {item.note && (
          <div className="rounded-lg bg-[var(--chip)] p-3">
            <p className="text-xs text-[var(--muted)] mb-1">비고</p>
            <p className="text-sm">{item.note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-[var(--panel-border)]">
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={16} className="mr-2" />
            삭제
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>닫기</Button>
            <Button onClick={onEdit}>
              <Edit2 size={16} className="mr-2" />
              수정하기
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Product Edit/Create Modal Component
function ProductFormModal({
  item,
  open,
  onClose,
  onSave,
  isSaving,
  vendorOptions,
  mode,
}: {
  item: CatalogItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CatalogItem>) => void;
  isSaving: boolean;
  vendorOptions: VendorOption[];
  mode: "create" | "edit";
}) {
  const [formData, setFormData] = useState<Partial<CatalogItem>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (item && mode === "edit") {
        setFormData({ ...item });
        setImageUrl(item.imageUrl || null);
      } else {
        // Reset for create mode
        setFormData({
          id: crypto.randomUUID(),
          masterId: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          status: "판매 중",
          tone: "active",
          stone: "없음",
          color: "-",
          cost: null,
          grades: ["-", "-", "-"],
        });
        setImageUrl(null);
        setImagePath(null);
      }
    }
  }, [item, open, mode]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/master-image", { method: "POST", body: form });
      const result = await res.json();
      if (result.publicUrl) {
        setImageUrl(result.publicUrl);
        setImagePath(result.path);
        toast.success("이미지 업로드 완료");
      }
    } catch (err) {
      toast.error("이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = async () => {
    if (imagePath) {
      try {
        await fetch("/api/master-image", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: imagePath }),
        });
      } catch (err) {
        console.error("이미지 삭제 실패", err);
      }
    }
    setImageUrl(null);
    setImagePath(null);
  };

  const handleSubmit = () => {
    if (!formData.model) {
      toast.error("모델명은 필수입니다");
      return;
    }
    onSave({ ...formData, imageUrl });
  };

  const title = mode === "create" ? "새 상품 등록" : "마스터 수정";

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-4xl">
      <div className="space-y-6">
        {/* Image upload */}
        <div className="flex gap-6">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-xl bg-[var(--chip)] group">
            {imageUrl ? (
              <img src={imageUrl} alt={formData.model || ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--muted)]">
                <div className="text-center">
                  <Upload size={32} className="mx-auto mb-2" />
                  <span className="text-sm">이미지 업로드</span>
                </div>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploadingImage ? "업로드 중..." : "이미지 변경"}
            </button>
            {imageUrl && (
              <button
                onClick={handleImageRemove}
                className="absolute top-2 right-2 p-1 bg-[var(--danger)] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">모델명 *</label>
              <Input
                value={formData.model || ""}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="예: BR-001"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">품명</label>
              <Input
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 14K 팔찌"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">카테고리</label>
              <Select
                value={formData.categoryCode || ""}
                onChange={(e) => setFormData({ ...formData, categoryCode: e.target.value })}
              >
                <option value="">선택</option>
                {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">재질</label>
              <Select
                value={formData.material || ""}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              >
                <option value="">선택</option>
                {materialOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* Weight and quantities */}
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">총중량 (g)</label>
            <Input
              type="number"
              step="0.01"
              value={formData.weightDefault || ""}
              onChange={(e) => setFormData({ ...formData, weightDefault: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">차감중량 (g)</label>
            <Input
              type="number"
              step="0.01"
              value={formData.deductionWeight || ""}
              onChange={(e) => setFormData({ ...formData, deductionWeight: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">중심석</label>
            <Input
              type="number"
              value={formData.centerQty || ""}
              onChange={(e) => setFormData({ ...formData, centerQty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">보조1</label>
            <Input
              type="number"
              value={formData.sub1Qty || ""}
              onChange={(e) => setFormData({ ...formData, sub1Qty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">보조2</label>
            <Input
              type="number"
              value={formData.sub2Qty || ""}
              onChange={(e) => setFormData({ ...formData, sub2Qty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>

        {/* Labor costs */}
        <div className="rounded-xl border border-[var(--panel-border)] overflow-hidden">
          <div className="bg-[var(--chip)] px-4 py-2 font-medium text-sm">공임 판매가 / 원가</div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--primary)]">판매가</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--muted)]">기본공임</label>
                  <Input
                    type="number"
                    value={formData.laborBaseSell || ""}
                    onChange={(e) => setFormData({ ...formData, laborBaseSell: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">중심공임</label>
                  <Input
                    type="number"
                    value={formData.laborCenterSell || ""}
                    onChange={(e) => setFormData({ ...formData, laborCenterSell: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">보조1공임</label>
                  <Input
                    type="number"
                    value={formData.laborSub1Sell || ""}
                    onChange={(e) => setFormData({ ...formData, laborSub1Sell: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">보조2공임</label>
                  <Input
                    type="number"
                    value={formData.laborSub2Sell || ""}
                    onChange={(e) => setFormData({ ...formData, laborSub2Sell: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--foreground)]">원가</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--muted)]">기본공임</label>
                  <Input
                    type="number"
                    value={formData.laborBaseCost || ""}
                    onChange={(e) => setFormData({ ...formData, laborBaseCost: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">중심공임</label>
                  <Input
                    type="number"
                    value={formData.laborCenterCost || ""}
                    onChange={(e) => setFormData({ ...formData, laborCenterCost: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">보조1공임</label>
                  <Input
                    type="number"
                    value={formData.laborSub1Cost || ""}
                    onChange={(e) => setFormData({ ...formData, laborSub1Cost: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">보조2공임</label>
                  <Input
                    type="number"
                    value={formData.laborSub2Cost || ""}
                    onChange={(e) => setFormData({ ...formData, laborSub2Cost: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Live calculation preview */}
          <div className="bg-[var(--chip)] px-4 py-3 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">계산된 합계공임:</span>
              <div className="flex gap-4">
                <span className="font-semibold text-[var(--primary)]">
                  판매 ₩
                  <NumberText
                    value={
                      (formData.laborBaseSell || 0) +
                      (formData.laborCenterSell || 0) * (formData.centerQty || 0) +
                      (formData.laborSub1Sell || 0) * (formData.sub1Qty || 0) +
                      (formData.laborSub2Sell || 0) * (formData.sub2Qty || 0)
                    }
                  />
                </span>
                <span className="font-semibold text-[var(--foreground)]">
                  원가 ₩
                  <NumberText
                    value={
                      (formData.laborBaseCost || 0) +
                      (formData.laborCenterCost || 0) * (formData.centerQty || 0) +
                      (formData.laborSub1Cost || 0) * (formData.sub1Qty || 0) +
                      (formData.laborSub2Cost || 0) * (formData.sub2Qty || 0)
                    }
                  />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Plating */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">도금비 (판매)</label>
            <Input
              type="number"
              value={formData.platingSell || ""}
              onChange={(e) => setFormData({ ...formData, platingSell: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">도금비 (원가)</label>
            <Input
              type="number"
              value={formData.platingCost || ""}
              onChange={(e) => setFormData({ ...formData, platingCost: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>

        {/* Vendor */}
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">공급처</label>
          <Select
            value={formData.vendor || ""}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
          >
            <option value="">선택</option>
            {vendorOptions.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </Select>
        </div>

        {/* Note */}
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">비고</label>
          <textarea
            className="w-full min-h-[80px] rounded-[var(--radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] resize-y"
            value={formData.note || ""}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="추가 정보를 입력하세요"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--panel-border)]">
          <Button variant="secondary" onClick={onClose} disabled={isSaving || uploadingImage}>취소</Button>
          <Button onClick={handleSubmit} disabled={isSaving || uploadingImage}>
            {isSaving ? "저장 중..." : mode === "create" ? "등록" : "저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  itemName,
  count,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  count?: number;
}) {
  return (
    <Modal open={open} onClose={onClose} title="삭제 확인" className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-[var(--danger)]">
          <Trash2 size={32} />
          <div>
            <p className="font-semibold">
              {count && count > 1 ? `${count}개 항목을` : itemName ? `"${itemName}"을(를)` : "이 항목을"} 삭제하시겠습니까?
            </p>
            <p className="text-sm text-[var(--muted)]">이 작업은 되돌릴 수 없습니다.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="danger" onClick={onConfirm}>
            <Trash2 size={16} className="mr-2" />
            삭제
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Export Modal
function ExportModal({
  open,
  onClose,
  items,
  selectedIds,
}: {
  open: boolean;
  onClose: () => void;
  items: CatalogItem[];
  selectedIds: Set<string>;
}) {
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportScope, setExportScope] = useState<"all" | "selected">("selected");

  const handleExport = () => {
    const dataToExport = exportScope === "selected" && selectedIds.size > 0
      ? items.filter(i => selectedIds.has(i.id))
      : items;

    if (dataToExport.length === 0) {
      toast.error("보낼 데이터가 없습니다");
      return;
    }

    if (exportFormat === "csv") {
      // CSV export
      const headers = ["모델명", "품명", "카테고리", "재질", "중량", "판매가", "원가", "공급처"];
      const rows = dataToExport.map(item => [
        item.model,
        item.name,
        item.categoryCode || "",
        item.material,
        item.weight,
        String(item.laborTotalSell || 0),
        String(item.laborTotalCost || 0),
        item.vendor,
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } else {
      // JSON export
      const json = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `catalog_export_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
    }

    toast.success(`${dataToExport.length}개 항목보내기 완료`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="데이터보내기" className="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[var(--muted)] mb-2 block">보낼 범위</label>
          <div className="flex gap-2">
            <button
              onClick={() => setExportScope("selected")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                exportScope === "selected"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--panel-border)] hover:border-[var(--primary)]/50"
              )}
              disabled={selectedIds.size === 0}
            >
              선택된 항목 ({selectedIds.size}개)
            </button>
            <button
              onClick={() => setExportScope("all")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                exportScope === "all"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--panel-border)] hover:border-[var(--primary)]/50"
              )}
            >
              전체 항목 ({items.length}개)
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-[var(--muted)] mb-2 block">파일 형식</label>
          <div className="flex gap-2">
            <button
              onClick={() => setExportFormat("csv")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                exportFormat === "csv"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--panel-border)] hover:border-[var(--primary)]/50"
              )}
            >
              CSV (.csv)
            </button>
            <button
              onClick={() => setExportFormat("json")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm transition-colors",
                exportFormat === "json"
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--panel-border)] hover:border-[var(--primary)]/50"
              )}
            >
              JSON (.json)
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={handleExport}>
            <Download size={16} className="mr-2" />
           보내기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Main Page Component
export default function Catalog2Page() {
  // State
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [sortBy, setSortBy] = useState<"model" | "price" | "date">("model");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  
  // Market prices
  const [goldPrice, setGoldPrice] = useState(0);
  const [silverPrice, setSilverPrice] = useState(0);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  // Fetch market prices
  useEffect(() => {
    fetch("/api/market-ticks")
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setGoldPrice(data.data.gold);
          setSilverPrice(data.data.silver);
        }
      });
  }, []);

  // Fetch vendors
  useEffect(() => {
    fetch("/api/vendors")
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setVendorOptions(data.data.map((v: { party_id: string; name: string }) => ({
            label: v.name,
            value: v.party_id,
          })));
        }
      });
  }, []);

  // Fetch items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/master-items", { cache: "no-store" });
      const data = await res.json();
      if (data.data) {
        const mapped = data.data.map((row: Record<string, unknown>) => ({
          id: String(row.master_id || row.model_name),
          masterId: String(row.master_id || ""),
          model: String(row.model_name || "-"),
          name: String(row.name || row.model_name || "-"),
          date: row.created_at ? String(row.created_at).slice(0, 10) : "-",
          status: "판매 중",
          tone: "active" as const,
          weight: row.weight_default_g ? `${row.weight_default_g} g` : "-",
          weightDefault: row.weight_default_g as number,
          deductionWeight: row.deduction_weight_default_g as number,
          material: String(row.material_code_default || "-"),
          materialCode: String(row.material_code_default || ""),
          stone: "없음",
          vendor: String(row.vendor_party_id || "-"),
          color: "-",
          cost: row.labor_total_cost ? Number(row.labor_total_cost) : null,
          grades: ["-", "-", "-"],
          imageUrl: row.image_url ? String(row.image_url) : null,
          categoryCode: String(row.category_code || ""),
          centerQty: row.center_qty_default as number,
          sub1Qty: row.sub1_qty_default as number,
          sub2Qty: row.sub2_qty_default as number,
          laborBaseSell: row.labor_base_sell as number,
          laborCenterSell: row.labor_center_sell as number,
          laborSub1Sell: row.labor_sub1_sell as number,
          laborSub2Sell: row.labor_sub2_sell as number,
          laborTotalSell: (row.labor_total_sell as number) || (row.labor_base_sell as number) || 0,
          laborBaseCost: row.labor_base_cost as number,
          laborCenterCost: row.labor_center_cost as number,
          laborSub1Cost: row.labor_sub1_cost as number,
          laborSub2Cost: row.labor_sub2_cost as number,
          laborTotalCost: (row.labor_total_cost as number) || (row.labor_base_cost as number) || 0,
          platingSell: row.plating_price_sell_default as number,
          platingCost: row.plating_price_cost_default as number,
          note: String(row.note || ""),
        }));
        setItems(mapped);
        if (mapped.length > 0 && !selectedId) {
          setSelectedId(mapped[0].id);
        }
      }
    } catch (err) {
      toast.error("데이터 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New item
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setCreateModalOpen(true);
      }
      // Escape: Close modals
      if (e.key === "Escape") {
        if (detailModalOpen) setDetailModalOpen(false);
        else if (editModalOpen) setEditModalOpen(false);
        else if (createModalOpen) setCreateModalOpen(false);
        else if (exportModalOpen) setExportModalOpen(false);
        else if (deleteModalOpen) setDeleteModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailModalOpen, editModalOpen, createModalOpen, exportModalOpen, deleteModalOpen]);

  // Calculate material price
  const calculateMaterialPrice = useCallback((material: string, weight: number, deduction: number) => {
    const netWeight = weight - (deduction || 0);
    if (material === "925") return silverPrice * netWeight;
    if (material === "14" || material === "14K") return goldPrice * netWeight * 0.6435;
    if (material === "18" || material === "18K") return goldPrice * netWeight * 0.825;
    if (material === "24" || material === "24K") return goldPrice * netWeight;
    if (material === "00") return 0;
    return 0;
  }, [goldPrice, silverPrice]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.model.toLowerCase().includes(q) || 
        i.name.toLowerCase().includes(q) ||
        i.vendor.toLowerCase().includes(q)
      );
    }
    
    if (filterCategory) {
      result = result.filter(i => i.categoryCode === filterCategory);
    }
    
    if (filterMaterial) {
      result = result.filter(i => i.material === filterMaterial);
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "model") {
        comparison = a.model.localeCompare(b.model);
      } else if (sortBy === "price") {
        const priceA = calculateMaterialPrice(a.material, a.weightDefault || 0, a.deductionWeight || 0) + calculateLaborSell(a);
        const priceB = calculateMaterialPrice(b.material, b.weightDefault || 0, b.deductionWeight || 0) + calculateLaborSell(b);
        comparison = priceA - priceB;
      } else if (sortBy === "date") {
        comparison = a.date.localeCompare(b.date);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [items, searchQuery, filterCategory, filterMaterial, sortBy, sortOrder, calculateMaterialPrice]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Handlers
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMultiSelectedIds(new Set());
  }, []);

  const handleMultiSelect = useCallback((id: string) => {
    setMultiSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (multiSelectedIds.size === paginatedItems.length) {
      setMultiSelectedIds(new Set());
    } else {
      setMultiSelectedIds(new Set(paginatedItems.map(i => i.id)));
    }
  }, [paginatedItems, multiSelectedIds.size]);

  const handleEdit = useCallback((item: CatalogItem) => {
    setSelectedId(item.id);
    setEditModalOpen(true);
  }, []);

  const handleView = useCallback((item: CatalogItem) => {
    setSelectedId(item.id);
    setDetailModalOpen(true);
  }, []);

  const handleDelete = useCallback((item: CatalogItem) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  }, []);

  const handleBulkDelete = useCallback(() => {
    setItemToDelete(null);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = async () => {
    try {
      const idsToDelete = itemToDelete ? [itemToDelete.id] : Array.from(multiSelectedIds);
      
      // Delete each item
      for (const id of idsToDelete) {
        const res = await fetch(`/api/master-item?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("삭제 실패");
      }

      toast.success(`${idsToDelete.length}개 항목 삭제 완료`);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      setMultiSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      toast.error("삭제 실패");
    }
  };

  const handleSave = useCallback(async (data: Partial<CatalogItem>) => {
    setIsSaving(true);
    try {
      // Calculate labor totals
      const laborTotalSell = (data.laborBaseSell || 0) + 
        ((data.laborCenterSell || 0) * (data.centerQty || 0)) + 
        ((data.laborSub1Sell || 0) * (data.sub1Qty || 0)) + 
        ((data.laborSub2Sell || 0) * (data.sub2Qty || 0));
      const laborTotalCost = (data.laborBaseCost || 0) + 
        ((data.laborCenterCost || 0) * (data.centerQty || 0)) + 
        ((data.laborSub1Cost || 0) * (data.sub1Qty || 0)) + 
        ((data.laborSub2Cost || 0) * (data.sub2Qty || 0));

      const payload = {
        master_id: data.masterId,
        model_name: data.model,
        name: data.name,
        category_code: data.categoryCode,
        material_code_default: data.material,
        weight_default_g: data.weightDefault,
        deduction_weight_default_g: data.deductionWeight,
        center_qty_default: data.centerQty,
        sub1_qty_default: data.sub1Qty,
        sub2_qty_default: data.sub2Qty,
        labor_base_sell: data.laborBaseSell,
        labor_center_sell: data.laborCenterSell,
        labor_sub1_sell: data.laborSub1Sell,
        labor_sub2_sell: data.laborSub2Sell,
        labor_total_sell: laborTotalSell,
        labor_base_cost: data.laborBaseCost,
        labor_center_cost: data.laborCenterCost,
        labor_sub1_cost: data.laborSub1Cost,
        labor_sub2_cost: data.laborSub2Cost,
        labor_total_cost: laborTotalCost,
        plating_price_sell_default: data.platingSell,
        plating_price_cost_default: data.platingCost,
        vendor_party_id: data.vendor,
        note: data.note,
        image_url: data.imageUrl,
      };

      const res = await fetch("/api/master-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("저장 완료");
        setEditModalOpen(false);
        setCreateModalOpen(false);
        fetchItems();
      } else {
        throw new Error("저장 실패");
      }
    } catch (err) {
      toast.error("저장 실패");
    } finally {
      setIsSaving(false);
    }
  }, [fetchItems]);

  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedId) || null
  , [items, selectedId]);

  return (
    <div className="space-y-6" id="catalog2.root">
      {/* Action Bar */}
      <ActionBar
        title={
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">상품 카탈로그</span>
            <Badge tone="neutral" className="text-sm px-3 py-1">
              {filteredItems.length}개
            </Badge>
          </div>
        }
        subtitle="마스터카드 관리 시스템"
        actions={
          <div className="flex items-center gap-3">
            {/* Bulk actions */}
            {multiSelectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] border border-[var(--primary)]/20">
                  <span className="text-sm font-medium text-[var(--primary)]">
                    {multiSelectedIds.size}개 선택됨
                  </span>
                  <button
                    onClick={() => setMultiSelectedIds(new Set())}
                    className="p-1 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)]"
                  >
                    <X size={14} />
                  </button>
                </div>
                <Button variant="danger" size="sm" onClick={handleBulkDelete}>
                  <Trash2 size={16} className="mr-1" />
                  삭제
                </Button>
              </div>
            )}

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                title="그리드 뷰"
              >
                <Grid2x2 size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                  viewMode === "list" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                title="리스트 뷰"
              >
                <List size={18} />
              </button>
            </div>

            <Button variant="secondary" size="sm" onClick={() => setExportModalOpen(true)}>
              <Download size={16} className="mr-2" />
              보내기
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={16} className="mr-2" />
              신규 등록
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 p-4 rounded-xl bg-[var(--panel)] border border-[var(--panel-border)]">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <Input
            placeholder="모델명, 품명, 공급처 검색..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            className="w-32"
          >
            <option value="">카테고리</option>
            {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          
          <Select
            value={filterMaterial}
            onChange={(e) => { setFilterMaterial(e.target.value); setPage(1); }}
            className="w-28"
          >
            <option value="">재질</option>
            {materialOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          
          <Select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split("-");
              setSortBy(by as "model" | "price" | "date");
              setSortOrder(order as "asc" | "desc");
            }}
            className="w-36"
          >
            <option value="model-asc">모델명 ↑</option>
            <option value="model-desc">모델명 ↓</option>
            <option value="price-asc">가격 낮은순</option>
            <option value="price-desc">가격 높은순</option>
            <option value="date-desc">최신순</option>
            <option value="date-asc">오래된순</option>
          </Select>

          {(searchQuery || filterCategory || filterMaterial) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setFilterCategory("");
                setFilterMaterial("");
                setPage(1);
              }}
            >
              <Filter size={16} className="mr-2" />
              초기화
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={multiSelectedIds.size === paginatedItems.length && paginatedItems.length > 0}
                onChange={handleSelectAll}
                className="rounded border-[var(--panel-border)]"
              />
              전체 선택
            </label>
            <span className="text-sm text-[var(--muted)]">
              {filteredItems.length > 0 && `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredItems.length)} / ${filteredItems.length}`}
            </span>
          </div>
          
          <Select
            value={String(pageSize)}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="w-24 text-sm"
          >
            <option value="8">8개</option>
            <option value="12">12개</option>
            <option value="24">24개</option>
            <option value="48">48개</option>
          </Select>
        </div>

        {/* Grid/List View */}
        {isLoading && items.length === 0 ? (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto" />
              <p className="text-[var(--muted)]">데이터 로드 중...</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--chip)]">
                <Search size={32} className="text-[var(--muted)]" />
              </div>
              <p className="text-[var(--muted)]">검색 결과가 없습니다</p>
              <Button variant="secondary" size="sm" onClick={() => {
                setSearchQuery("");
                setFilterCategory("");
                setFilterMaterial("");
              }}>
                필터 초기화
              </Button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 min-w-0 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {paginatedItems.map(item => (
              <ProductCard
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isMultiSelected={multiSelectedIds.has(item.id)}
                onSelect={handleSelect}
                onMultiSelect={handleMultiSelect}
                onEdit={() => handleEdit(item)}
                onView={() => handleView(item)}
                onDelete={() => handleDelete(item)}
                materialPrice={calculateMaterialPrice(item.material, item.weightDefault || 0, item.deductionWeight || 0)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map(item => (
              <ProductListRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isMultiSelected={multiSelectedIds.has(item.id)}
                onSelect={handleSelect}
                onMultiSelect={handleMultiSelect}
                onEdit={() => handleEdit(item)}
                onView={() => handleView(item)}
                onDelete={() => handleDelete(item)}
                materialPrice={calculateMaterialPrice(item.material, item.weightDefault || 0, item.deductionWeight || 0)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--panel-border)]">
            <p className="text-sm text-[var(--muted)]">
              페이지 {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} className="mr-1" />
                이전
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                다음
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductDetailModal
        item={selectedItem}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onEdit={() => {
          setDetailModalOpen(false);
          setEditModalOpen(true);
        }}
        onDelete={() => {
          setDetailModalOpen(false);
          if (selectedItem) handleDelete(selectedItem);
        }}
        materialPrice={selectedItem ? calculateMaterialPrice(selectedItem.material, selectedItem.weightDefault || 0, selectedItem.deductionWeight || 0) : 0}
      />

      <ProductFormModal
        item={selectedItem}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        isSaving={isSaving}
        vendorOptions={vendorOptions}
        mode="edit"
      />

      <ProductFormModal
        item={null}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleSave}
        isSaving={isSaving}
        vendorOptions={vendorOptions}
        mode="create"
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={confirmDelete}
        itemName={itemToDelete?.model}
        count={itemToDelete ? 1 : multiSelectedIds.size}
      />

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        items={items}
        selectedIds={multiSelectedIds}
      />
    </div>
  );
}
