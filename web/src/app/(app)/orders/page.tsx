"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
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

export default function OrdersPage() {
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

  const platingColors = useMemo(() => {
    return (platingColorQuery.data ?? [])
      .map((row) => row.color_code ?? "")
      .filter(Boolean);
  }, [platingColorQuery.data]);

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

        const order = orderRaw as any;

        if (error) throw error;
        if (!order) throw new Error("Order not found");

        // Fetch client info
        const { data: clientRaw } = await schemaClient
          .from(CONTRACTS.views.arClientSummary)
          .select("*")
          .eq("client_id", (order as any).customer_party_id)
          .single();

        const client = clientRaw as unknown as ClientSummary;

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
          masterInfo = m as MasterLookup;
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
          client_id: (order as any).customer_party_id,
          client_name: client?.client_name ?? null,
          model_input: order.model_name_raw ?? order.model_name ?? "",
          model_name: order.model_name,
          suffix: order.suffix,
          color: order.color,
          size: String(order.size ?? ""),
          qty: String(order.qty),
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
  async function callOrderUpsertV3(payload: any) {
    const res = await fetch("/api/order-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({} as any));

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
      <div className="flex flex-col gap-8 font-[family-name:var(--font-manrope)] text-foreground pb-32 max-w-[1800px] mx-auto px-6 pt-6">
        {/* Header Section */}
        <div className="flex items-end justify-between border-b border-border/40 pb-6">
          <div className="space-y-2">
            <nav className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60">
              <span>Home</span>
              <span className="text-muted-foreground/30">/</span>
              <span>Sales</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-foreground">Order Registration</span>
            </nav>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">주문 등록 (Order Registration)</h1>
              <p className="text-sm text-muted-foreground">주문 1건을 빠르게 등록하거나 편집합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/orders_main">
              <Button variant="outline" className="h-10 px-4 rounded-full border-border/60 hover:bg-muted/50 hover:text-foreground transition-all">
                <span className="mr-2 text-xs">✕</span> 닫기
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          <Card className="h-full min-h-[300px] flex flex-col items-center justify-center border border-border/50 bg-muted/5 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden group relative">
            {activeMaster?.photo_url ? (
              <div className="relative w-full h-full bg-white">
                {imageLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-muted-foreground animate-pulse">
                    이미지 로딩 중...
                  </div>
                ) : null}
                <img
                  src={activeMaster.photo_url}
                  alt={activeMaster.model_name ?? "model"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-xl pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-muted-foreground/40 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span className="text-sm font-medium">모델 이미지를 표시합니다</span>
              </div>
            )}
          </Card>

          <Card className="shadow-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-border/40 bg-muted/5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
                  </svg>
                </div>
                <span className="font-bold text-sm text-foreground">기본 정보</span>
              </div>
              <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                거래처는 1개 고정
              </span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {headerMode === "model" ? "모델명" : "거래처"}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground tracking-tight">
                    {headerMode === "model"
                      ? headerModelName || "-"
                      : headerClient?.client_name ?? "-"}
                  </span>
                  {headerMode === "client" && headerClient?.client_id ? (
                    <Badge className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 rounded-md px-2.5 py-0.5 shadow-sm">
                      확정
                    </Badge>
                  ) : null}
                  {headerMode === "model" && activeMaster?.master_item_id ? (
                    <Badge className="whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-md px-2.5 py-0.5 shadow-sm">
                      매칭
                    </Badge>
                  ) : headerMode === "model" ? (
                    <Badge className="whitespace-nowrap bg-red-50 text-red-700 border-red-200 hover:bg-red-100 rounded-md px-2.5 py-0.5 shadow-sm">
                      UNMATCHED
                    </Badge>
                  ) : null}
                </div>
                {headerMode === "client" ? (
                  headerClient?.balance_krw !== undefined ? (
                    <p className="text-sm text-muted-foreground font-medium">
                      미수금 <span className="text-foreground font-bold tabular-nums">{headerClient.balance_krw?.toLocaleString() ?? 0}</span>원
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">거래처를 입력하면 미수 정보가 표시됩니다.</p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">모델명을 입력하면 마스터 정보가 연결됩니다.</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {headerMode === "model" ? "매칭 상태" : "마지막 거래일"}
                </label>
                <div className="text-base font-medium text-foreground">
                  {headerMode === "model"
                    ? activeMaster?.master_item_id
                      ? "MATCHED"
                      : "UNMATCHED"
                    : headerClient?.last_tx_at
                      ? headerClient.last_tx_at.slice(0, 10)
                      : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {headerMode === "client" && headerClient?.open_invoices_count !== null && headerClient?.open_invoices_count !== undefined
                    ? `미수 건수 ${headerClient.open_invoices_count}`
                    : ""}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">접수일</label>
                <Input
                  type="date"
                  className="bg-background border-border/60 focus:border-primary/50 focus:ring-primary/20 h-9"
                  value={receiptDate}
                  onChange={(event) => setReceiptDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">리스크</label>
                <div className="text-base font-medium text-foreground">{headerClient?.risk_flag ?? "-"}</div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="shadow-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300">
          <CardHeader className="flex items-center justify-between py-4 px-6 border-b border-border/40 bg-muted/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="font-bold text-sm text-foreground">가격 패널</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">모델 선택 시 자동 갱신</span>
          </CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-5 gap-6 p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">소재가격</p>
              <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">
                {activeMaster?.material_price ? `${activeMaster.material_price.toLocaleString()}원` : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">기본공임</p>
              <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">{activeMaster?.labor_basic?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">중심공임</p>
              <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">{activeMaster?.labor_center?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조1공임</p>
              <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">{activeMaster?.labor_side1?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조2공임</p>
              <p className="text-lg font-bold text-foreground tabular-nums tracking-tight">{activeMaster?.labor_side2?.toLocaleString() ?? "-"}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300">
          <CardHeader className="flex items-center justify-between py-4 px-6 border-b border-border/40 bg-muted/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span className="font-bold text-sm text-foreground">모델 기본정보</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">마스터 기준</span>
          </CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6 p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">공급처</p>
              <p className="text-sm font-semibold text-foreground">{activeMaster?.vendor_name ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">기본재질</p>
              <p className="text-sm font-semibold text-foreground">{activeMaster?.material_code_default ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">카테고리</p>
              <p className="text-sm font-semibold text-foreground">
                {getCategoryName(activeMaster?.category_code)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">기본중량</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.weight_default_g ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">차감중량</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.deduction_weight_default_g ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">기본공임</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.labor_basic?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">센터공임</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.labor_center?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조1공임</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.labor_side1?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조2공임</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.labor_side2?.toLocaleString() ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">센터스톤수</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.center_qty_default ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조1스톤수</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.sub1_qty_default ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">보조2스톤수</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{activeMaster?.sub2_qty_default ?? "-"}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/5">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="2" />
                  <path d="M9 14h6" />
                  <path d="M9 18h6" />
                  <path d="M9 10h6" />
                </svg>
              </div>
              <span className="font-bold text-sm text-foreground">Order Items</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs bg-muted/50 px-2 py-1 rounded-md">자동 저장은 blur 시 수행됩니다.</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-background">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/30 text-muted-foreground font-medium border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-3 border-r border-border/40 w-10 text-center font-medium">No</th>
                  <th className="px-3 py-3 border-r border-border/40 w-10 text-center font-medium">취소</th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[140px] font-medium">
                    <span className="text-red-500 mr-1">*</span>거래처
                  </th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[140px] font-medium">
                    <span className="text-red-500 mr-1">*</span>모델번호
                  </th>
                  <th className="px-3 py-3 border-r border-border/40 w-24 font-medium">분류</th>
                  <th className="px-3 py-3 border-r border-border/40 w-24 font-medium">색상</th>
                  <th className="px-3 py-3 border-r border-border/40 w-20 font-medium">사이즈</th>
                  <th className="px-3 py-3 border-r border-border/40 w-16 text-center font-medium">수량</th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[90px] whitespace-nowrap font-medium">중심석</th>
                  <th className="px-3 py-3 border-r border-border/40 w-16 text-center whitespace-nowrap font-medium">중심개수</th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[90px] whitespace-nowrap font-medium">보조1석</th>
                  <th className="px-3 py-3 border-r border-border/40 w-16 text-center whitespace-nowrap font-medium">보조1개수</th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[90px] whitespace-nowrap font-medium">보조2석</th>
                  <th className="px-3 py-3 border-r border-border/40 w-16 text-center whitespace-nowrap font-medium">보조2개수</th>
                  <th className="px-3 py-3 border-r border-border/40 w-16 text-center font-medium">도금</th>
                  <th className="px-3 py-3 border-r border-border/40 min-w-[40px] font-medium">도금색상</th>
                  <th className="px-3 py-3 min-w-[300px] font-medium">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE).map((row, idx) => {
                  const errors = rowErrors[row.id] ?? {};
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors group"
                      onBlur={(event) => {
                        const next = event.relatedTarget as Node | null;
                        if (next && event.currentTarget.contains(next)) return;
                        const current = rows.find((item) => item.id === row.id);
                        if (current) {
                          void saveRow(current);
                        }
                      }}
                    >
                      <td className="px-3 py-2 text-center text-muted-foreground border-r border-border/40 bg-muted/5 group-hover:bg-muted/20 transition-colors">
                        {(pageIndex - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-border/40">
                        <button
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                        >
                          ✕
                        </button>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-xs transition-colors placeholder:text-muted-foreground/30",
                            errors.client ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.client_input}
                          onChange={(event) => updateRow(row.id, { client_input: event.target.value })}
                          onBlur={(event) => resolveClient(row.id, event.currentTarget.value)}
                          placeholder="거래처 입력"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-xs font-semibold transition-colors placeholder:text-muted-foreground/30",
                            errors.model ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.model_input}
                          onChange={(event) => updateRow(row.id, { model_input: event.target.value })}
                          onBlur={(event) => resolveMaster(row.id, event.currentTarget.value)}
                          placeholder="모델명 입력"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40 bg-muted/5">
                        <div className="w-full px-2 py-1.5 text-xs text-muted-foreground select-none cursor-not-allowed">
                          {getCategoryName(row.suffix)}
                        </div>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            errors.color ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.color}
                          onChange={(event) => updateRow(row.id, { color: event.target.value })}
                        >
                          <option value="">선택</option>
                          {MAIN_COLOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          className="w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-xs transition-colors"
                          value={row.size}
                          onChange={(event) => updateRow(row.id, { size: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-center font-mono text-xs tabular-nums transition-colors",
                            errors.qty ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.qty}
                          onChange={(event) => updateRow(row.id, { qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.center_stone}
                          onChange={(event) => updateRow(row.id, { center_stone: event.target.value })}
                        >
                          <option value="">선택</option>
                          {stoneOptions.map((stone) => (
                            <option key={stone} value={stone}>
                              {stone}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-center text-xs tabular-nums transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.center_qty}
                          onChange={(event) => updateRow(row.id, { center_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.sub1_stone}
                          onChange={(event) => updateRow(row.id, { sub1_stone: event.target.value })}
                        >
                          <option value="">선택</option>
                          {stoneOptions.map((stone) => (
                            <option key={stone} value={stone}>
                              {stone}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-center text-xs tabular-nums transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.sub1_qty}
                          onChange={(event) => updateRow(row.id, { sub1_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.sub2_stone}
                          onChange={(event) => updateRow(row.id, { sub2_stone: event.target.value })}
                        >
                          <option value="">선택</option>
                          {stoneOptions.map((stone) => (
                            <option key={stone} value={stone}>
                              {stone}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-center text-xs tabular-nums transition-colors",
                            errors.stones ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.sub2_qty}
                          onChange={(event) => updateRow(row.id, { sub2_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40 text-center">
                        <input
                          type="checkbox"
                          checked={row.is_plated}
                          onChange={(event) =>
                            updateRow(row.id, {
                              is_plated: event.target.checked,
                              plating_color: event.target.checked ? row.plating_color : "",
                            })
                          }
                          className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-border/40">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-1.5 cursor-pointer hover:bg-muted/50 rounded transition-colors",
                            errors.plating ? "bg-red-50 ring-1 ring-inset ring-red-200" : ""
                          )}
                          value={row.plating_color}
                          onChange={(event) => updateRow(row.id, { plating_color: event.target.value })}
                          disabled={!row.is_plated}
                        >
                          <option value="">선택</option>

                          {/* 단색 그룹 */}
                          <optgroup label="단색">
                            {PLATING_OPTIONS.filter(o => o.type === "단색").map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>

                          {/* 콤비 그룹 */}
                          <optgroup label="콤비">
                            {PLATING_OPTIONS.filter(o => o.type === "콤비").map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full bg-transparent border-none focus:ring-0 focus:bg-primary/5 rounded px-2 py-1.5 text-xs transition-colors"
                          value={row.memo}
                          onChange={(event) => updateRow(row.id, { memo: event.target.value })}
                          placeholder="비고 입력"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/5">
            <span className="font-medium">라인 {rows.length}개</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-border/60 hover:bg-muted/50"
                onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
                disabled={pageIndex === 1}
              >
                이전
              </Button>
              <span className="text-xs font-medium px-2">
                {pageIndex} / {Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-border/60 hover:bg-muted/50"
                onClick={() => {
                  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
                  if (pageIndex >= pageCount) {
                    setRows((prev) => [
                      ...prev,
                      ...Array.from({ length: PAGE_SIZE }, (_, idx) => createEmptyRow(prev.length + idx)),
                    ]);
                  }
                  setPageIndex((prev) => prev + 1);
                }}
              >
                다음
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
