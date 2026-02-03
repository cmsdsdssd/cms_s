"use client";

import { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type ClientSummary = {
  client_id?: string;
  client_name?: string;
  balance_krw?: number | null;
  last_tx_at?: string | null;
  open_invoices_count?: number | null;
  credit_limit_krw?: number | null;
  risk_flag?: string | null;
};

type MasterLookup = {
  master_item_id?: string;
  model_name?: string;
  photo_url?: string | null;
  vendor_name?: string | null;
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
  material_price?: number | null;
  labor_basic?: number | null;
  labor_center?: number | null;
  labor_side1?: number | null;
  labor_side2?: number | null;
};

type StoneRow = {
  stone_id?: string;
  stone_name?: string;
};

type OrderDetailRow = {
  order_line_id?: string;
  customer_party_id?: string | null;
  matched_master_id?: string | null;
  model_name?: string | null;
  model_name_raw?: string | null;
  suffix?: string | null;
  color?: string | null;
  material_code?: string | null;
  size?: string | number | null;
  qty?: number | null;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  memo?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const EDITABLE_STATUSES = new Set(["ORDER_PENDING"]);


type OrderUpsertPayload = {
  p_customer_party_id: string | null;
  p_master_id: string | null;
  p_suffix: string | null;
  p_color: string | null;
  p_material_code: string | null;
  p_qty: number | null;
  p_size: string | null;
  p_is_plated: boolean;
  p_plating_variant_id: string | null;
  p_plating_color_code: string | null;
  p_requested_due_date: string | null;
  p_priority_code: string | null;
  p_source_channel: string | null;
  p_memo: string | null;
  p_order_line_id: string | null;
  p_center_stone_name: string | null;
  p_center_stone_qty: number | null | undefined;
  p_sub1_stone_name: string | null;
  p_sub1_stone_qty: number | null | undefined;
  p_sub2_stone_name: string | null;
  p_sub2_stone_qty: number | null | undefined;
  p_actor_person_id: string | null;
};

type GridRow = {
  id: string;
  order_line_id?: string | null;
  client_input: string;
  client_id: string | null;
  client_name: string | null;
  model_input: string;
  model_name: string | null;
  suffix: string;
  // Color now supports multiple: P, G, W
  color_p: boolean;
  color_g: boolean;
  color_w: boolean;
  color_x: boolean;
  material_code: string;
  size: string;
  qty: string;
  center_stone: string;
  center_qty: string;
  sub1_stone: string;
  sub1_qty: string;
  sub2_stone: string;
  sub2_qty: string;
  // Plating now supports multiple: P, G, W, B
  plating_p: boolean;
  plating_g: boolean;
  plating_w: boolean;
  plating_b: boolean;
  memo: string;
  // Stone toggle
  show_stones: boolean;
  master_item_id: string | null;
  photo_url: string | null;
  material_price: number | null;
  labor_basic: number | null;
  labor_center: number | null;
  labor_side1: number | null;
  labor_side2: number | null;
};

type RowErrors = {
  client?: string;
  model?: string;
  category?: string;
  color?: string;
  material?: string;
  qty?: string;
  plating?: string;
  stones?: string;
};

const PAGE_SIZE = 10;
const INITIAL_PAGES = 1;
const EMPTY_ROWS = PAGE_SIZE * INITIAL_PAGES;

const createRowId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// 카테고리 영문 -> 한글 변환 맵
const CATEGORY_MAP: Record<string, string> = {
  NECKLACE: "목걸이",
  EARRING: "귀걸이",
  RING: "반지",
  BRACELET: "팔찌",
  ANKLET: "발찌",
  PENDANT: "펜던트",
  PIERCING: "피어싱",
  CHAIN: "체인",
  BANGLE: "뱅글",
  COUPLING: "커플링",
  SET: "세트",
  ETC: "기타",
};

const MATERIAL_OPTIONS = [
  { label: "14K", value: "14" },
  { label: "18K", value: "18" },
  { label: "24K", value: "24" },
  { label: "925", value: "925" },
  { label: "00(기타)", value: "00" },
];

const getCategoryName = (code: string | null | undefined) => {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  return CATEGORY_MAP[upper] ?? code;
};

const createEmptyRow = (index: number): GridRow => ({
  id: `row-${index}-${createRowId()}`,
  order_line_id: null,
  client_input: "",
  client_id: null,
  client_name: null,
  model_input: "",
  model_name: null,
  suffix: "",
  color_p: false,
  color_g: false,
  color_w: false,
  color_x: false,
  material_code: "",
  size: "",
  qty: "1",
  center_stone: "",
  center_qty: "",
  sub1_stone: "",
  sub1_qty: "",
  sub2_stone: "",
  sub2_qty: "",
  plating_p: false,
  plating_g: false,
  plating_w: false,
  plating_b: false,
  memo: "",
  show_stones: false,
  master_item_id: null,
  photo_url: null,
  material_price: null,
  labor_basic: null,
  labor_center: null,
  labor_side1: null,
  labor_side2: null,
});

const normalizeText = (value: string) => value.trim();
const normalizeTextOrNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};
const normalizeSearchText = (value: string) => value.trim().toLowerCase();
const getOrderedMatchPositions = (label: string, query: string): number[] | null => {
  const normalizedLabel = label.toLowerCase();
  let lastIndex = -1;
  const positions: number[] = [];
  for (const ch of query) {
    const idx = normalizedLabel.indexOf(ch, lastIndex + 1);
    if (idx < 0) return null;
    positions.push(idx);
    lastIndex = idx;
  }
  return positions;
};

const compareMatchPositions = (a: number[], b: number[]) => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
};

const rankMatches = <T,>(items: T[], query: string, getLabel: (item: T) => string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [] as T[];

  const ranked = items
    .map((item) => {
      const label = getLabel(item);
      const positions = getOrderedMatchPositions(label, normalizedQuery);
      if (!positions) return null;
      return { item, label, positions } as { item: T; label: string; positions: number[] };
    })
    .filter((row): row is { item: T; label: string; positions: number[] } => Boolean(row));

  ranked.sort((a, b) => {
    const posDiff = compareMatchPositions(a.positions, b.positions);
    if (posDiff !== 0) return posDiff;
    if (a.label.length !== b.label.length) return a.label.length - b.label.length;
    return a.label.localeCompare(b.label);
  });

  return ranked.map((row) => row.item);
};
const toNumber = (value: string) => {
  const v = value.trim();
  if (v === "") return null;
  const parsed = Number(v);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

// Get color string from checkboxes
const getColorString = (row: GridRow): string => {
  if (row.color_x) return "X";
  const colors: string[] = [];
  if (row.color_p) colors.push("P");
  if (row.color_g) colors.push("G");
  if (row.color_w) colors.push("W");
  return colors.join("+");
};

// Get plating string from checkboxes
const getPlatingString = (row: GridRow): string => {
  const platings: string[] = [];
  if (row.plating_p) platings.push("P");
  if (row.plating_g) platings.push("G");
  if (row.plating_w) platings.push("W");
  if (row.plating_b) platings.push("B");
  return platings.join("+");
};

const resolveSignedImageUrl = async (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const params = new URLSearchParams({ path });
  const res = await fetch(`/api/master-image?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { signedUrl?: string };
  return json.signedUrl ?? null;
};

const LoadingOverlay = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-500">
    <div className="bg-card px-8 py-6 rounded-2xl shadow-2xl border border-border/50 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <div className="text-sm font-medium text-[var(--muted)]">Loading Order...</div>
    </div>
  </div>
);

// Color Checkbox Component
function ColorCheckbox({
  checked,
  onChange,
  label,
  color
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  color: "pink" | "gold" | "white" | "black" | "none";
}) {
  const colorStyles = {
    pink: {
      bg: "bg-rose-500",
      bgLight: "bg-rose-200",
      border: "border-rose-500",
      borderLight: "border-rose-300",
      text: "text-white",
    },
    gold: {
      bg: "bg-amber-500",
      bgLight: "bg-amber-200",
      border: "border-amber-500",
      borderLight: "border-amber-300",
      text: "text-white",
    },
    white: {
      bg: "bg-slate-400",
      bgLight: "bg-slate-200",
      border: "border-slate-400",
      borderLight: "border-slate-300",
      text: "text-white",
    },
    black: {
      bg: "bg-gray-800",
      bgLight: "bg-gray-300",
      border: "border-gray-700",
      borderLight: "border-gray-400",
      text: "text-white",
    },
    none: {
      bg: "bg-transparent",
      bgLight: "bg-transparent",
      border: "border-[var(--danger)]/60",
      borderLight: "border-[var(--danger)]/40",
      text: "text-[var(--danger)]",
    },
  };

  const style = colorStyles[color];
  const isNone = color === "none";

  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "w-6 h-6 rounded border text-xs font-bold transition-all duration-150 flex items-center justify-center shrink-0 leading-none",
        isNone
          ? `bg-transparent border-transparent ${style.text} hover:opacity-80`
          : checked
            ? `${style.bg} ${style.border} ${style.text} shadow-md scale-110 ring-2 ring-offset-1 ring-primary/30`
            : `${style.bgLight} ${style.borderLight} hover:opacity-70`
      )}
    >
      {/* 선택된 경우: 글씨 표시 / 선택안된 경우: 글씨 숨김(transparent) */}
      {checked || isNone ? label : null}
    </button>
  );
}

function OrdersPageContent() {
  const schemaClient = useMemo(() => getSchemaClient(), []);
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit_order_line_id");
  const editAll = searchParams.get("edit_all") === "1";
  const includeCancelled = searchParams.get("include_cancelled") === "1";
  const filterCustomer = searchParams.get("filter_customer") ?? "";
  const filterFactory = searchParams.get("filter_factory") ?? "";
  const filterModel = searchParams.get("filter_model") ?? "";
  const filterStatus = searchParams.get("filter_status") ?? "";
  const filterDate = searchParams.get("filter_date") ?? "";
  const [initLoading, setInitLoading] = useState(false);
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: EMPTY_ROWS }, (_, idx) => createEmptyRow(idx))
  );
  const [rowStatusMap, setRowStatusMap] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [headerClient, setHeaderClient] = useState<ClientSummary | null>(null);
  const [headerMode, setHeaderMode] = useState<"client" | "model" | null>("client");
  const [headerModelName, setHeaderModelName] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState("");
  const [activeMaster, setActiveMaster] = useState<MasterLookup | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<Record<string, ClientSummary[]>>({});
  const [modelSuggestions, setModelSuggestions] = useState<Record<string, MasterLookup[]>>({});
  const saveCache = useRef(new Map<string, string>());
  const saveInFlight = useRef(new Set<string>());
  const [pageIndex, setPageIndex] = useState(1);
  const loadToastRef = useRef<string | null>(null);

  const clientCache = useRef(new Map<string, ClientSummary>());
  const masterCache = useRef(new Map<string, MasterLookup>());
  const clientSuggestTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const modelSuggestTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clientSuggestQuery = useRef(new Map<string, string>());
  const modelSuggestQuery = useRef(new Map<string, string>());

  const stoneQuery = useQuery({
    queryKey: ["cms", "stone_catalog"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.stoneCatalog)
        .select("stone_id, stone_name")
        .order("stone_name");
      if (error) throw error;
      return (data ?? []) as StoneRow[];
    },
  });

  const stoneOptions = useMemo(() => {
    return (stoneQuery.data ?? [])
      .map((row) => row.stone_name ?? "")
      .filter(Boolean);
  }, [stoneQuery.data]);

  function buildPayload(row: GridRow): OrderUpsertPayload {
    const master = masterCache.current.get(row.model_input.toLowerCase());
    const colorStr = getColorString(row);
    const platingStr = getPlatingString(row);

    return {
      p_customer_party_id: row.client_id,
      p_master_id: row.master_item_id ?? master?.master_item_id ?? null,
      p_suffix: normalizeText(row.suffix) || master?.category_code || null,
      p_color: colorStr || null,
      p_material_code: row.material_code || master?.material_code_default || null,
      p_qty: toNumber(row.qty),
      p_size: normalizeTextOrNull(row.size) as string | null,
      p_is_plated: !!(platingStr),
      p_plating_variant_id: null,
      p_plating_color_code: platingStr || null,
      p_requested_due_date: receiptDate || null,
      p_priority_code: "NORMAL",
      p_source_channel: "web",
      p_memo: normalizeTextOrNull(row.memo),
      p_order_line_id: row.order_line_id ?? null,
      p_center_stone_name: normalizeTextOrNull(row.center_stone),
      p_center_stone_qty: toNumber(row.center_qty),
      p_sub1_stone_name: normalizeTextOrNull(row.sub1_stone),
      p_sub1_stone_qty: toNumber(row.sub1_qty),
      p_sub2_stone_name: normalizeTextOrNull(row.sub2_stone),
      p_sub2_stone_qty: toNumber(row.sub2_qty),
      p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
    };
  }

  // Load existing order if editId is present
  useEffect(() => {
    if (!editId || editAll || !schemaClient) return;

    const loadOrder = async () => {
      setInitLoading(true);
      try {
        const { data: orderRaw, error } = await schemaClient
          .from("cms_order_line")
          .select("*")
          .eq("order_line_id", editId)
          .single();

        const order = orderRaw as OrderDetailRow | null;

        if (error) throw error;
        if (!order) throw new Error("Order not found");

        if (order.status === "ORDER_ACCEPTED") {
          try {
            const normalized = await normalizeInvalidStatus(editId);
            if (normalized) {
              order.status = "ORDER_PENDING";
            }
          } catch (statusError) {
            console.error("Failed to normalize order status:", statusError);
          }
        }

        // Parse color string (e.g., "P+G", "P", "G+W")
        const colorStr = order.color || "";
        const color_p = colorStr.includes("P");
        const color_g = colorStr.includes("G");
        const color_w = colorStr.includes("W");
        const color_x = !color_p && !color_g && !color_w;

        // Parse plating string (e.g., "P+W+G")
        const platingStr = order.plating_color_code || "";
        const plating_p = platingStr.includes("P");
        const plating_g = platingStr.includes("G");
        const plating_w = platingStr.includes("W");
        const plating_b = platingStr.includes("B");

        // Fetch client info
        let client: ClientSummary | null = null;
        if (order?.customer_party_id) {
          const { data: clientRaw } = await schemaClient
            .from(CONTRACTS.views.arClientSummary)
            .select("*")
            .eq("client_id", order.customer_party_id)
            .single();
          client = (clientRaw ?? null) as ClientSummary | null;
        }

        if (client) {
          setHeaderClient(client);
          setHeaderMode("client");
          clientCache.current.set(client.client_name?.toLowerCase() ?? "", client);
        }

        // Fetch Master Info
        let masterInfo: MasterLookup | null = null;
        if (order.matched_master_id) {
          const { data: m } = await schemaClient
            .from(CONTRACTS.views.masterItemLookup)
            .select("*")
            .eq("master_item_id", order.matched_master_id)
            .single();
          masterInfo = m;
        } else if (order.model_name) {
          const { data: m } = await schemaClient
            .from(CONTRACTS.views.masterItemLookup)
            .select("*")
            .ilike("model_name", order.model_name)
            .limit(1)
            .maybeSingle();
          masterInfo = (m ?? null) as MasterLookup | null;
        }

        if (masterInfo) {
          const signedUrl = await resolveSignedImageUrl(masterInfo.photo_url ?? null);
          masterInfo = { ...masterInfo, photo_url: signedUrl };
          setActiveMaster(masterInfo);
          setHeaderMode("model");
          setHeaderModelName(masterInfo.model_name ?? "");
          if (masterInfo.model_name) {
            masterCache.current.set(masterInfo.model_name.toLowerCase(), masterInfo);
          }
        }

        const loadedRow: GridRow = {
          id: `loaded-${editId}`,
          order_line_id: order.order_line_id,
          client_input: client?.client_name ?? "Unknown",
          client_id: order.customer_party_id ?? null,
          client_name: client?.client_name ?? null,
          model_input: order.model_name_raw ?? order.model_name ?? "",
          model_name: order.model_name ?? null,
          suffix: order.suffix ?? "",
          color_p,
          color_g,
          color_w,
          color_x,
          material_code: order.material_code ?? masterInfo?.material_code_default ?? "",
          size: String(order.size ?? ""),
          qty: String(order.qty ?? ""),
          center_stone: order.center_stone_name ?? "",
          center_qty: String(order.center_stone_qty ?? ""),
          sub1_stone: order.sub1_stone_name ?? "",
          sub1_qty: String(order.sub1_stone_qty ?? ""),
          sub2_stone: order.sub2_stone_name ?? "",
          sub2_qty: String(order.sub2_stone_qty ?? ""),
          plating_p,
          plating_g,
          plating_w,
          plating_b,
          memo: order.memo ?? "",
          show_stones: !!(order.center_stone_name || order.sub1_stone_name || order.sub2_stone_name),
          master_item_id: order.matched_master_id ?? masterInfo?.master_item_id ?? null,
          photo_url: masterInfo?.photo_url ?? null,
          material_price: masterInfo?.material_price ?? null,
          labor_basic: masterInfo?.labor_basic ?? null,
          labor_center: masterInfo?.labor_center ?? null,
          labor_side1: masterInfo?.labor_side1 ?? null,
          labor_side2: masterInfo?.labor_side2 ?? null,
        };

        setRows([loadedRow]);
        setRowStatusMap({ [loadedRow.id]: order.status ?? "" });

        // Populate Cache
        saveCache.current.set(loadedRow.id, JSON.stringify(buildPayload(loadedRow)));

        if (loadToastRef.current !== editId) {
          toast.success("주문을 불러왔습니다.");
          loadToastRef.current = editId;
        }

      } catch (err) {
        if (loadToastRef.current !== editId) {
          toast.error("주문 로드 실패", { description: err instanceof Error ? err.message : String(err) });
          loadToastRef.current = editId;
        }
      } finally {
        setInitLoading(false);
      }
    };

    loadOrder();
  }, [editAll, editId, schemaClient]);

  // Load all orders for bulk edit
  useEffect(() => {
    if (!editAll || !schemaClient) return;

    const loadAllOrders = async () => {
      setInitLoading(true);
      try {
        const { data: orderRows, error } = await schemaClient
          .from("cms_order_line")
          .select(
            "order_line_id, customer_party_id, matched_master_id, model_name, model_name_raw, suffix, color, material_code, size, qty, center_stone_name, center_stone_qty, sub1_stone_name, sub1_stone_qty, sub2_stone_name, sub2_stone_qty, is_plated, plating_color_code, memo, created_at, status"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        let orders = (orderRows ?? []) as OrderDetailRow[];
        if (!includeCancelled) {
          orders = orders.filter((order) => order.status !== "CANCELLED");
        }
        if (filterCustomer) {
          orders = orders.filter((order) => order.customer_party_id === filterCustomer);
        }
        if (filterModel) {
          const targetValue = filterModel.toLowerCase();
          orders = orders.filter((order) => {
            const target = [order.model_name, order.suffix, order.color]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return target.includes(targetValue);
          });
        }
        if (filterStatus) {
          orders = orders.filter((order) => order.status === filterStatus);
        }
        if (filterDate) {
          orders = orders.filter((order) => {
            const created = order.created_at ? new Date(order.created_at) : null;
            if (!created) return false;
            const createdKey = created.toISOString().slice(0, 10);
            return createdKey === filterDate;
          });
        }

        if (filterFactory) {
          const { data: prefixRows, error: prefixError } = await schemaClient
            .from("cms_vendor_prefix_map")
            .select("prefix, vendor_party_id");
          if (prefixError) throw prefixError;

          const prefixes = (prefixRows ?? [])
            .filter((row) => row.prefix && row.vendor_party_id)
            .map((row) => ({
              prefix: String(row.prefix ?? ""),
              vendorPartyId: String(row.vendor_party_id ?? ""),
            }));

          orders = orders.filter((order) => {
            const model = (order.model_name ?? "").toLowerCase();
            let vendorPartyId = "";
            for (const row of prefixes) {
              const prefixLower = row.prefix.toLowerCase();
              if (model.startsWith(prefixLower)) {
                vendorPartyId = row.vendorPartyId;
                break;
              }
            }
            return vendorPartyId === filterFactory;
          });
        }

        const clientIds = Array.from(
          new Set(
            orders
              .map((order) => order.customer_party_id ?? null)
              .filter((value): value is string => Boolean(value))
          )
        );

        const clientMap = new Map<string, ClientSummary>();
        if (clientIds.length > 0) {
          const { data: clients, error: clientError } = await schemaClient
            .from(CONTRACTS.views.arClientSummary)
            .select("client_id, client_name, balance_krw, last_tx_at, open_invoices_count, credit_limit_krw, risk_flag")
            .in("client_id", clientIds);
          if (clientError) throw clientError;
          (clients ?? []).forEach((client) => {
            if (client.client_id) clientMap.set(client.client_id, client as ClientSummary);
          });
        }

        const mappedRows: GridRow[] = orders.map((order, index) => {
          const colorStr = order.color ?? "";
          const color_p = colorStr.includes("P");
          const color_g = colorStr.includes("G");
          const color_w = colorStr.includes("W");
          const color_x = !color_p && !color_g && !color_w;

          const platingStr = order.plating_color_code ?? "";
          const plating_p = platingStr.includes("P");
          const plating_g = platingStr.includes("G");
          const plating_w = platingStr.includes("W");
          const plating_b = platingStr.includes("B");

          const client = order.customer_party_id ? clientMap.get(order.customer_party_id) ?? null : null;

          return {
            id: `bulk-${order.order_line_id ?? index}`,
            order_line_id: order.order_line_id ?? null,
            client_input: client?.client_name ?? "",
            client_id: order.customer_party_id ?? null,
            client_name: client?.client_name ?? null,
            model_input: order.model_name_raw ?? order.model_name ?? "",
            model_name: order.model_name ?? null,
            suffix: order.suffix ?? "",
            color_p,
            color_g,
            color_w,
            color_x,
            material_code: order.material_code ?? "",
            size: String(order.size ?? ""),
            qty: String(order.qty ?? ""),
            center_stone: order.center_stone_name ?? "",
            center_qty: String(order.center_stone_qty ?? ""),
            sub1_stone: order.sub1_stone_name ?? "",
            sub1_qty: String(order.sub1_stone_qty ?? ""),
            sub2_stone: order.sub2_stone_name ?? "",
            sub2_qty: String(order.sub2_stone_qty ?? ""),
            plating_p,
            plating_g,
            plating_w,
            plating_b,
            memo: order.memo ?? "",
            show_stones: !!(order.center_stone_name || order.sub1_stone_name || order.sub2_stone_name),
            master_item_id: order.matched_master_id ?? null,
            photo_url: null,
            material_price: null,
            labor_basic: null,
            labor_center: null,
            labor_side1: null,
            labor_side2: null,
          };
        });

        setRows(mappedRows);
        const nextStatusMap: Record<string, string> = {};
        orders.forEach((order, index) => {
          const rowId = mappedRows[index]?.id;
          if (rowId) nextStatusMap[rowId] = order.status ?? "";
        });
        setRowStatusMap(nextStatusMap);
        setPageIndex(1);
        mappedRows.forEach((row) => {
          saveCache.current.set(row.id, JSON.stringify(buildPayload(row)));
        });
        setRowErrors({});
      } catch (error) {
        const message = error instanceof Error ? error.message : "전체 주문 로딩 실패";
        toast.error("전체 주문 로딩 실패", { description: message });
      } finally {
        setInitLoading(false);
      }
    };

    void loadAllOrders();
  }, [editAll, schemaClient, includeCancelled, filterCustomer, filterFactory, filterModel, filterStatus, filterDate]);

  const updateRow = (rowId: string, patch: Partial<GridRow>) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const toggleColor = (rowId: string, color: "color_p" | "color_g" | "color_w") => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, { [color]: !row[color], color_x: false });
  };

  const toggleNoColor = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const next = !row.color_x;
    updateRow(rowId, {
      color_x: next,
      color_p: next ? false : row.color_p,
      color_g: next ? false : row.color_g,
      color_w: next ? false : row.color_w,
    });
  };

  const togglePlating = (rowId: string, plating: "plating_p" | "plating_g" | "plating_w" | "plating_b") => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, { [plating]: !row[plating] });
  };

  const toggleStones = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, { show_stones: !row.show_stones });
  };

  const setRowError = (rowId: string, patch: RowErrors) => {
    setRowErrors((prev) => ({ ...prev, [rowId]: { ...prev[rowId], ...patch } }));
  };

  async function normalizeInvalidStatus(orderLineId: string) {
    try {
      const setStatusFn = CONTRACTS.functions.orderSetStatus;
      if (!setStatusFn) return false;
      await callRpc(setStatusFn, {
        p_order_line_id: orderLineId,
        p_to_status: "ORDER_PENDING",
        p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
      });
      return true;
    } catch (err) {
      console.error("Failed to normalize status:", err);
      return false;
    }
  }

  const formatRpcError = (error: unknown) => {
    const e = error as
      | { message?: string; error_description?: string; details?: string; hint?: string }
      | string
      | null;
    const message =
      (typeof e === "string" ? e : e?.message) ??
      (typeof e === "string" ? undefined : e?.error_description) ??
      "잠시 후 다시 시도해 주세요";
    const details = typeof e === "string" ? "" : e?.details ?? "";
    const hint = typeof e === "string" ? "" : e?.hint ?? "";
    return [message, details, hint].filter(Boolean).join(" | ");
  };

  const clearRowError = (rowId: string, key: keyof RowErrors) => {
    setRowErrors((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: undefined } }));
  };

  const requestClientSuggestions = useCallback((rowId: string, inputValue: string) => {
    if (!schemaClient) return;
    const normalizedInput = normalizeSearchText(inputValue);
    if (!normalizedInput) {
      setClientSuggestions((prev) => ({ ...prev, [rowId]: [] }));
      return;
    }

    const existing = clientSuggestTimers.current.get(rowId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        clientSuggestQuery.current.set(rowId, normalizedInput);
        const { data, error } = await schemaClient
          .from(CONTRACTS.views.arClientSummary)
          .select("client_id, client_name, balance_krw, last_tx_at, open_invoices_count, credit_limit_krw, risk_flag")
          .ilike("client_name", `%${normalizedInput}%`)
          .limit(50);

        if (error) throw error;

        const ranked = rankMatches((data ?? []) as ClientSummary[], normalizedInput, (client) => client.client_name ?? "");
        if (clientSuggestQuery.current.get(rowId) !== normalizedInput) return;
        setClientSuggestions((prev) => ({ ...prev, [rowId]: ranked.slice(0, 30) }));
      } catch (err) {
        console.error("Client suggestion error:", err);
      }
    }, 150);

    clientSuggestTimers.current.set(rowId, timer);
  }, [schemaClient]);

  const requestModelSuggestions = useCallback((rowId: string, inputValue: string) => {
    if (!schemaClient) return;
    const normalizedInput = normalizeSearchText(inputValue);
    if (!normalizedInput) {
      setModelSuggestions((prev) => ({ ...prev, [rowId]: [] }));
      return;
    }

    const existing = modelSuggestTimers.current.get(rowId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        modelSuggestQuery.current.set(rowId, normalizedInput);
        const { data, error } = await schemaClient
          .from(CONTRACTS.views.masterItemLookup)
          .select("master_item_id, model_name")
          .ilike("model_name", `%${normalizedInput}%`)
          .limit(50);

        if (error) throw error;

        const ranked = rankMatches((data ?? []) as MasterLookup[], normalizedInput, (master) => master.model_name ?? "");
        if (modelSuggestQuery.current.get(rowId) !== normalizedInput) return;
        setModelSuggestions((prev) => ({ ...prev, [rowId]: ranked.slice(0, 30) }));
      } catch (err) {
        console.error("Model suggestion error:", err);
      }
    }, 150);

    modelSuggestTimers.current.set(rowId, timer);
  }, [schemaClient]);

  const handleDeleteRow = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row && row.order_line_id) {
      const reason = window.prompt("주문 취소 사유를 입력하세요.");
      if (!reason || reason.trim() === "") {
        toast.error("취소 사유를 입력해야 합니다.");
        return;
      }
      if (!confirm("정말 이 주문을 취소하시겠습니까? (삭제가 아닌 취소 상태로 변경됩니다)")) return;

      try {
        if (!schemaClient) throw new Error("No client");
        const setStatusFn = CONTRACTS.functions.orderSetStatus;
        if (!setStatusFn) throw new Error("setStatusFn not configured");

        await callRpc(setStatusFn, {
          p_order_line_id: row.order_line_id,
          p_to_status: "CANCELLED",
          p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
          p_reason: reason.trim(),
        });
        toast.success("주문이 취소되었습니다.");
      } catch (e) {
        toast.error("주문 취소 실패", { description: formatRpcError(e) });
        return;
      }
    }

    setRows((prev) => prev.map((row, idx) => (row.id === rowId ? createEmptyRow(idx) : row)));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const resolveClient = async (rowId: string, inputValue: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || !schemaClient) return;

    const normalizedInput = normalizeSearchText(inputValue);
    if (!normalizedInput) {
      updateRow(rowId, { client_id: null, client_name: null });
      return;
    }

    const cached = clientCache.current.get(normalizedInput);
    if (cached) {
      updateRow(rowId, { client_id: cached.client_id, client_name: cached.client_name });
      if (headerMode === "client") setHeaderClient(cached);
      clearRowError(rowId, "client");
      return;
    }

    try {
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arClientSummary)
        .select("client_id, client_name, balance_krw, last_tx_at, open_invoices_count, credit_limit_krw, risk_flag")
        .ilike("client_name", `%${normalizedInput}%`)
        .limit(50);

      if (error) throw error;

      const ranked = rankMatches((data ?? []) as ClientSummary[], normalizedInput, (client) => client.client_name ?? "");
      const client = ranked[0];
      if (client) {
        updateRow(rowId, { client_id: client.client_id, client_name: client.client_name });
        clientCache.current.set(normalizedInput, client);
        clientCache.current.set((client.client_name ?? "").toLowerCase(), client);
        if (headerMode === "client") setHeaderClient(client);
        clearRowError(rowId, "client");
      } else {
        setRowError(rowId, { client: "등록되지 않은 거래처입니다" });
      }
    } catch (err) {
      console.error("Client resolution error:", err);
    }
  };

  const resolveMaster = async (rowId: string, inputValue: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || !schemaClient) return;

    const normalizedInput = normalizeSearchText(inputValue);
    if (!normalizedInput) {
      updateRow(rowId, { master_item_id: null, model_name: null, suffix: "", material_code: "", photo_url: null });
      return;
    }

    const cached = masterCache.current.get(normalizedInput);
    if (cached) {
      const signedUrl = await resolveSignedImageUrl(cached.photo_url ?? null);
      updateRow(rowId, {
        master_item_id: cached.master_item_id ?? null,
        model_name: cached.model_name ?? null,
        suffix: row.suffix || cached.category_code || "",
        material_code: row.material_code || cached.material_code_default || "",
        photo_url: signedUrl,
        material_price: cached.material_price ?? null,
        labor_basic: cached.labor_basic ?? null,
        labor_center: cached.labor_center ?? null,
        labor_side1: cached.labor_side1 ?? null,
        labor_side2: cached.labor_side2 ?? null,
      });
      setActiveMaster({ ...cached, photo_url: signedUrl });
      setHeaderModelName(cached.model_name ?? "");
      clearRowError(rowId, "model");
      return;
    }

    try {
      setImageLoading(true);
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.masterItemLookup)
        .select("*")
        .ilike("model_name", `%${normalizedInput}%`)
        .limit(50);

      if (error) throw error;

      const ranked = rankMatches((data ?? []) as MasterLookup[], normalizedInput, (master) => master.model_name ?? "");
      const master = ranked[0];
      if (master) {
        const signedUrl = await resolveSignedImageUrl(master.photo_url ?? null);
        updateRow(rowId, {
          master_item_id: master.master_item_id ?? null,
          model_name: master.model_name ?? null,
          suffix: row.suffix || master.category_code || "",
          material_code: row.material_code || master.material_code_default || "",
          photo_url: signedUrl,
          material_price: master.material_price ?? null,
          labor_basic: master.labor_basic ?? null,
          labor_center: master.labor_center ?? null,
          labor_side1: master.labor_side1 ?? null,
          labor_side2: master.labor_side2 ?? null,
        });
        masterCache.current.set(normalizedInput, master);
        masterCache.current.set((master.model_name ?? "").toLowerCase(), master);
        setActiveMaster({ ...master, photo_url: signedUrl });
        setHeaderModelName(master.model_name ?? "");
        clearRowError(rowId, "model");
      } else {
        setRowError(rowId, { model: "등록되지 않은 모델입니다" });
      }
    } catch (err) {
      console.error("Master resolution error:", err);
    } finally {
      setImageLoading(false);
    }
  };

  const rowHasData = (row: GridRow) => {
    return (
      row.client_input.trim() ||
      row.model_input.trim() ||
      row.color_p || row.color_g || row.color_w || row.color_x ||
      row.material_code ||
      row.size ||
      row.qty !== "1" ||
      row.plating_p || row.plating_g || row.plating_w || row.plating_b ||
      row.center_stone || row.sub1_stone || row.sub2_stone ||
      row.memo
    );
  };

  const validateRow = (row: GridRow): boolean => {
    let isValid = true;
    if (!row.client_id && row.client_input.trim()) {
      setRowError(row.id, { client: "등록되지 않은 거래처입니다" });
      isValid = false;
    }
    if (!row.master_item_id && row.model_input.trim()) {
      setRowError(row.id, { model: "등록되지 않은 모델입니다" });
      isValid = false;
    }
    if (row.model_input.trim() && !(row.color_p || row.color_g || row.color_w || row.color_x)) {
      setRowError(row.id, { color: "색상을 선택하세요" });
      isValid = false;
    }
    if (row.model_input.trim() && !row.material_code) {
      setRowError(row.id, { material: "소재를 선택하세요" });
      isValid = false;
    }
    if (row.model_input.trim() && !toNumber(row.qty)) {
      setRowError(row.id, { qty: "수량을 입력하세요" });
      isValid = false;
    }
    return isValid;
  };

  const saveRow = async (row: GridRow) => {
    if (!schemaClient) return;
    const status = rowStatusMap[row.id];
    if (status && !EDITABLE_STATUSES.has(status)) {
      toast.error("수정 불가", { description: "ORDER_PENDING 상태만 수정 가능합니다. 먼저 주문 취소 후 진행하세요." });
      return;
    }
    if (!rowHasData(row)) return;

    const errors = rowErrors[row.id];
    if (errors && Object.keys(errors).some((k) => errors[k as keyof RowErrors])) return;

    if (!validateRow(row)) return;

    const payload = buildPayload(row);
    const cacheKey = JSON.stringify(payload);
    if (saveCache.current.get(row.id) === cacheKey) return;

    if (saveInFlight.current.has(row.id)) return;
    saveInFlight.current.add(row.id);

    try {
      const savedId = await callRpc<string>(CONTRACTS.functions.orderUpsertV3, payload);
      if (savedId) {
        saveCache.current.set(row.id, cacheKey);
        updateRow(row.id, { order_line_id: String(savedId) });
        setRowErrors((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        toast.success("저장 완료");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 실패";
      if (message.includes("ORDER_ACCEPTED") && row.order_line_id) {
        const normalized = await normalizeInvalidStatus(row.order_line_id);
        if (normalized) {
          try {
            const savedId = await callRpc<string>(CONTRACTS.functions.orderUpsertV3, payload);
            if (savedId) {
              saveCache.current.set(row.id, cacheKey);
              updateRow(row.id, { order_line_id: String(savedId) });
              setRowErrors((prev) => {
                const next = { ...prev };
                delete next[row.id];
                return next;
              });
              toast.success("저장 완료");
              return;
            }
          } catch (retryError) {
            const retryMessage = retryError instanceof Error ? retryError.message : "저장 실패";
            toast.error("저장 실패", { description: retryMessage });
          }
        } else {
          toast.error("저장 실패", { description: message });
        }
      } else {
        toast.error("저장 실패", { description: message });
      }
    } finally {
      saveInFlight.current.delete(row.id);
    }
  };

  return (
    <>
      {initLoading && <LoadingOverlay />}

      {/* Sticky Status Bar */}
      <div className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-2 flex items-center justify-between transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-bold tracking-tight text-foreground">
              {editAll ? "전체 수정" : editId ? "주문 수정" : "주문 등록"}
            </h1>
          </div>
          <div className="h-6 w-px bg-border/50 mx-1" />
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className={cn("w-2 h-2 rounded-full", saveInFlight.current.size > 0 ? "bg-[var(--warning)] animate-pulse" : "bg-[var(--success)]")} />
            {saveInFlight.current.size > 0 ? "Saving..." : "Ready"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/orders_main">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
              닫기
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-2 py-2 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 pb-20">

        {/* Left Column: Compact Order Grid */}
        <div className="space-y-1 min-w-0 order-2">
          {/* Header Row */}
          <div className="grid grid-cols-[30px_160px_220px_80px_90px_70px_55px_130px_30px_0.75fr_40px] gap-1 px-1 py-[0.13rem] text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider border-b border-border/40 items-center">
            <span className="text-center">#</span>
            <span>거래처</span>
            <span>모델</span>
            <span className="text-center">소재</span>
            <span className="text-center">색상</span>
            <span className="text-center">사이즈</span>
            <span className="text-center">수량</span>
            <span className="text-center">도금</span>
            <span className="text-center">💎</span>
            <span>비고</span>
            <span></span>
          </div>

          {/* Data Rows */}
          {rows.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE).map((row, idx) => {
            const errors = rowErrors[row.id] ?? {};
            const realIdx = (pageIndex - 1) * PAGE_SIZE + idx + 1;
            const hasStones = row.center_stone || row.sub1_stone || row.sub2_stone;

            return (
              <div key={row.id} className="space-y-0.5">
                {/* Main Row */}
                <div
                  className={cn(
                    "grid grid-cols-[30px_160px_220px_80px_90px_70px_55px_130px_30px_0.75fr_40px] gap-1 px-1 py-2 items-center text-xs rounded-md border transition-all",
                    row.order_line_id ? "bg-primary/5 border-primary/20" : "bg-card border-border/50 hover:border-border",
                    (errors.client || errors.model) ? "bg-[var(--danger)]/5 border-[var(--danger)]/30" : ""
                  )}
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (next && event.currentTarget.contains(next)) return;
                    const current = rows.find((item) => item.id === row.id);
                    if (current) void saveRow(current);
                  }}
                >
                  {/* Row Number */}
                  <span className="text-[9px] font-mono text-[var(--muted)] text-center">{realIdx}</span>

                  {/* Client Input */}
                  <input
                    className={cn(
                      "w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1 py-0 text-sm transition-colors",
                      errors.client ? "border-[var(--danger)]/50 bg-[var(--danger)]/5" : "hover:border-border/50"
                    )}
                    list={`client-suggest-${row.id}`}
                    value={row.client_input}
                    onChange={(e) => {
                      const next = e.target.value;
                      updateRow(row.id, { client_input: next });
                      requestClientSuggestions(row.id, next);
                    }}
                    onBlur={(e) => resolveClient(row.id, e.currentTarget.value)}
                    placeholder="거래처..."
                  />
                  <datalist id={`client-suggest-${row.id}`}>
                    {(clientSuggestions[row.id] ?? []).map((client) => (
                      <option key={client.client_id ?? client.client_name ?? ""} value={client.client_name ?? ""} />
                    ))}
                  </datalist>

                  {/* Model Input */}
                  <input
                    className={cn(
                      "w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1 py-0.5 text-sm font-medium transition-colors",
                      errors.model ? "border-[var(--danger)]/50 bg-[var(--danger)]/5" : "hover:border-border/50"
                    )}
                    list={`model-suggest-${row.id}`}
                    value={row.model_input}
                    onChange={(e) => {
                      const next = e.target.value;
                      updateRow(row.id, { model_input: next });
                      requestModelSuggestions(row.id, next);
                    }}
                    onBlur={(e) => resolveMaster(row.id, e.currentTarget.value)}
                    placeholder="모델..."
                  />
                  <datalist id={`model-suggest-${row.id}`}>
                    {(modelSuggestions[row.id] ?? []).map((master) => (
                      <option key={master.master_item_id ?? master.model_name ?? ""} value={master.model_name ?? ""} />
                    ))}
                  </datalist>

                  {/* Material Select */}
                  <select
                    className={cn(
                      "w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1 py-0.5 text-sm text-center transition-colors mr-1",
                      errors.material ? "border-[var(--danger)]/50 bg-[var(--danger)]/5" : "hover:border-border/50"
                    )}
                    value={row.material_code}
                    onChange={(e) => updateRow(row.id, { material_code: e.target.value })}
                    aria-label="소재"
                    title="소재"
                  >
                    <option value="">소재</option>
                    {MATERIAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {/* Color Checkboxes (P, G, W) */}
                  <div className="flex items-center justify-center gap-0.5 px-0.5 ml-1">
                    <ColorCheckbox
                      checked={row.color_p}
                      onChange={() => toggleColor(row.id, "color_p")}
                      label="P"
                      color="pink"
                    />
                    <ColorCheckbox
                      checked={row.color_g}
                      onChange={() => toggleColor(row.id, "color_g")}
                      label="G"
                      color="gold"
                    />
                    <ColorCheckbox
                      checked={row.color_w}
                      onChange={() => toggleColor(row.id, "color_w")}
                      label="W"
                      color="white"
                    />
                    <ColorCheckbox
                      checked={row.color_x}
                      onChange={() => toggleNoColor(row.id)}
                      label="X"
                      color="none"
                    />
                  </div>

                  {/* Size Input */}
                  <input
                    className="w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1.5 py-0.5 text-sm text-center hover:border-border/50 transition-colors"
                    value={row.size}
                    onChange={(e) => updateRow(row.id, { size: e.target.value })}
                    placeholder="Size"
                  />

                  {/* Qty Input */}
                  <input
                    type="number"
                    className={cn(
                      "w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-1.5 py-0.5 text-sm text-center tabular-nums transition-colors",
                      errors.qty ? "border-[var(--danger)]/50" : "hover:border-border/50"
                    )}
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                    min="1"
                  />

                  {/* Plating Checkboxes (P, G, W, B) */}
                  <div className="flex items-center justify-center gap-0.5 px-0.5">
                    <ColorCheckbox
                      checked={row.plating_p}
                      onChange={() => togglePlating(row.id, "plating_p")}
                      label="P"
                      color="pink"
                    />
                    <ColorCheckbox
                      checked={row.plating_g}
                      onChange={() => togglePlating(row.id, "plating_g")}
                      label="G"
                      color="gold"
                    />
                    <ColorCheckbox
                      checked={row.plating_w}
                      onChange={() => togglePlating(row.id, "plating_w")}
                      label="W"
                      color="white"
                    />
                    <ColorCheckbox
                      checked={row.plating_b}
                      onChange={() => togglePlating(row.id, "plating_b")}
                      label="B"
                      color="black"
                    />
                  </div>

                  {/* Stone Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleStones(row.id)}
                    className={cn(
                      "w-5 h-5 rounded flex items-center justify-center text-xs transition-colors",
                      row.show_stones || hasStones
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : "bg-muted/50 text-[var(--muted)] border border-border hover:border-primary/50"
                    )}
                  >
                    {row.show_stones ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {/* Memo Input (Large) */}
                  <input
                    className="w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded px-2 py-0.5 text-sm hover:border-border/50 transition-colors"
                    value={row.memo}
                    onChange={(e) => updateRow(row.id, { memo: e.target.value })}
                    placeholder="비고 입력..."
                  />

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="w-5 h-5 ml-auto flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>

                {/* Expanded Stone Row */}
                {row.show_stones && (
                  <div
                    className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 px-1 py-2 bg-muted/30 rounded-md border border-border/30 items-center text-xs"
                    onBlur={(event) => {
                      const next = event.relatedTarget as Node | null;
                      if (next && event.currentTarget.contains(next)) return;
                      const current = rows.find((item) => item.id === row.id);
                      if (current) void saveRow(current);
                    }}
                  >
                    <span></span>

                    {/* Center Stone */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--muted)]">중심석</span>
                      <input
                        list={`stone-options-${row.id}`}
                        className="flex-1 bg-background border border-border/60 rounded px-1 py-0.5 text-xs focus:border-primary/50"
                        value={row.center_stone}
                        onChange={(e) => updateRow(row.id, { center_stone: e.target.value })}
                      />
                    </div>

                    {/* Sub1 Stone */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--muted)]">보조1</span>
                      <input
                        list={`stone-options-${row.id}`}
                        className="flex-1 bg-background border border-border/60 rounded px-1 py-0.5 text-xs focus:border-primary/50"
                        value={row.sub1_stone}
                        onChange={(e) => updateRow(row.id, { sub1_stone: e.target.value })}
                      />
                    </div>

                    {/* Sub2 Stone */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--muted)]">보조2</span>
                      <input
                        list={`stone-options-${row.id}`}
                        className="flex-1 bg-background border border-border/60 rounded px-1 py-0.5 text-xs focus:border-primary/50"
                        value={row.sub2_stone}
                        onChange={(e) => updateRow(row.id, { sub2_stone: e.target.value })}
                      />
                    </div>
                    {(() => {
                      const master = masterCache.current.get(row.model_input.toLowerCase());
                      const masterNames = [
                        master?.center_stone_name_default,
                        master?.sub1_stone_name_default,
                        master?.sub2_stone_name_default,
                      ].filter((value): value is string => Boolean(value));
                      const combined = Array.from(new Set([...masterNames, ...stoneOptions])).filter(Boolean);
                      return (
                        <datalist id={`stone-options-${row.id}`}>
                          {combined.map((stone) => (
                            <option key={stone} value={stone} />
                          ))}
                        </datalist>
                      );
                    })()}
                    <span></span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setPageIndex(p => Math.max(1, p - 1))} disabled={pageIndex === 1}>이전</Button>
            <span className="text-xs text-[var(--muted)]">{pageIndex} / {Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}</span>
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => {
              const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
              if (editAll && pageIndex >= pageCount) return;
              if (!editAll && pageIndex >= pageCount) {
                setRows(prev => [...prev, ...Array.from({ length: PAGE_SIZE }, (_, i) => createEmptyRow(prev.length + i))]);
              }
              setPageIndex(p => p + 1);
            }}>다음</Button>
          </div>
        </div>

        {/* Right Column: Match / Preview */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-20 h-fit order-1">
          <Card className="border border-border/50 shadow-sm rounded-lg overflow-hidden">
            <CardHeader className="py-2 px-3 bg-muted/5 border-b border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Customer</span>
                {headerClient?.client_id ? (
                  <Badge className="bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30 text-[10px]">MATCHED</Badge>
                ) : (
                  <Badge className="bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30 text-[10px]">UNMATCHED</Badge>
                )}
              </div>
            </CardHeader>
            <CardBody className="p-3 space-y-2">
              <div className="text-sm font-semibold text-foreground truncate">{headerClient?.client_name || "-"}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[var(--muted)]">미수금</span>
                  <div className="font-semibold text-foreground tabular-nums text-xs">
                    {headerClient?.balance_krw !== undefined ? `${headerClient.balance_krw?.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[var(--muted)]">미수 건수</span>
                  <div className="font-semibold text-foreground text-xs">
                    {headerClient?.open_invoices_count ?? "-"}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border border-border/50 shadow-sm rounded-lg overflow-hidden">
            <CardHeader className="py-2 px-3 bg-muted/5 border-b border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Master</span>
                {activeMaster?.master_item_id ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">MATCHED</Badge>
                ) : (
                  <Badge className="bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30 text-[10px]">UNMATCHED</Badge>
                )}
              </div>
            </CardHeader>
            <CardBody className="p-3 space-y-2">
              <div className="aspect-square relative overflow-hidden rounded-md border border-border/40 bg-muted/10">
                {activeMaster?.photo_url ? (
                  <>
                    {imageLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[var(--muted)] animate-pulse">
                        로딩중...
                      </div>
                    ) : null}
                    <img
                      src={activeMaster.photo_url}
                      alt={activeMaster.model_name ?? "model"}
                      className="w-full h-full object-cover"
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--muted-weak)]">
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <span className="text-[9px]">No Image</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">모델</span>
                  <span className="font-semibold truncate max-w-[120px]">{activeMaster?.model_name ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">카테고리</span>
                  <span className="text-[10px]">{getCategoryName(activeMaster?.category_code)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[var(--muted)] text-[10px]">기본중량</span>
                  <div className="font-semibold tabular-nums text-xs">{activeMaster?.weight_default_g?.toFixed(2) ?? "-"}g</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[var(--muted)] text-[10px]">차감중량</span>
                  <div className="font-semibold tabular-nums text-xs">{activeMaster?.deduction_weight_default_g?.toFixed(2) ?? "-"}g</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <OrdersPageContent />
    </Suspense>
  );
}
