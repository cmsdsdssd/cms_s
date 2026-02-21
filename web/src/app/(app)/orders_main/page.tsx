"use client";

import { useMemo, useState, lazy, Suspense } from "react";
import Link from "next/link";
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarInput,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { hasVariationTag, removeVariationTag } from "@/lib/variation-tag";
import { Building2 } from "lucide-react";

const INVENTORY_TAG = "/재고/";
const LEGACY_INVENTORY_TAG = "[재고]";

const hasInventoryTag = (memo?: string | null) => {
  const value = String(memo ?? "");
  return value.includes(INVENTORY_TAG) || value.includes(LEGACY_INVENTORY_TAG);
};

const toggleInventoryTag = (memo: string | null | undefined, on: boolean) => {
  const value = String(memo ?? "");
  if (on) {
    if (hasInventoryTag(value)) return value;
    const trimmed = value.trim();
    return trimmed ? `${trimmed} ${INVENTORY_TAG}` : INVENTORY_TAG;
  }
  return value
    .replaceAll(INVENTORY_TAG, "")
    .replaceAll(LEGACY_INVENTORY_TAG, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

type InventoryPositionByLocationRow = {
  model_name?: string | null;
  location_code?: string | null;
  on_hand_qty?: number | null;
};

type InventoryIssueCandidateRow = {
  move_line_id?: string | null;
  master_id?: string | null;
  occurred_at?: string | null;
  location_code?: string | null;
  bin_code?: string | null;
  master_model_name?: string | null;
  item_name?: string | null;
  variant_hint?: string | null;
  line_meta?: Record<string, unknown> | null;
  move_meta?: Record<string, unknown> | null;
  move_source?: string | null;
  move_memo?: string | null;
  qty?: number | null;
  move_status?: string | null;
  direction?: string | null;
  is_void?: boolean | null;
};

type InventoryIssueCandidate = {
  moveLineId: string;
  masterId: string;
  locationCode: string;
  binCode: string;
  material: string;
  color: string;
  size: string;
  netWeight: string;
  baseWeight: string;
  deductionWeight: string;
  qty: number;
  centerStoneName: string;
  centerQty: number;
  sub1StoneName: string;
  sub1Qty: number;
  sub2StoneName: string;
  sub2Qty: number;
  laborOtherSell: number;
  laborBaseSell: number;
  memo: string;
  source: string;
  occurredAt: string;
};

// Lazy load Factory Order Wizard
const FactoryOrderWizard = lazy(() => import("@/components/factory-order/factory-order-wizard"));

type OrderRow = {
  order_line_id?: string;
  customer_party_id?: string;
  customer_name?: string;
  customer_mask_code?: string | null;
  model_name?: string;
  suffix?: string;
  material_code?: string | null;
  color?: string;
  size?: string | null;
  qty?: number;
  status?: string;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  memo?: string | null;
  created_at?: string | null;
  factory_po_id?: string | null;
};

type FactoryOrderLine = Omit<OrderRow, "customer_mask_code"> & {
  customer_mask_code?: string;
  vendor_guess_id: string;
  vendor_guess: string;
};

type PartyRow = {
  party_id?: string;
  name?: string;
  party_type?: string;
  is_active?: boolean;
};

type VendorPrefixRow = {
  prefix?: string;
  vendor_party_id?: string;
};

type MasterImageRow = {
  model_name?: string | null;
  image_path?: string | null;
};

type FilterType = "customer" | "factory" | "model" | "date" | "status";

type FilterRow = {
  id: string;
  type: FilterType;
  value: string;
};

const createFilter = (type: FilterType): FilterRow => ({
  id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  value: "",
});

function normalizeImagePath(path: string, bucket: string) {
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  if (path.startsWith("storage/v1/object/public/")) {
    return path.replace("storage/v1/object/public/", "").split("/").slice(1).join("/");
  }
  return path;
}

function buildPublicImageUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "master_images";
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);
  return `${url}/storage/v1/object/public/${bucket}/${normalized}`;
}

const MATERIAL_LABELS: Record<string, string> = {
  "14": "14",
  "18": "18",
  "24": "24",
  "925": "925",
  "999": "999",
  "00": "00",
};

const parseVariantParts = (variantHint?: string | null) => {
  const parts = String(variantHint ?? "").split("/").map((p) => p.trim()).filter(Boolean);
  return {
    material: parts[0] ?? "-",
    color: parts[1] ?? "-",
    size: parts[2] ?? "-",
  };
};

const toNumOrZero = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pickMetaNumber = (meta: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const raw = meta[key];
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const pickMetaString = (meta: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const raw = meta[key];
    if (raw === null || raw === undefined) continue;
    const s = String(raw).trim();
    if (s) return s;
  }
  return "";
};

const appendInventorySelectionMemo = (memo: string | null | undefined, candidate: InventoryIssueCandidate) => {
  const base = String(memo ?? "").replace(/\s*\[재고선택:[^\]]*\]/g, "").trim();
  const tag =
    `[재고선택:${candidate.locationCode}${candidate.binCode !== "-" ? `/${candidate.binCode}` : ""},` +
    `${candidate.material},${candidate.color},${candidate.size},기본${candidate.baseWeight}g,차감${candidate.deductionWeight}g,` +
    `순${candidate.netWeight}g,기본공임${candidate.laborBaseSell},기타공임${candidate.laborOtherSell},#${candidate.moveLineId.slice(0, 8)}]`;
  return base ? `${base} ${tag}` : tag;
};

const upsertOrderMemoViaApi = async (
  orderLineId: string,
  memo: string,
  detail?: {
    material_code?: string;
    color?: string;
    size?: string;
    center_stone_name?: string;
    center_stone_qty?: number;
    sub1_stone_name?: string;
    sub1_stone_qty?: number;
    sub2_stone_name?: string;
    sub2_stone_qty?: number;
  }
) => {
  const response = await fetch("/api/order-line-memo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_line_id: orderLineId,
      memo,
      ...(detail ?? {}),
    }),
  });

  if (!response.ok) {
    let reason = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string; details?: string };
      reason = payload.error || payload.details || reason;
    } catch {
      // ignore parse failure
    }
    throw new Error(reason);
  }
};

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    const candidates = [
      rec.message,
      rec.error,
      rec.details,
      rec.hint,
      rec.code,
      rec.statusText,
      rec.status,
    ];
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v;
      if (typeof v === "number") return String(v);
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "알수없는오류";
    }
  }
  return "알수없는오류";
};

function getMaterialLabel(value?: string | null) {
  if (!value) return "-";
  return MATERIAL_LABELS[value] ?? value;
}

const CATEGORY_LABELS: Record<string, string> = {
  BRACELET: "팔찌",
  ANKLET: "발찌",
  NECKLACE: "목걸이",
  EARRING: "귀걸이",
  RING: "반지",
  PIERCING: "피어싱",
  PENDANT: "펜던트",
  WATCH: "시계",
  KEYRING: "키링",
  SYMBOL: "상징",
  ACCESSORY: "부속",
  ETC: "기타",
};

const STATUS_OPTIONS = [
  { value: "ORDER_PENDING", label: "주문대기" },
  { value: "SENT_TO_VENDOR", label: "공장전송" },
  { value: "READY_TO_SHIP", label: "출고준비" },
  { value: "SHIPPED", label: "출고완료" },
  { value: "CANCELLED", label: "주문취소" },
];

const STATUS_TONE_CLASS: Record<string, { row: string; rail: string }> = {
  CANCELLED: { row: "", rail: "bg-rose-500/80" },
  ORDER_PENDING: { row: "bg-amber-500/10", rail: "bg-amber-500/80" },
  SENT_TO_VENDOR: { row: "", rail: "bg-sky-500/80" },
  READY_TO_SHIP: { row: "", rail: "bg-violet-500/80" },
  SHIPPED: { row: "", rail: "bg-emerald-500/80" },
};

function getCategoryLabel(value?: string | null) {
  if (!value) return "-";
  return CATEGORY_LABELS[value] ?? value;
}

export default function OrdersMainPage() {
  const schemaClient = getSchemaClient();
  const todayKey = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<FilterRow[]>(() => [
    { id: `date-${todayKey}`, type: "date", value: todayKey },
  ]);
  const [showFactoryOrderWizard, setShowFactoryOrderWizard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [bulkIssueLoading, setBulkIssueLoading] = useState(false);
  const [inventoryTagSavingIds, setInventoryTagSavingIds] = useState<Set<string>>(new Set());
  const [inventoryMatchModalOpen, setInventoryMatchModalOpen] = useState(false);
  const [inventoryMatchCandidates, setInventoryMatchCandidates] = useState<
    Record<string, InventoryIssueCandidate[]>
  >({});
  const [inventoryMatchSelection, setInventoryMatchSelection] = useState<Record<string, string>>({});
  const actorId = process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null;

  const ordersQuery = useQuery({
    queryKey: ["cms", "orders", "main"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_order_line")
        .select(
          "order_line_id, customer_party_id, customer_mask_code, model_name, suffix, material_code, color, size, qty, status, created_at, center_stone_name, center_stone_qty, sub1_stone_name, sub1_stone_qty, sub2_stone_name, sub2_stone_qty, is_plated, plating_color_code, memo, factory_po_id"
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    (ordersQuery.data ?? []).forEach((order) => {
      if (order.model_name) names.add(order.model_name);
    });
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [ordersQuery.data]);

  const masterImagesQuery = useQuery<MasterImageRow[]>({
    queryKey: ["cms", "master_images", modelNames],
    queryFn: async () => {
      if (!schemaClient || modelNames.length === 0) return [];
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("model_name, image_path")
        .in("model_name", modelNames);
      if (error) {
        console.error("Failed to load master images:", error);
        return [];
      }
      return (data ?? []) as MasterImageRow[];
    },
    enabled: !!schemaClient && modelNames.length > 0,
  });

  const masterImageMap = useMemo(() => {
    const map = new Map<string, string>();
    (masterImagesQuery.data ?? []).forEach((row) => {
      const name = row.model_name ? String(row.model_name) : "";
      const imageUrl = buildPublicImageUrl(row.image_path ? String(row.image_path) : null);
      if (name && imageUrl) {
        map.set(name, imageUrl);
      }
    });
    return map;
  }, [masterImagesQuery.data]);

  const customersQuery = useQuery({
    queryKey: ["cms", "customers"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, is_active")
        .eq("party_type", "customer")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PartyRow[];
    },
  });

  const vendorsQuery = useQuery({
    queryKey: ["cms", "vendors"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type, is_active")
        .eq("party_type", "vendor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PartyRow[];
    },
  });

  const vendorPrefixQuery = useQuery({
    queryKey: ["cms", "vendor_prefix"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_vendor_prefix_map")
        .select("prefix, vendor_party_id");
      if (error) throw error;
      return (data ?? []) as VendorPrefixRow[];
    },
  });

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    (vendorsQuery.data ?? []).forEach((row) => {
      if (row.party_id && row.name) map.set(row.party_id, row.name);
    });
    return map;
  }, [vendorsQuery.data]);

  const vendorPrefixes = useMemo(() => {
    return (vendorPrefixQuery.data ?? [])
      .filter((row) => row.prefix && row.vendor_party_id)
      .map((row) => ({
        prefix: String(row.prefix ?? ""),
        vendorPartyId: String(row.vendor_party_id ?? ""),
      }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  }, [vendorPrefixQuery.data]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customersQuery.data ?? []).forEach((row) => {
      if (row.party_id && row.name) map.set(row.party_id, row.name);
    });
    return map;
  }, [customersQuery.data]);

  const ordersWithFactory = useMemo<FactoryOrderLine[]>(() => {
    return (ordersQuery.data ?? []).map((order) => {
      const model = (order.model_name ?? "").toLowerCase();
      let vendorPartyId = "";

      for (const row of vendorPrefixes) {
        const prefixLower = row.prefix.toLowerCase();
        if (model.startsWith(prefixLower)) {
          vendorPartyId = row.vendorPartyId;
          break;
        }
      }

      return {
        ...order,
        customer_mask_code: order.customer_mask_code ?? undefined,
        customer_name: order.customer_party_id
          ? customerNameById.get(order.customer_party_id) ?? "-"
          : "-",
        vendor_guess_id: vendorPartyId,
        vendor_guess: vendorPartyId ? vendorNameById.get(vendorPartyId) ?? vendorPartyId : "",
      };
    });
  }, [ordersQuery.data, vendorPrefixes, vendorNameById, customerNameById]);

  const applyFilters = useMemo(() => {
    return ordersWithFactory.filter((order) => {
      if (!includeCancelled && order.status === "CANCELLED") return false;
      return filters.every((filter) => {
        if (filter.type === "customer") {
          return filter.value ? order.customer_party_id === filter.value : true;
        }
        if (filter.type === "factory") {
          return filter.value ? order.vendor_guess_id === filter.value : true;
        }
        if (filter.type === "model") {
          if (!filter.value) return true;
          const target = [order.model_name, order.suffix, order.color]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return target.includes(filter.value.toLowerCase());
        }
        if (filter.type === "status") {
          if (!filter.value) return true;
          return order.status === filter.value;
        }
        if (filter.type === "date") {
          if (!filter.value) return true;
          const created = order.created_at ? new Date(order.created_at) : null;
          if (!created) return false;
          const target = filter.value;
          const createdKey = created.toISOString().slice(0, 10);
          return createdKey === target;
        }
        return true;
      });
    });
  }, [ordersWithFactory, filters, includeCancelled]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(applyFilters.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;

  const paginatedOrders = useMemo((): Array<OrderRow | null> => {
    const slice: Array<OrderRow | null> = applyFilters.slice(startIndex, startIndex + itemsPerPage);
    while (slice.length < itemsPerPage) {
      slice.push(null);
    }
    return slice;
  }, [applyFilters, itemsPerPage, startIndex]);

  const pendingFilteredOrders = useMemo(() => {
    return applyFilters.filter((order) => {
      const isPending = order.status === "ORDER_PENDING";
      const noPo = !order.factory_po_id;
      const hasVendor = !!order.vendor_guess_id;
      const isInventoryChecked = hasInventoryTag(order.memo);
      return isPending && noPo && hasVendor && !isInventoryChecked;
    });
  }, [applyFilters]);

  const inventoryTargets = useMemo(
    () =>
      applyFilters.filter(
        (order) => order.status === "ORDER_PENDING" && Boolean(order.order_line_id) && hasInventoryTag(order.memo)
      ),
    [applyFilters]
  );

  const toggleInventoryInOrder = async (order: OrderRow, checked: boolean) => {
    const orderLineId = String(order.order_line_id ?? "");
    if (!orderLineId) return;

    setInventoryTagSavingIds((prev) => {
      const next = new Set(prev);
      next.add(orderLineId);
      return next;
    });

    const nextMemo = toggleInventoryTag(order.memo, checked);
    let errorMessage: string | null = null;
    try {
      await upsertOrderMemoViaApi(orderLineId, nextMemo);
    } catch (error) {
      errorMessage = extractErrorMessage(error);
    }

    setInventoryTagSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(orderLineId);
      return next;
    });

    if (errorMessage) {
      window.alert(`재고체크 저장 실패: ${errorMessage}`);
      return;
    }

    await ordersQuery.refetch();
  };

  const markSelectedAsReadyToShip = async () => {
    if (!schemaClient) {
      window.alert("Supabase env is missing");
      return;
    }
    if (inventoryTargets.length === 0) {
      window.alert("orders_main에서 재고 체크된 ORDER_PENDING 주문이 없습니다.");
      return;
    }

    const { data, error } = await schemaClient
      .from(CONTRACTS.views.inventoryPositionByMasterLocation)
      .select("model_name, location_code, on_hand_qty");
    if (error) {
      window.alert(`재고 조회 실패: ${error.message}`);
      return;
    }

    const byModel = new Map<string, Array<{ locationCode: string; onHandQty: number }>>();
    ((data ?? []) as InventoryPositionByLocationRow[]).forEach((row) => {
      const model = String(row.model_name ?? "").trim().toLowerCase();
      const locationCode = String(row.location_code ?? "").trim();
      const onHandQty = Number(row.on_hand_qty ?? 0);
      if (!model || !locationCode || onHandQty < 1) return;
      const list = byModel.get(model) ?? [];
      list.push({ locationCode, onHandQty });
      byModel.set(model, list);
    });

    const { data: lotRowsRaw, error: lotError } = await schemaClient
      .from(CONTRACTS.views.inventoryMoveLinesEnriched)
      .select("move_line_id, master_id, occurred_at, location_code, bin_code, master_model_name, item_name, variant_hint, line_meta, move_meta, move_source, move_memo, qty, move_status, direction, is_void")
      .eq("move_status", "POSTED")
      .eq("direction", "IN")
      .eq("is_void", false)
      .limit(3000);

    if (lotError) {
      window.alert(`재고 상세 조회 실패: ${lotError.message}`);
      return;
    }

    const lotRows = (lotRowsRaw ?? []) as InventoryIssueCandidateRow[];

    const nextCandidates: Record<string, InventoryIssueCandidate[]> = {};
    const nextSelection: Record<string, string> = {};
    for (const target of inventoryTargets) {
      const orderLineId = String(target.order_line_id);
      const model = String(target.model_name ?? "").trim().toLowerCase();
      const candidates = byModel.get(model) ?? [];
      if (candidates.length === 0) {
        window.alert(`재고 부족: ${target.model_name ?? "(모델없음)"}`);
        return;
      }
      const positiveLocations = new Set(candidates.filter((c) => c.onHandQty > 0).map((c) => c.locationCode));
      const modelOnHandTotal = candidates.reduce((sum, c) => sum + Math.max(0, c.onHandQty), 0);
      const seenMoveLineIds = new Set<string>();

      const lots = lotRows
        .filter((row) => {
          const rowModel = String(row.master_model_name ?? row.item_name ?? "").trim().toLowerCase();
          if (!rowModel || rowModel !== model) return false;
          const location = String(row.location_code ?? "").trim();
          return !!location && positiveLocations.has(location);
        })
        .map((row) => {
          const moveLineId = String(row.move_line_id ?? "");
          if (!moveLineId || seenMoveLineIds.has(moveLineId)) return null;
          seenMoveLineIds.add(moveLineId);

          const parts = parseVariantParts(row.variant_hint);
          const meta = {
            ...((row.move_meta ?? {}) as Record<string, unknown>),
            ...((row.line_meta ?? {}) as Record<string, unknown>),
          };
          const material = String(meta.material_code ?? parts.material ?? "-") || "-";
          const color = String(meta.color ?? parts.color ?? "-") || "-";
          const size = String(meta.size ?? parts.size ?? "-") || "-";

          const baseWeight = pickMetaNumber(meta, ["base_weight_g", "baseWeightG", "weight_g", "weightG"]);
          const deductionWeight = pickMetaNumber(meta, ["deduction_weight_g", "deductionWeightG"]);
          const directNet = pickMetaNumber(meta, ["net_weight_g", "netWeightG", "net_weight", "weight_net_g"]);
          const netWeightNum = directNet > 0 ? directNet : Math.max(0, baseWeight - deductionWeight);
          const netWeight = netWeightNum > 0 ? netWeightNum.toFixed(2) : "-";
          const baseWeightText = baseWeight > 0 ? baseWeight.toFixed(2) : "-";
          const deductionWeightText = deductionWeight > 0 ? deductionWeight.toFixed(2) : "0.00";
          const centerStoneName = pickMetaString(meta, ["center_stone_name", "centerStoneName"]);
          const centerQty = Math.max(0, pickMetaNumber(meta, ["center_qty", "centerQty"]));
          const sub1StoneName = pickMetaString(meta, ["sub1_stone_name", "sub1StoneName"]);
          const sub1Qty = Math.max(0, pickMetaNumber(meta, ["sub1_qty", "sub1Qty"]));
          const sub2StoneName = pickMetaString(meta, ["sub2_stone_name", "sub2StoneName"]);
          const sub2Qty = Math.max(0, pickMetaNumber(meta, ["sub2_qty", "sub2Qty"]));
          const laborOtherSell = Math.max(0, pickMetaNumber(meta, ["labor_other_sell", "laborOtherSell"]));
          const laborBaseSell = Math.max(0, pickMetaNumber(meta, ["labor_base_sell", "laborBaseSell"]));

          return {
            moveLineId,
            masterId: String(row.master_id ?? ""),
            locationCode: String(row.location_code ?? "-"),
            binCode: String(row.bin_code ?? "-") || "-",
            material,
            color,
            size,
            netWeight,
            baseWeight: baseWeightText,
            deductionWeight: deductionWeightText,
            qty: Math.max(0, toNumOrZero(row.qty)),
            centerStoneName,
            centerQty,
            sub1StoneName,
            sub1Qty,
            sub2StoneName,
            sub2Qty,
            laborOtherSell,
            laborBaseSell,
            memo: String(row.move_memo ?? ""),
            source: String(row.move_source ?? ""),
            occurredAt: String(row.occurred_at ?? ""),
          } satisfies InventoryIssueCandidate;
        })
        .filter((row): row is InventoryIssueCandidate => Boolean(row && row.moveLineId))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

      const trimmedLots: InventoryIssueCandidate[] = [];
      let remaining = modelOnHandTotal;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const available = Math.min(remaining, Math.max(0, lot.qty));
        if (available <= 0) continue;
        trimmedLots.push({ ...lot, qty: available });
        remaining -= available;
      }

      if (trimmedLots.length === 0) {
        window.alert(`재고 상세 후보 없음: ${target.model_name ?? "(모델없음)"}`);
        return;
      }

      nextCandidates[orderLineId] = trimmedLots;
      nextSelection[orderLineId] = trimmedLots[0].moveLineId;
    }

    setInventoryMatchCandidates(nextCandidates);
    setInventoryMatchSelection(nextSelection);
    setInventoryMatchModalOpen(true);
  };

  const confirmInventoryIssueWithMatch = async () => {
    const setStatusFn = CONTRACTS.functions.orderSetStatus;
    const quickMoveFn = CONTRACTS.functions.quickInventoryMove;
    if (!setStatusFn) {
      window.alert("orderSetStatus RPC가 설정되지 않았습니다.");
      return;
    }
    if (!quickMoveFn) {
      window.alert("quickInventoryMove RPC가 설정되지 않았습니다.");
      return;
    }
    if (inventoryTargets.length === 0) {
      window.alert("orders_main에서 재고 체크된 ORDER_PENDING 주문이 없습니다.");
      return;
    }

    setBulkIssueLoading(true);
    const succeeded: string[] = [];
    const failed: Array<{ orderLineId: string; reason: string }> = [];
    for (const target of inventoryTargets) {
      const orderLineId = String(target.order_line_id);
      const matchedMoveLineId = inventoryMatchSelection[orderLineId];
      const matchedCandidate = (inventoryMatchCandidates[orderLineId] ?? []).find(
        (candidate) => candidate.moveLineId === matchedMoveLineId
      );
      if (!matchedCandidate) {
        failed.push({ orderLineId, reason: "매칭 후보 누락" });
        continue;
      }
      try {
        if (schemaClient) {
          const nextMemo = appendInventorySelectionMemo(target.memo, matchedCandidate);
          await upsertOrderMemoViaApi(orderLineId, nextMemo, {
            material_code: matchedCandidate.material === "-" ? undefined : matchedCandidate.material,
            color: matchedCandidate.color === "-" ? undefined : matchedCandidate.color,
            size: matchedCandidate.size === "-" ? undefined : matchedCandidate.size,
            center_stone_name: matchedCandidate.centerStoneName || undefined,
            center_stone_qty: matchedCandidate.centerQty || undefined,
            sub1_stone_name: matchedCandidate.sub1StoneName || undefined,
            sub1_stone_qty: matchedCandidate.sub1Qty || undefined,
            sub2_stone_name: matchedCandidate.sub2StoneName || undefined,
            sub2_stone_qty: matchedCandidate.sub2Qty || undefined,
            selected_base_weight_g: matchedCandidate.baseWeight === "-" ? undefined : Number(matchedCandidate.baseWeight),
            selected_deduction_weight_g: Number(matchedCandidate.deductionWeight || 0),
            selected_net_weight_g: matchedCandidate.netWeight === "-" ? undefined : Number(matchedCandidate.netWeight),
            selected_labor_base_sell_krw: matchedCandidate.laborBaseSell || undefined,
            selected_labor_other_sell_krw: matchedCandidate.laborOtherSell || undefined,
            selected_inventory_move_line_id: matchedCandidate.moveLineId,
            selected_inventory_location_code: matchedCandidate.locationCode,
            selected_inventory_bin_code: matchedCandidate.binCode === "-" ? undefined : matchedCandidate.binCode,
          });
        }

        const issueQty = Math.max(1, Number(target.qty ?? 1));
        await callRpc(quickMoveFn, {
          p_move_type: "ISSUE",
          p_item_name: target.model_name ?? "UNKNOWN_ITEM",
          p_qty: issueQty,
          p_occurred_at: new Date().toISOString(),
          p_party_id: target.customer_party_id ?? null,
          p_location_code: matchedCandidate.locationCode,
          p_bin_code: matchedCandidate.binCode === "-" ? null : matchedCandidate.binCode,
          p_variant_hint: [matchedCandidate.material, matchedCandidate.color, matchedCandidate.size]
            .filter((x) => x && x !== "-")
            .join("/") || null,
          p_unit: "EA",
          p_source: "AUTO_ORDER_READY",
          p_memo:
            `order_line=${orderLineId}, lot=${matchedCandidate.moveLineId.slice(0, 8)},` +
            ` net=${matchedCandidate.netWeight}g, base=${matchedCandidate.baseWeight}g, deduction=${matchedCandidate.deductionWeight}g`,
          p_meta: {
            order_line_id: orderLineId,
            selected_inventory_move_line_id: matchedCandidate.moveLineId,
            selected_material_code: matchedCandidate.material,
            selected_color: matchedCandidate.color,
            selected_size: matchedCandidate.size,
            selected_base_weight_g: matchedCandidate.baseWeight,
            selected_deduction_weight_g: matchedCandidate.deductionWeight,
            selected_net_weight_g: matchedCandidate.netWeight,
            selected_labor_base_sell: matchedCandidate.laborBaseSell,
            selected_labor_other_sell: matchedCandidate.laborOtherSell,
          },
          p_idempotency_key: `ORDER_READY_ISSUE:${orderLineId}:${matchedCandidate.moveLineId}`,
          p_actor_person_id: actorId,
          p_note: "orders_main inventory issue on ready_to_ship",
          p_correlation_id: crypto.randomUUID(),
          p_master_id: matchedCandidate.masterId || target.matched_master_id || null,
        });

        await callRpc(setStatusFn, {
          p_order_line_id: orderLineId,
          p_to_status: "READY_TO_SHIP",
          p_actor_person_id: actorId,
          p_reason:
            `재고출고(${matchedCandidate.locationCode}${matchedCandidate.binCode !== "-" ? `/${matchedCandidate.binCode}` : ""}` +
            `,${matchedCandidate.material},${matchedCandidate.color},${matchedCandidate.size},${matchedCandidate.netWeight}g,#${matchedCandidate.moveLineId.slice(0, 8)})`,
        });
        succeeded.push(orderLineId);
      } catch (error) {
        failed.push({ orderLineId, reason: extractErrorMessage(error) });
      }
    }
    setBulkIssueLoading(false);
    setInventoryMatchModalOpen(false);

    if (succeeded.length > 0) {
      await ordersQuery.refetch();
    }

    if (failed.length > 0) {
      const detail = failed
        .slice(0, 3)
        .map((item) => `${item.orderLineId.slice(0, 8)}: ${item.reason}`)
        .join("\n");
      const more = failed.length > 3 ? `\n외 ${failed.length - 3}건` : "";
      window.alert(`일부 실패: ${failed.length}건 (성공 ${succeeded.length}건)\n${detail}${more}`);
    } else {
      window.alert(`재고출고 전환 완료: ${succeeded.length}건`);
    }
  };

  const editAllHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("edit_all", "1");
    params.set("include_cancelled", includeCancelled ? "1" : "0");
    filters.forEach((filter) => {
      if (!filter.value) return;
      if (filter.type === "customer") params.set("filter_customer", filter.value);
      if (filter.type === "factory") params.set("filter_factory", filter.value);
      if (filter.type === "model") params.set("filter_model", filter.value);
      if (filter.type === "status") params.set("filter_status", filter.value);
      if (filter.type === "date") params.set("filter_date", filter.value);
    });
    return `/orders?${params.toString()}`;
  }, [filters, includeCancelled]);

  const addFilter = (type: FilterType) => {
    setFilters((prev) => [...prev, createFilter(type)]);
    setCurrentPage(1);
  };

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
    setCurrentPage(1);
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
    setCurrentPage(1);
  };

  const customerOptions = (customersQuery.data ?? []).map((row) => ({
    value: row.party_id ?? "",
    label: row.name ?? "-",
  }));

  const vendorOptions = (vendorsQuery.data ?? []).map((row) => ({
    value: row.party_id ?? "",
    label: row.name ?? "-",
  }));

  const dateOptions = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    for (let i = 0; i < 60; i += 1) {
      const current = new Date(today);
      current.setDate(today.getDate() - i);
      list.push(current.toISOString().slice(0, 10));
    }
    return list;
  }, []);

  const filteredCount = applyFilters.length;
  const isLoading = ordersQuery.isLoading || customersQuery.isLoading || vendorsQuery.isLoading || vendorPrefixQuery.isLoading;
  const todayOrderCount = useMemo(() => {
    return (ordersQuery.data ?? []).filter((order) => {
      if (order.status === "CANCELLED") return false;
      if (!order.created_at) return false;
      return new Date(order.created_at).toISOString().slice(0, 10) === todayKey;
    }).length;
  }, [ordersQuery.data, todayKey]);

  const todayCancelledCount = useMemo(() => {
    return (ordersQuery.data ?? []).filter((order) => {
      if (order.status !== "CANCELLED") return false;
      if (!order.created_at) return false;
      return new Date(order.created_at).toISOString().slice(0, 10) === todayKey;
    }).length;
  }, [ordersQuery.data, todayKey]);

  return (
    <div className="space-y-5" id="orders_main.root">
      {/* Factory Order Wizard Modal */}
      {showFactoryOrderWizard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Suspense fallback={
            <div className="bg-card p-8 rounded-lg">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted mt-4">로딩중...</p>
            </div>
          }>
            <FactoryOrderWizard
              orderLines={pendingFilteredOrders}
              onClose={() => setShowFactoryOrderWizard(false)}
              onSuccess={() => {
                setShowFactoryOrderWizard(false);
                ordersQuery.refetch();
              }}
            />
          </Suspense>
        </div>
      )}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
            <img
              src={previewImageUrl}
              alt="model preview"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {inventoryMatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--panel-border)] flex items-center justify-between">
              <div className="text-sm font-semibold">재고 매칭 확정 (orders_main)</div>
              <button
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setInventoryMatchModalOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
              {inventoryTargets.map((target) => {
                const orderLineId = String(target.order_line_id);
                const model = String(target.model_name ?? "-");
                const candidates = inventoryMatchCandidates[orderLineId] ?? [];
                const selected = candidates.find((c) => c.moveLineId === inventoryMatchSelection[orderLineId]) ?? null;
                return (
                  <div key={orderLineId} className="space-y-2 rounded-lg border border-[var(--panel-border)] bg-[var(--chip)] px-3 py-2">
                    <div className="text-sm font-semibold truncate">{model}</div>
                    <select
                      value={inventoryMatchSelection[orderLineId] ?? ""}
                      onChange={(e) =>
                        setInventoryMatchSelection((prev) => ({ ...prev, [orderLineId]: e.target.value }))
                      }
                      className="h-8 w-full text-xs rounded-md bg-[var(--background)] border border-[var(--panel-border)] px-2"
                    >
                      {candidates.map((c) => (
                        <option key={`${orderLineId}-${c.moveLineId}`} value={c.moveLineId}>
                          {c.locationCode}{c.binCode !== "-" ? `/${c.binCode}` : ""} · 소재 {c.material} · 색 {c.color} · 사이즈 {c.size} · {c.netWeight === "-" ? "중량 -" : `${c.netWeight}g`} · 수량 {c.qty}
                        </option>
                      ))}
                    </select>
                    {selected ? (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                        <div>위치: <span className="text-[var(--foreground)]">{selected.locationCode}</span></div>
                        <div>bin: <span className="text-[var(--foreground)]">{selected.binCode}</span></div>
                        <div>소재: <span className="text-[var(--foreground)]">{selected.material}</span></div>
                        <div>색상: <span className="text-[var(--foreground)]">{selected.color}</span></div>
                        <div>사이즈: <span className="text-[var(--foreground)]">{selected.size}</span></div>
                        <div>중량: <span className="text-[var(--foreground)]">기본 {selected.baseWeight}g / 차감 {selected.deductionWeight}g / 순 {selected.netWeight}g</span></div>
                        <div>중심석: <span className="text-[var(--foreground)]">{selected.centerStoneName || "-"} {selected.centerQty ? `(${selected.centerQty})` : ""}</span></div>
                        <div>보조1석: <span className="text-[var(--foreground)]">{selected.sub1StoneName || "-"} {selected.sub1Qty ? `(${selected.sub1Qty})` : ""}</span></div>
                        <div>보조2석: <span className="text-[var(--foreground)]">{selected.sub2StoneName || "-"} {selected.sub2Qty ? `(${selected.sub2Qty})` : ""}</span></div>
                        <div>기본공임(판매): <span className="text-[var(--foreground)]">{selected.laborBaseSell.toLocaleString()}</span></div>
                        <div>기타공임(판매): <span className="text-[var(--foreground)]">{selected.laborOtherSell.toLocaleString()}</span></div>
                        <div className="col-span-2">입고메모: <span className="text-[var(--foreground)]">{selected.memo || "-"}</span></div>
                        <div className="col-span-2">입고소스: <span className="text-[var(--foreground)]">{selected.source || "-"}</span></div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-[var(--panel-border)] flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setInventoryMatchModalOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmInventoryIssueWithMatch}
                disabled={bulkIssueLoading}
              >
                {bulkIssueLoading ? "처리중..." : "매칭확정 + 재고출고"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Toolbar - Compact Header */}
      <UnifiedToolbar
        title="주문관리"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFactoryOrderWizard(true)}
              className="flex items-center gap-1"
            >
              <Building2 className="w-4 h-4" />
              공장발주
              <Badge tone="neutral" className="ml-1 text-[10px] h-4 px-1">
                {pendingFilteredOrders.length}
              </Badge>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={markSelectedAsReadyToShip}
              disabled={bulkIssueLoading || inventoryTargets.length === 0}
            >
              {bulkIssueLoading ? "재고출고 처리중..." : `재고출고 (${inventoryTargets.length})`}
            </Button>
            <Link href="/orders">
              <ToolbarButton variant="primary">
                + 주문 입력
              </ToolbarButton>
            </Link>
            <Link href="/factory_po_history">
              <ToolbarButton variant="secondary">
                발주 전송내역
              </ToolbarButton>
            </Link>
          </div>
        }
      >
        {/* Quick Filters */}
        <ToolbarSelect
          value={filters.find(f => f.type === "customer")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "customer");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("customer");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "customer");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-32"
        >
          <option value="">(고객)</option>
          {customerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          value={filters.find(f => f.type === "factory")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "factory");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("factory");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "factory");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-32"
        >
          <option value="">(공장)</option>
          {vendorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          value={filters.find(f => f.type === "date")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "date");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("date");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "date");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          className="w-32"
        >
          <option value="">(날짜)</option>
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </ToolbarSelect>

        <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

        <ToolbarInput
          value={filters.find(f => f.type === "model")?.value || ""}
          onChange={(value) => {
            const existing = filters.find(f => f.type === "model");
            if (existing) {
              updateFilter(existing.id, { value });
            } else if (value) {
              addFilter("model");
              setTimeout(() => {
                const newFilter = filters.find(f => f.type === "model");
                if (newFilter) updateFilter(newFilter.id, { value });
              }, 0);
            }
          }}
          placeholder="모델 검색"
          className="w-40 md:w-52"
        />

        {/* Filter Count Badge */}
        {filters.length > 0 && (
          <Badge tone="primary" className="text-xs px-2 py-0.5">
            {filters.length}
          </Badge>
        )}
      </UnifiedToolbar>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-3">
        <Card className="border-[var(--panel-border)] bg-[var(--panel)] shadow-sm">
          <CardBody className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">오늘 주문</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)] tabular-nums">{todayOrderCount}</p>
          </CardBody>
        </Card>
        <Card className="border-[var(--panel-border)] bg-[var(--panel)] shadow-sm">
          <CardBody className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">오늘 취소</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--danger)] tabular-nums">{todayCancelledCount}</p>
          </CardBody>
        </Card>
        <Card className="border-[var(--panel-border)] bg-[var(--panel)] shadow-sm">
          <CardBody className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">필터 결과</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)] tabular-nums">{filteredCount}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[300px_1fr]">
        {/* Filters Panel - Compact */}
        <Card className="h-fit border-[var(--panel-border)] bg-[var(--panel)] shadow-sm" id="orders_main.filters">
          <CardHeader className="flex items-center justify-between border-b border-[var(--panel-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">활성 필터</h3>
              {filters.length > 0 && (
                <Badge tone="neutral" className="text-xs px-1.5 py-0">
                  {filters.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                className="h-9 w-24 text-sm"
                onChange={(event) => addFilter(event.target.value as FilterType)}
                value=""
              >
                <option value="" disabled>+ 추가</option>
                <option value="customer">고객</option>
                <option value="factory">공장</option>
                <option value="model">모델명</option>
                <option value="status">상태</option>
                <option value="date">날짜</option>
              </Select>
              {filters.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setFilters([])}>
                  모두 지우기
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody className="grid min-h-[120px] gap-3 p-4">
            {filters.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--muted)] bg-[var(--panel)] rounded-md border border-dashed border-[var(--panel-border)]">
                필터가 없습니다
              </div>
            ) : null}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3",
                includeCancelled ? "bg-emerald-500/10" : "bg-red-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">status</Badge>
                <span className="text-xs text-[var(--muted)]">주문취소 포함</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeCancelled((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  includeCancelled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border-red-500/20 bg-red-500/5 text-red-300"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    includeCancelled ? "bg-emerald-400" : "bg-red-300"
                  )}
                />
                {includeCancelled ? "ON" : "OFF"}
              </button>
            </div>
            {filters.map((filter) => (
              <div
                key={filter.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-3",
                  filter.value ? "bg-emerald-500/10" : "bg-red-500/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <Badge tone="neutral" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">{filter.type}</Badge>
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="text-[var(--muted)] hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>

                {filter.type === "customer" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">고객 선택</option>
                    {customerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "factory" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">공장 선택</option>
                    {vendorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "model" ? (
                  <Input
                    className="h-9 text-sm bg-[var(--input-bg)]"
                    placeholder="모델/색상"
                    value={filter.value}
                    onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                  />
                ) : null}
                {filter.type === "status" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">상태 선택</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {filter.type === "date" ? (
                  <Select className="h-9 text-sm bg-[var(--input-bg)]" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })}>
                    <option value="">날짜 선택</option>
                    {dateOptions.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* List Panel */}
        <Card className="flex min-h-[500px] flex-col border-[var(--panel-border)] bg-[var(--panel)] shadow-sm" id="orders_main.list">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">주문 리스트</h3>
              <span className="text-xs text-[var(--muted)]">{applyFilters.length}건</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-xs text-[var(--muted)] xl:flex">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--muted)]" />
                  주문취소
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--warning)]/70" />
                  주문대기
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500/70" />
                  공장전송
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]/70" />
                  출고준비
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-500/70" />
                  출고완료
                </span>
              </div>
              <Link href={editAllHref}>
                <Button size="sm" variant="secondary">
                  전체수정
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="flex flex-1 flex-col p-4">
            <div className="flex-1 space-y-2">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border border-[var(--panel-border)] rounded-[14px]">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : applyFilters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-[var(--muted)] border-2 border-dashed border-[var(--panel-border)] rounded-xl m-4">
                  <p className="text-sm font-medium">조건에 맞는 주문이 없습니다.</p>
                  <p className="text-xs">필터를 변경하거나 새로운 주문을 등록하세요.</p>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[0.35fr_64px_1.3fr_2.03fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.8fr_1fr] items-center">
                      <div className="text-center">#</div>
                      <div className="text-center">모델사진</div>
                      <div className="text-center">거래처</div>
                      <div className="text-center">모델명</div>
                      <div className="text-center">소재</div>
                      <div className="text-center">카테고리</div>
                      <div className="text-center">색상</div>
                      <div className="text-center">사이즈</div>
                      <div className="text-center">도금여부</div>
                      <div className="text-center">도금색</div>
                      <div className="text-center">석여부</div>
                      <div className="text-center">비고</div>
                    </div>
                  </div>
                  {paginatedOrders.map((order, idx) => {
                    const isEmpty = !order || !order.order_line_id;
                    const hasStone = order
                      ? Boolean(
                        (order.center_stone_name && String(order.center_stone_name).trim() !== "") ||
                        (order.sub1_stone_name && String(order.sub1_stone_name).trim() !== "") ||
                        (order.sub2_stone_name && String(order.sub2_stone_name).trim() !== "")
                      )
                      : false;
                    const materialLabel = order
                      ? getMaterialLabel(
                        order.material_code ??
                        (order.is_plated === null || order.is_plated === undefined
                          ? null
                          : order.is_plated
                            ? "14"
                            : "925")
                      )
                      : "-";
                    const platingLabel = order
                      ? order.is_plated === null || order.is_plated === undefined
                        ? "-"
                        : order.is_plated
                          ? "Y"
                          : "N"
                      : "-";
                    const rowKey = order?.order_line_id ?? `empty-${startIndex + idx}`;

                    const statusTone = STATUS_TONE_CLASS[order?.status ?? ""];

                    return (
                      <div
                        key={rowKey}
                        className={cn(
                          "group relative rounded-[14px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-0.5",
                          "transition-colors duration-150 hover:border-[var(--primary)]/25 hover:bg-[var(--panel)]",
                          isEmpty ? "opacity-40 min-h-[56px]" : "cursor-default",
                          order?.status === "CANCELLED" ? "line-through decoration-[2px] decoration-[var(--muted)] text-[var(--muted)]" : "",
                          statusTone?.row ?? ""
                        )}
                      >
                        <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-[0.35fr_64px_1.3fr_2.03fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.8fr_1fr] items-stretch">
                          {/* 1. 번호 */}
                          <div className="text-[var(--muted)] text-center text-base font-bold flex items-center justify-center">
                            {startIndex + idx + 1}
                          </div>

                          {/* 2. 모델사진 (absolute 유지하여 행 높이 영향 최소화 + 중앙 정렬) */}
                          <div className="font-semibold text-[var(--foreground)] flex flex-col items-center justify-center">
                            <div className="relative h-full w-full">
                              {order?.model_name && masterImageMap.get(order.model_name) ? (
                                <div
                                  className={cn(
                                    "absolute left-1/2 top-[135%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--panel)]",
                                    order?.status === "CANCELLED" ? "grayscale" : ""
                                  )}
                                >
                                  <img
                                    src={masterImageMap.get(order.model_name)}
                                    alt={order.model_name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onDoubleClick={() =>
                                      setPreviewImageUrl(order.model_name ? masterImageMap.get(order.model_name) ?? null : null)
                                    }
                                  />
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "absolute left-1/2 top-[56%] h-12 w-12 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--panel)] flex items-center justify-center text-[10px] text-[var(--muted)]",
                                    order?.status === "CANCELLED" ? "grayscale" : ""
                                  )}
                                >
                                  {order ? "-" : ""}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">모델사진</span>
                          </div>

                          {/* 3. 거래처 - 중앙 정렬 적용 */}
                          <div className="font-semibold text-[var(--foreground)] flex flex-col justify-center items-center text-center">
                            <span
                              className={cn(
                                "truncate px-2 text-sm font-semibold",
                                order?.status === "CANCELLED" ? "text-[var(--muted)]" : "text-[var(--foreground)]"
                              )}
                            >
                              {order?.customer_name ?? ""}
                            </span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">거래처</span>
                          </div>

                          {/* 4. 모델명 - 중앙 정렬 적용 */}
                          <div className="font-semibold text-[var(--foreground)] flex items-center justify-center gap-1 text-center">
                            <span
                              className={cn(
                                "truncate px-2 text-sm font-medium",
                                order?.status === "CANCELLED" ? "text-[var(--muted)]" : "text-[var(--foreground)]"
                              )}
                            >
                              {order?.model_name ?? ""}
                            </span>
                            {hasVariationTag(order?.memo) ? (
                              <Badge tone="warning" className="h-4 px-1 text-[9px]">
                                변형
                              </Badge>
                            ) : null}
                            {order?.order_line_id ? (
                              <label className="inline-flex items-center gap-1 rounded border border-[var(--panel-border)] bg-[var(--chip)] px-1 py-0.5 text-[9px] text-[var(--muted)]">
                                <input
                                  type="checkbox"
                                  checked={hasInventoryTag(order.memo)}
                                  onChange={(event) => void toggleInventoryInOrder(order, event.target.checked)}
                                  disabled={
                                    inventoryTagSavingIds.has(String(order.order_line_id)) ||
                                    order.status !== "ORDER_PENDING"
                                  }
                                  className="h-3 w-3"
                                />
                                재고
                              </label>
                            ) : null}
                          </div>

                          {/* 5. 소재 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order ? materialLabel : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">소재</span>
                          </div>

                          {/* 6. 카테고리 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{getCategoryLabel(order?.suffix)}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">카테고리</span>
                          </div>

                          {/* 7. 색상 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order?.color ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">색상</span>
                          </div>

                          {/* 8. 사이즈 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order?.size ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">사이즈</span>
                          </div>

                          {/* 9. 도금여부 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order ? platingLabel : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">도금여부</span>
                          </div>

                          {/* 10. 도금색 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order?.plating_color_code ?? ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">도금색</span>
                          </div>

                          {/* 11. 석여부 */}
                          <div className="flex flex-col justify-center text-[var(--muted)]">
                            <span>{order ? (hasStone ? "✓" : "-") : ""}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">석여부</span>
                          </div>

                          {/* 12. 비고 */}
                          <div className="text-[var(--muted)] truncate flex flex-col justify-center">
                            <span>{removeVariationTag(order?.memo ?? "")}</span>
                            <span className="text-[10px] text-[var(--muted)] font-normal lg:hidden">비고</span>
                          </div>

                          {!isEmpty ? (
                            <div className="flex justify-end items-center">
                              <Link href={`/orders?edit_order_line_id=${order.order_line_id}`}>
                                <Button size="sm" variant="secondary" className="opacity-0 transition-opacity group-hover:opacity-100">
                                  수정
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <div />
                          )}
                        </div>
                        {!isEmpty && order?.status && (
                          <div
                            className={cn(
                              "absolute right-0 top-0 h-full w-2 rounded-r-[14px] pointer-events-none",
                              statusTone?.rail ?? "bg-[var(--muted)]/40"
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-border)] pt-3">
              <span className="text-[11px] text-[var(--muted)]">
                페이지 {safePage} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                >
                  이전
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
