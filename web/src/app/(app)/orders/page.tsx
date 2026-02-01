"use client";

import { Suspense, useMemo, useRef, useState, useEffect } from "react";
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

type PlatingColorRow = {
  color_code?: string;
};

type OrderDetailRow = {
  order_line_id?: string;
  customer_party_id?: string | null;
  matched_master_id?: string | null;
  model_name?: string | null;
  model_name_raw?: string | null;
  suffix?: string | null;
  color?: string | null;
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
};

type OrderUpsertPayload = {
  p_customer_party_id: string | null;
  p_master_id: string | null;
  p_suffix: string | null;
  p_color: string | null;
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
  color: string;
  size: string;
  qty: string;
  center_stone: string;
  center_qty: string;
  sub1_stone: string;
  sub1_qty: string;
  sub2_stone: string;
  sub2_qty: string;
  is_plated: boolean;
  plating_color: string;
  memo: string;
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
  qty?: string;
  plating?: string;
  stones?: string;
};

const PAGE_SIZE = 10;
const INITIAL_PAGES = 2;
const EMPTY_ROWS = PAGE_SIZE * INITIAL_PAGES;

const createRowId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
// 1. 메인 색상 옵션
const MAIN_COLOR_OPTIONS = [
  { value: "P", label: "P (핑크)" },
  { value: "G", label: "G (골드)" },
  { value: "W", label: "W (화이트)" },
  { value: "Z", label: "Z (기타)" },
];

// 2. 도금 색상 옵션 (단색 + 콤비 조합 제안)
// 순서는 P, G, W, B 순으로 단색을 먼저 보여주고, 그 뒤에 조합을 보여줍니다.
const PLATING_OPTIONS = [
  { type: "단색", value: "P", label: "P (핑크)" },
  { type: "단색", value: "G", label: "G (골드)" },
  { type: "단색", value: "W", label: "W (화이트)" },
  { type: "단색", value: "B", label: "B (블랙)" },
  // 콤비 조합 (많이 쓰이는 순서 고려 혹은 색상 코드 알파벳 순)
  { type: "콤비", value: "P+W", label: "P+W (핑크/화이트)" },
  { type: "콤비", value: "G+W", label: "G+W (골드/화이트)" },
  { type: "콤비", value: "P+G", label: "P+G (핑크/골드)" },
  { type: "콤비", value: "P+B", label: "P+B (핑크/블랙)" },
  { type: "콤비", value: "G+B", label: "G+B (골드/블랙)" },
  { type: "콤비", value: "W+B", label: "W+B (화이트/블랙)" },
  { type: "콤비", value: "P+W+G", label: "P+W+G (핑크/화이트/골드)" },
  { type: "콤비", value: "P+W+B", label: "P+W+B (핑크/화이트/블랙)" },
  { type: "콤비", value: "G+W+B", label: "G+W+B (골드/화이트/블랙)" },
  { type: "콤비", value: "P+W+B+G", label: "P+W+B+G (핑크/화이트/블랙/골드)" },
];

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

// 변환 헬퍼 함수 (대소문자 무관하게 처리)
const getCategoryName = (code: string | null | undefined) => {
  if (!code) return "-";
  const upper = code.trim().toUpperCase();
  return CATEGORY_MAP[upper] ?? code; // 매핑에 없으면 원래 영어 코드 그대로 표시
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
  color: "",
  size: "",
  qty: "1",
  center_stone: "",
  center_qty: "",
  sub1_stone: "",
  sub1_qty: "",
  sub2_stone: "",
  sub2_qty: "",
  is_plated: false,
  plating_color: "",
  memo: "",
  master_item_id: null,
  photo_url: null,
  material_price: null,
  labor_basic: null,
  labor_center: null,
  labor_side1: null,
  labor_side2: null,
});

const normalizeText = (value: string) => value.trim();
const toNumber = (value: string) => {
  const v = value.trim();
  if (v === "") return null;        // 핵심
  const parsed = Number(v);
  if (Number.isNaN(parsed)) return null;
  return parsed;
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
      <div className="text-sm font-medium text-muted-foreground">Loading Order...</div>
    </div>
  </div>
);

function OrdersPageContent() {
  const schemaClient = useMemo(() => getSchemaClient(), []);
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit_order_line_id");
  const [initLoading, setInitLoading] = useState(false);
  // const orderUpsertFn = CONTRACTS.functions.orderUpsertV2; // Removed in favor of V3
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: EMPTY_ROWS }, (_, idx) => createEmptyRow(idx))
  );
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [headerClient, setHeaderClient] = useState<ClientSummary | null>(null);
  const [headerMode, setHeaderMode] = useState<"client" | "model" | null>("client");
  const [headerModelName, setHeaderModelName] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState("");
  const [activeMaster, setActiveMaster] = useState<MasterLookup | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const saveCache = useRef(new Map<string, string>());
  const saveInFlight = useRef(new Set<string>());
  const [pageIndex, setPageIndex] = useState(1);

  const clientCache = useRef(new Map<string, ClientSummary>());
  const masterCache = useRef(new Map<string, MasterLookup>());

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

  const platingColorQuery = useQuery({
    queryKey: ["cms", "plating_color"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.platingColor)
        .select("color_code")
        .order("color_code");
      if (error) throw error;
      return (data ?? []) as PlatingColorRow[];
    },
  });

  const stoneOptions = useMemo(() => {
    return (stoneQuery.data ?? [])
      .map((row) => row.stone_name ?? "")
      .filter(Boolean);
  }, [stoneQuery.data]);

  // Load existing order if editId is present
  useEffect(() => {
    if (!editId || !schemaClient) return;

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
          // Strict ID lookup
          const { data: m } = await schemaClient
            .from(CONTRACTS.views.masterItemLookup)
            .select("*")
            .eq("master_item_id", order.matched_master_id)
            .single();
          masterInfo = m;
        } else if (order.model_name) {
          // Fallback loose lookup (for legacy orders)
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
          color: order.color ?? "",
          size: String(order.size ?? ""),
          qty: String(order.qty ?? ""),
          center_stone: order.center_stone_name ?? "",
          center_qty: String(order.center_stone_qty ?? ""),
          sub1_stone: order.sub1_stone_name ?? "",
          sub1_qty: String(order.sub1_stone_qty ?? ""),
          sub2_stone: order.sub2_stone_name ?? "",
          sub2_qty: String(order.sub2_stone_qty ?? ""),
          is_plated: order.is_plated ?? false,
          plating_color: order.plating_color_code ?? "",
          memo: order.memo ?? "",
          master_item_id: order.matched_master_id ?? masterInfo?.master_item_id ?? null,
          photo_url: masterInfo?.photo_url ?? null,
          material_price: masterInfo?.material_price ?? null,
          labor_basic: masterInfo?.labor_basic ?? null,
          labor_center: masterInfo?.labor_center ?? null,
          labor_side1: masterInfo?.labor_side1 ?? null,
          labor_side2: masterInfo?.labor_side2 ?? null,
        };

        setRows([loadedRow]);

        // Populate Cache to prevent immediate auto-save triggers on load
        saveCache.current.set(loadedRow.id, JSON.stringify({
          client_id: loadedRow.client_id,
          model_input: normalizeText(loadedRow.model_input),
          suffix: normalizeText(loadedRow.suffix),
          color: normalizeText(loadedRow.color),
          size: normalizeText(loadedRow.size),
          qty: toNumber(loadedRow.qty),
          center_stone: normalizeText(loadedRow.center_stone),
          center_qty: toNumber(loadedRow.center_qty),
          sub1_stone: normalizeText(loadedRow.sub1_stone),
          sub1_qty: toNumber(loadedRow.sub1_qty),
          sub2_stone: normalizeText(loadedRow.sub2_stone),
          sub2_qty: toNumber(loadedRow.sub2_qty),
          is_plated: loadedRow.is_plated,
          plating_color: normalizeText(loadedRow.plating_color),
          memo: normalizeText(loadedRow.memo),
        }));

        toast.success("주문을 불러왔습니다.");

      } catch (err) {
        toast.error("주문 로드 실패", { description: err instanceof Error ? err.message : String(err) });
      } finally {
        setInitLoading(false);
      }
    };

    loadOrder();
  }, [editId, schemaClient]);

  const updateRow = (rowId: string, patch: Partial<GridRow>) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const setRowError = (rowId: string, patch: RowErrors) => {
    setRowErrors((prev) => ({ ...prev, [rowId]: { ...prev[rowId], ...patch } }));
  };

  const clearRowError = (rowId: string, key: keyof RowErrors) => {
    setRowErrors((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: undefined } }));
  };

  const handleDeleteRow = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row && row.order_line_id) {
      if (!confirm("정말 이 주문을 취소하시겠습니까? (삭제가 아닌 취소 상태로 변경됩니다)")) return;

      try {
        if (!schemaClient) throw new Error("No client");
        const setStatusFn = CONTRACTS.functions.orderSetStatus;
        if (!setStatusFn) throw new Error("setStatusFn not configured");

        await callRpc(setStatusFn, {
          p_order_line_id: row.order_line_id,
          p_status: "CANCELLED",
          p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null
        });
        toast.success("주문이 취소되었습니다.");
      } catch (e) {
        toast.error("주문 취소 실패", { description: e instanceof Error ? e.message : String(e) });
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

  const applyHeaderClient = (rowId: string, client: ClientSummary | null) => {
    setHeaderClient(client);
    setHeaderMode("client");
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
            ...row,
            client_input: client?.client_name ?? row.client_input,
            client_id: client?.client_id ?? null,
            client_name: client?.client_name ?? null,
          }
          : row
      )
    );
  };

  const resolveClient = async (rowId: string, rawInput: string) => {
    if (!schemaClient) {
      toast.error("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const input = normalizeText(rawInput);
    if (!input) {
      setRowError(rowId, { client: "거래처를 입력해 주세요." });
      applyHeaderClient(rowId, null);
      return;
    }

    const cacheKey = input.toLowerCase();
    if (clientCache.current.has(cacheKey)) {
      const cached = clientCache.current.get(cacheKey) ?? null;
      applyHeaderClient(rowId, cached);
      clearRowError(rowId, "client");
      return;
    }

    const { data, error } = await schemaClient
      .from(CONTRACTS.views.arClientSummary)
      .select("*")
      .ilike("client_name", `%${input}%`)
      .limit(5);
    if (error) {
      toast.error("거래처 조회 실패", { description: error.message });
      return;
    }
    const matches = (data ?? []) as ClientSummary[];
    const exact = matches.find(
      (item) => (item.client_name ?? "").toLowerCase() === input.toLowerCase()
    );
    const resolved = exact ?? (matches.length === 1 ? matches[0] : null);
    if (!resolved?.client_id) {
      setRowError(rowId, { client: "거래처를 찾을 수 없습니다." });
      applyHeaderClient(rowId, null);
      return;
    }
    clientCache.current.set(cacheKey, resolved);
    applyHeaderClient(rowId, resolved);
    clearRowError(rowId, "client");
  };

  const resolveMaster = async (rowId: string, rawInput: string) => {
    if (!schemaClient) {
      toast.error("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const input = normalizeText(rawInput);
    if (!input) {
      setRowError(rowId, { model: "모델명을 입력해 주세요." });
      updateRow(rowId, {
        model_name: null,
        master_item_id: null,
        photo_url: null,
        material_price: null,
        labor_basic: null,
        labor_center: null,
        labor_side1: null,
        labor_side2: null,
      });
      setActiveMaster(null);
      return;
    }

    setHeaderMode("model");
    setHeaderModelName(input);

    if (row.model_name && row.model_name.toLowerCase() === input.toLowerCase() && row.master_item_id) {
      clearRowError(rowId, "model");
      return;
    }

    const cacheKey = input.toLowerCase();
    if (masterCache.current.has(cacheKey)) {
      const cached = masterCache.current.get(cacheKey) ?? null;
      if (cached?.master_item_id) {
        updateRow(rowId, {
          model_name: cached.model_name ?? input,
          master_item_id: cached.master_item_id ?? null,
          photo_url: cached.photo_url ?? null,
          material_price: cached.material_price ?? null,
          labor_basic: cached.labor_basic ?? null,
          labor_center: cached.labor_center ?? null,
          labor_side1: cached.labor_side1 ?? null,
          labor_side2: cached.labor_side2 ?? null,
        });
        setActiveMaster(cached);
        setImageLoading(Boolean(cached.photo_url));
        clearRowError(rowId, "model");
        return;
      }
    }

    const { data, error } = await schemaClient
      .from(CONTRACTS.views.masterItemLookup)
      .select("*")
      .ilike("model_name", `%${input}%`)
      .limit(5);
    if (error) {
      toast.error("마스터 조회 실패", { description: error.message });
      return;
    }
    const matches = (data ?? []) as MasterLookup[];
    const exact = matches.find(
      (item) => (item.model_name ?? "").toLowerCase() === input.toLowerCase()
    );
    const resolved = exact ?? (matches.length === 1 ? matches[0] : null);
    if (!resolved?.master_item_id) {
      setRowError(rowId, { model: "모델을 찾을 수 없습니다." });
      updateRow(rowId, {
        model_name: null,
        master_item_id: null,
        photo_url: null,
        material_price: null,
        labor_basic: null,
        labor_center: null,
        labor_side1: null,
        labor_side2: null,
      });
      setActiveMaster(null);
      return;
    }
    const signedUrl = await resolveSignedImageUrl(resolved.photo_url ?? null);
    const resolvedWithUrl = {
      ...resolved,
      photo_url: signedUrl,
    };
    masterCache.current.set(cacheKey, resolvedWithUrl);
    updateRow(rowId, {
      model_name: resolvedWithUrl.model_name ?? input,
      master_item_id: resolvedWithUrl.master_item_id ?? null,
      // [추가됨] 마스터의 카테고리 코드를 suffix에 강제 주입
      suffix: resolvedWithUrl.category_code ?? "",

      photo_url: resolvedWithUrl.photo_url ?? null,
      material_price: resolvedWithUrl.material_price ?? null,
      labor_basic: resolvedWithUrl.labor_basic ?? null,
      labor_center: resolvedWithUrl.labor_center ?? null,
      labor_side1: resolvedWithUrl.labor_side1 ?? null,
      labor_side2: resolvedWithUrl.labor_side2 ?? null,
    });
    setActiveMaster(resolvedWithUrl);
    setImageLoading(Boolean(resolvedWithUrl.photo_url));
    clearRowError(rowId, "model");
  };

  const validateRow = (row: GridRow): RowErrors => {
    const errors: RowErrors = {};
    const qty = toNumber(row.qty);
    if (!normalizeText(row.client_input) || !row.client_id) {
      errors.client = "거래처를 확인해 주세요.";
    }
    if (!normalizeText(row.model_input)) {
      errors.model = "모델명을 입력해 주세요.";
    }
    if (!normalizeText(row.suffix)) {
      errors.category = "분류를 입력해 주세요.";
    }
    if (!normalizeText(row.color)) {
      errors.color = "색상을 입력해 주세요.";
    }
    if (!qty || qty <= 0) {
      errors.qty = "수량은 1 이상입니다.";
    }

    if (row.is_plated && !row.plating_color) {
      errors.plating = "도금색상은 필수입니다.";
    }

    const centerQty = toNumber(row.center_qty) ?? 0;
    const sub1Qty = toNumber(row.sub1_qty) ?? 0;
    const sub2Qty = toNumber(row.sub2_qty) ?? 0;
    const stoneIssues =
      (row.center_stone && centerQty <= 0) ||
      (!row.center_stone && centerQty > 0) ||
      (row.sub1_stone && sub1Qty <= 0) ||
      (!row.sub1_stone && sub1Qty > 0) ||
      (row.sub2_stone && sub2Qty <= 0) ||
      (!row.sub2_stone && sub2Qty > 0);
    if (stoneIssues) {
      errors.stones = "스톤/개수 입력을 확인해 주세요.";
    }
    return errors;
  };
  async function callOrderUpsertV3(payload: OrderUpsertPayload) {
    const res = await fetch("/api/order-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      data?: unknown;
    };

    if (!res.ok) {
      const msg =
        json?.error ||
        json?.message ||
        "저장 실패 (order-upsert)";
      const detail = json?.details || json?.hint || json?.code || "";
      throw new Error(detail ? `${msg} (${detail})` : msg);
    }

    // RPC가 scalar(uuid/text)면 json.data가 바로 그 값일 가능성이 큼
    return json?.data;
  }

  const rowSnapshot = (row: GridRow) =>
    JSON.stringify({
      client_id: row.client_id,
      model_input: normalizeText(row.model_input),
      suffix: normalizeText(row.suffix),
      color: normalizeText(row.color),
      size: normalizeText(row.size),
      qty: toNumber(row.qty),
      center_stone: normalizeText(row.center_stone),
      center_qty: toNumber(row.center_qty),
      sub1_stone: normalizeText(row.sub1_stone),
      sub1_qty: toNumber(row.sub1_qty),
      sub2_stone: normalizeText(row.sub2_stone),
      sub2_qty: toNumber(row.sub2_qty),
      is_plated: row.is_plated,
      plating_color: normalizeText(row.plating_color),
      memo: normalizeText(row.memo),
    });

  const saveRow = async (row: GridRow) => {
    // Strict Validation: Master Item is required
    if (!row.master_item_id && normalizeText(row.model_input)) {
      // If user typed something but didn't select from dropdown, it's an error.
      // We do strictly enforce selection.
      setRowError(row.id, { model: "모델을 목록에서 선택해야 합니다." });
      return;
    }

    // Pass V3 function
    const upsertFn = CONTRACTS.functions.orderUpsertV3;
    if (!upsertFn) return;

    const snapshot = rowSnapshot(row);
    const cached = saveCache.current.get(row.id);
    if (cached === snapshot) return;
    if (saveInFlight.current.has(row.id)) return;

    const errors = validateRow(row);
    if (Object.keys(errors).length > 0) {
      setRowErrors((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...errors } }));
      return;
    }

    if (!row.master_item_id) {
      // Should be caught above or in validateRow, but double check
      return;
    }

    saveInFlight.current.add(row.id);
    try {
      const savedId = await callOrderUpsertV3({
        p_customer_party_id: row.client_id,
        p_master_id: row.master_item_id, // STRICT

        // ✅ NOT NULL 컬럼 보장용: 화면 입력값을 RPC로 전달
        p_suffix: normalizeText(row.suffix) || null,
        p_color: normalizeText(row.color) || null,

        p_qty: toNumber(row.qty) ?? 1,
        p_size: normalizeText(row.size) || null,
        p_is_plated: row.is_plated,
        p_plating_variant_id: null,
        p_plating_color_code: normalizeText(row.plating_color) || null,
        p_requested_due_date: receiptDate || null,
        p_priority_code: null,
        p_source_channel: null,
        p_memo: normalizeText(row.memo) || null,
        p_order_line_id: row.order_line_id ?? null,
        p_center_stone_name: normalizeText(row.center_stone) || null,
        p_center_stone_qty: toNumber(row.center_qty),
        p_sub1_stone_name: normalizeText(row.sub1_stone) || null,
        p_sub1_stone_qty: toNumber(row.sub1_qty),
        p_sub2_stone_name: normalizeText(row.sub2_stone) || null,
        p_sub2_stone_qty: toNumber(row.sub2_qty),
        p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID || null,
      });

      saveCache.current.set(row.id, snapshot);
      if (savedId) {
        updateRow(row.id, { order_line_id: String(savedId) });
        // Clear errors if successful
        setRowErrors((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        toast.success("저장 완료");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 실패";
      // Handle strict P0001 error specifically if needed, but toast is fine
      toast.error("저장 실패", { description: message });
    } finally {
      saveInFlight.current.delete(row.id);
    }
  };

  return (
    <>
      {initLoading && <LoadingOverlay />}
      
      {/* Sticky Status Bar */}
      <div className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/40 px-6 py-3 flex items-center justify-between transition-all duration-200">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {editId ? "주문 수정" : "주문 등록"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {editId ? `Order #${editId}` : "New Order Entry"}
            </p>
          </div>
          <div className="h-8 w-px bg-border/50 mx-2" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
             <span className={cn("w-2 h-2 rounded-full", saveInFlight.current.size > 0 ? "bg-yellow-500 animate-pulse" : "bg-emerald-500")} />
             {saveInFlight.current.size > 0 ? "Saving..." : "Ready"}
          </div>
        </div>
        <div className="flex items-center gap-3">
            <Link href="/orders_main">
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                닫기
              </Button>
            </Link>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 pb-32">
        
        {/* Left Column: Form Sections */}
        <div className="space-y-6 min-w-0">
          {rows.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE).map((row, idx) => {
             const errors = rowErrors[row.id] ?? {};
             const realIdx = (pageIndex - 1) * PAGE_SIZE + idx + 1;
             
             return (
               <Card key={row.id} className="border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group"
                     onBlur={(event) => {
                        const next = event.relatedTarget as Node | null;
                        if (next && event.currentTarget.contains(next)) return;
                        const current = rows.find((item) => item.id === row.id);
                        if (current) void saveRow(current);
                     }}>
                 <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b border-border/40 bg-muted/5">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-background font-mono">#{realIdx}</Badge>
                      {row.order_line_id && <Badge variant="secondary" className="text-[10px]">Saved</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteRow(row.id)}>
                      <span className="sr-only">Delete</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </Button>
                 </CardHeader>
                 
                 <CardBody className="p-5 space-y-8">
                    {/* Section 1: Customer */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground">Customer</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">거래처 이름을 입력하면 자동으로 매칭됩니다.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          거래처 <span className="text-red-500">*</span>
                        </label>
                        <input
                          className={cn(
                            "w-full bg-muted/10 border border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-md px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/30",
                            errors.client ? "bg-red-50 border-red-200 ring-red-200" : ""
                          )}
                          value={row.client_input}
                          onChange={(e) => updateRow(row.id, { client_input: e.target.value })}
                          onBlur={(e) => resolveClient(row.id, e.currentTarget.value)}
                          placeholder="거래처 검색..."
                        />
                        {errors.client && <p className="text-[10px] text-red-500 font-medium">{errors.client}</p>}
                      </div>
                    </div>

                    {/* Section 2: Model */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground">Model</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">모델명을 입력하면 마스터 정보와 연결됩니다.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            모델번호 <span className="text-red-500">*</span>
                          </label>
                          <input
                            className={cn(
                              "w-full bg-muted/10 border border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-md px-3 py-2 text-sm font-medium transition-all placeholder:text-muted-foreground/30",
                              errors.model ? "bg-red-50 border-red-200 ring-red-200" : ""
                            )}
                            value={row.model_input}
                            onChange={(e) => updateRow(row.id, { model_input: e.target.value })}
                            onBlur={(e) => resolveMaster(row.id, e.currentTarget.value)}
                            placeholder="모델명 검색..."
                          />
                          {errors.model && <p className="text-[10px] text-red-500 font-medium">{errors.model}</p>}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">분류</label>
                          <div className="w-full px-3 py-2 text-sm bg-muted/20 border border-border/40 rounded-md text-muted-foreground select-none">
                            {getCategoryName(row.suffix) || "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Options */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground">Options</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">색상/도금/사이즈/수량을 지정합니다.</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">색상</label>
                          <select
                            className={cn("w-full bg-background border border-border/60 rounded-md px-2 py-2 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors", errors.color && "border-red-200")}
                            value={row.color}
                            onChange={(e) => updateRow(row.id, { color: e.target.value })}
                          >
                            <option value="">선택</option>
                            {MAIN_COLOR_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">사이즈</label>
                          <input
                            className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                            value={row.size}
                            onChange={(e) => updateRow(row.id, { size: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">수량</label>
                          <input
                            type="number"
                            className={cn("w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm text-center tabular-nums focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors", errors.qty && "border-red-200")}
                            value={row.qty}
                            onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-muted-foreground">도금</label>
                            <input
                              type="checkbox"
                              checked={row.is_plated}
                              onChange={(e) =>
                                updateRow(row.id, {
                                  is_plated: e.target.checked,
                                  plating_color: e.target.checked ? row.plating_color : "",
                                })
                              }
                              className="w-3 h-3 rounded border-border text-primary focus:ring-primary/20"
                            />
                          </div>
                          <select
                            className={cn(
                              "w-full bg-background border border-border/60 rounded-md px-2 py-2 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors",
                              !row.is_plated && "opacity-50 cursor-not-allowed",
                              errors.plating && "border-red-200"
                            )}
                            value={row.plating_color}
                            onChange={(e) => updateRow(row.id, { plating_color: e.target.value })}
                            disabled={!row.is_plated}
                          >
                            <option value="">선택</option>
                            <optgroup label="단색">
                              {PLATING_OPTIONS.filter((opt) => opt.type === "단색").map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="콤비">
                              {PLATING_OPTIONS.filter((opt) => opt.type === "콤비").map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Stones */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground">Stones</span>
                          {errors.stones && <span className="text-[10px] text-red-500 font-medium">{errors.stones}</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">센터/보조 스톤과 개수를 입력합니다.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-muted/5 border border-border/30 space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">중심석</span>
                          <div className="grid grid-cols-[1fr_60px] gap-2">
                            <select
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.center_stone}
                              onChange={(e) => updateRow(row.id, { center_stone: e.target.value })}
                            >
                              <option value="">선택</option>
                              {stoneOptions.map((stone) => (
                                <option key={stone} value={stone}>
                                  {stone}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 text-center tabular-nums focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.center_qty}
                              onChange={(e) => updateRow(row.id, { center_qty: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/5 border border-border/30 space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">보조1석</span>
                          <div className="grid grid-cols-[1fr_60px] gap-2">
                            <select
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.sub1_stone}
                              onChange={(e) => updateRow(row.id, { sub1_stone: e.target.value })}
                            >
                              <option value="">선택</option>
                              {stoneOptions.map((stone) => (
                                <option key={stone} value={stone}>
                                  {stone}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 text-center tabular-nums focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.sub1_qty}
                              onChange={(e) => updateRow(row.id, { sub1_qty: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/5 border border-border/30 space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">보조2석</span>
                          <div className="grid grid-cols-[1fr_60px] gap-2">
                            <select
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.sub2_stone}
                              onChange={(e) => updateRow(row.id, { sub2_stone: e.target.value })}
                            >
                              <option value="">선택</option>
                              {stoneOptions.map((stone) => (
                                <option key={stone} value={stone}>
                                  {stone}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="w-full bg-background border border-border/60 rounded-md text-xs py-1.5 px-2 text-center tabular-nums focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                              value={row.sub2_qty}
                              onChange={(e) => updateRow(row.id, { sub2_qty: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Memo / Due / Priority */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground">Memo / Due / Priority</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">메모와 납기일을 기록하고 우선순위를 확인합니다.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">비고</label>
                          <input
                            className="w-full bg-muted/10 border border-border/60 rounded-md px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/30 focus:bg-background focus:ring-2 focus:ring-primary/10"
                            value={row.memo}
                            onChange={(e) => updateRow(row.id, { memo: e.target.value })}
                            placeholder="특이사항 입력..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">납기일</label>
                          <Input
                            type="date"
                            className="h-9 text-sm bg-background border-border/60 focus:border-primary/50 focus:ring-primary/20"
                            value={receiptDate}
                            onChange={(event) => setReceiptDate(event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">우선순위</label>
                          <select
                            className="w-full bg-muted/10 border border-border/60 rounded-md px-2 py-2 text-sm text-muted-foreground cursor-not-allowed"
                            defaultValue="STANDARD"
                            disabled
                          >
                            <option value="STANDARD">Standard</option>
                          </select>
                        </div>
                      </div>
                    </div>
                 </CardBody>
               </Card>
             );
          })}
          
          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
             <Button variant="outline" size="sm" onClick={() => setPageIndex(p => Math.max(1, p - 1))} disabled={pageIndex === 1}>이전</Button>
             <span className="text-xs text-muted-foreground">{pageIndex} / {Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}</span>
             <Button variant="outline" size="sm" onClick={() => {
                const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
                if (pageIndex >= pageCount) {
                   setRows(prev => [...prev, ...Array.from({ length: PAGE_SIZE }, (_, i) => createEmptyRow(prev.length + i))]);
                }
                setPageIndex(p => p + 1);
             }}>다음</Button>
          </div>
        </div>

        {/* Right Column: Match / Preview */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 h-fit">
          <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="py-4 px-5 bg-muted/5 border-b border-border/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Customer Match</span>
                {headerClient?.client_id ? (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">MATCHED</Badge>
                ) : (
                  <Badge className="bg-red-50 text-red-700 border-red-200">UNMATCHED</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">거래처 입력 결과 요약입니다.</p>
            </CardHeader>
            <CardBody className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{headerClient?.client_name || "-"}</div>
                <span className="text-xs text-muted-foreground">{headerClient?.client_id ? "확정" : "미확정"}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground">미수금</span>
                  <div className="font-semibold text-foreground tabular-nums">
                    {headerClient?.balance_krw !== undefined ? `${headerClient.balance_krw?.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">마지막 거래일</span>
                  <div className="font-semibold text-foreground">
                    {headerClient?.last_tx_at ? headerClient.last_tx_at.slice(0, 10) : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">미수 건수</span>
                  <div className="font-semibold text-foreground">
                    {headerClient?.open_invoices_count ?? "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">리스크</span>
                  <div className="font-semibold text-foreground">{headerClient?.risk_flag ?? "-"}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="py-4 px-5 bg-muted/5 border-b border-border/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Master Match</span>
                {activeMaster?.master_item_id ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">MATCHED</Badge>
                ) : (
                  <Badge className="bg-red-50 text-red-700 border-red-200">UNMATCHED</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">모델 매칭과 마스터 정보를 확인합니다.</p>
            </CardHeader>
            <CardBody className="p-5 space-y-5">
              <div className="aspect-[4/3] relative overflow-hidden rounded-lg border border-border/40 bg-muted/10">
                {activeMaster?.photo_url ? (
                  <>
                    {imageLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-muted-foreground animate-pulse">
                        이미지 로딩 중...
                      </div>
                    ) : null}
                    <img
                      src={activeMaster.photo_url}
                      alt={activeMaster.model_name ?? "model"}
                      className="w-full h-full object-cover transition-transform duration-700"
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <span className="text-xs">No Image</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">모델명</span>
                <div className="text-sm font-semibold text-foreground">
                  {(activeMaster?.model_name ?? headerModelName) || "-"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground">공급처</span>
                  <div className="font-semibold text-foreground">{activeMaster?.vendor_name ?? "-"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">카테고리</span>
                  <div className="font-semibold text-foreground">{getCategoryName(activeMaster?.category_code)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">기본중량</span>
                  <div className="font-semibold text-foreground tabular-nums">{activeMaster?.weight_default_g ?? "-"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">차감중량</span>
                  <div className="font-semibold text-foreground tabular-nums">{activeMaster?.deduction_weight_default_g ?? "-"}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground">소재가격</span>
                  <div className="font-semibold text-foreground tabular-nums">
                    {activeMaster?.material_price ? `${activeMaster.material_price.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">기본공임</span>
                  <div className="font-semibold text-foreground tabular-nums">
                    {activeMaster?.labor_basic?.toLocaleString() ?? "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">센터공임</span>
                  <div className="font-semibold text-foreground tabular-nums">
                    {activeMaster?.labor_center?.toLocaleString() ?? "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">보조공임</span>
                  <div className="font-semibold text-foreground tabular-nums">
                    {(activeMaster?.labor_side1 || 0) + (activeMaster?.labor_side2 || 0) > 0
                      ? ((activeMaster?.labor_side1 || 0) + (activeMaster?.labor_side2 || 0)).toLocaleString()
                      : "-"}
                  </div>
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
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  );
}
