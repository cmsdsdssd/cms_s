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
  qty: "",
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
    <div className="bg-white px-6 py-4 rounded-lg shadow-xl font-bold flex flex-col items-center gap-2">
      <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
      <div>Loading Order...</div>
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
        p_size: null,
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
      <div className="flex flex-col gap-6 font-[family-name:var(--font-manrope)] text-[var(--foreground)] pb-20">
        <div className="flex items-center justify-between">
          <div>
            <nav className="text-xs text-[var(--muted)] mb-1">Home / Sales / Order Registration</nav>
            <h1 className="text-2xl font-bold tracking-tight">주문 등록 (Order Registration)</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/orders_main">
              <Button variant="secondary" className="bg-white border-[var(--panel-border)] text-[var(--foreground)]">
                ✕ 닫기
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <Card className="h-full min-h-[200px] flex flex-col items-center justify-center border-dashed border-2 border-[var(--panel-border)] bg-[var(--input-bg)] shadow-none">
            {activeMaster?.photo_url ? (
              <div className="relative w-full h-full">
                {imageLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
                    이미지 로딩 중...
                  </div>
                ) : null}
                <img
                  src={activeMaster.photo_url}
                  alt={activeMaster.model_name ?? "model"}
                  className="w-full h-full object-cover rounded-[10px]"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[var(--muted-weak)]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-sm font-medium">모델 이미지를 표시합니다</span>
              </div>
            )}
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-[var(--panel-border)]">
              <div className="flex items-center gap-2">
                <svg className="text-[var(--primary)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
                </svg>
                <span className="font-bold text-sm">기본 정보</span>
              </div>
              <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded">거래처는 1개 고정</span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  {headerMode === "model" ? "모델명" : "거래처"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {headerMode === "model"
                      ? headerModelName || "-"
                      : headerClient?.client_name ?? "-"}
                  </span>
                  {headerMode === "client" && headerClient?.client_id ? (
                    <Badge className="whitespace-nowrap bg-blue-50 text-blue-600 border-blue-100 rounded-[4px] px-2">
                      확정
                    </Badge>
                  ) : null}
                  {headerMode === "model" && activeMaster?.master_item_id ? (
                    <Badge className="whitespace-nowrap bg-emerald-50 text-emerald-600 border-emerald-100 rounded-[4px] px-2">
                      매칭
                    </Badge>
                  ) : headerMode === "model" ? (
                    <Badge className="whitespace-nowrap bg-red-50 text-red-600 border-red-100 rounded-[4px] px-2">
                      UNMATCHED
                    </Badge>
                  ) : null}
                </div>
                {headerMode === "client" ? (
                  headerClient?.balance_krw !== undefined ? (
                    <p className="text-xs text-[var(--muted)]">
                      미수금 {headerClient.balance_krw?.toLocaleString() ?? 0}원
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">거래처를 입력하면 미수 정보가 표시됩니다.</p>
                  )
                ) : (
                  <p className="text-xs text-[var(--muted)]">모델명을 입력하면 마스터 정보가 연결됩니다.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  {headerMode === "model" ? "매칭 상태" : "마지막 거래일"}
                </label>
                <div className="text-sm text-[var(--foreground)]">
                  {headerMode === "model"
                    ? activeMaster?.master_item_id
                      ? "MATCHED"
                      : "UNMATCHED"
                    : headerClient?.last_tx_at
                      ? headerClient.last_tx_at.slice(0, 10)
                      : "-"}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {headerMode === "client" && headerClient?.open_invoices_count !== null && headerClient?.open_invoices_count !== undefined
                    ? `미수 건수 ${headerClient.open_invoices_count}`
                    : ""}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)]">접수일</label>
                <Input
                  type="date"
                  className="bg-[var(--input-bg)]"
                  value={receiptDate}
                  onChange={(event) => setReceiptDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)]">리스크</label>
                <div className="text-sm text-[var(--foreground)]">{headerClient?.risk_flag ?? "-"}</div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between py-4 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2">
              <svg className="text-[var(--muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="font-bold text-sm">가격 패널</span>
            </div>
            <span className="text-xs text-[var(--muted)]">모델 선택 시 자동 갱신</span>
          </CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
            <div>
              <p className="text-[var(--muted)]">소재가격</p>
              <p className="text-sm font-semibold">
                {activeMaster?.material_price ? `${activeMaster.material_price.toLocaleString()}원` : "-"}
              </p>
            </div>
            <div>
              <p className="text-[var(--muted)]">기본공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_basic ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">중심공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_center ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조1공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_side1 ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조2공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_side2 ?? "-"}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex items-center justify-between py-4 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">모델 기본정보</span>
            </div>
            <span className="text-xs text-[var(--muted)]">마스터 기준</span>
          </CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div>
              <p className="text-[var(--muted)]">공급처</p>
              <p className="text-sm font-semibold">{activeMaster?.vendor_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">기본재질</p>
              <p className="text-sm font-semibold">{activeMaster?.material_code_default ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">카테고리</p>
              <p className="text-sm font-semibold">{activeMaster?.category_code ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">기본중량</p>
              <p className="text-sm font-semibold">{activeMaster?.weight_default_g ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">차감중량</p>
              <p className="text-sm font-semibold">{activeMaster?.deduction_weight_default_g ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">기본공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_basic ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">센터공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_center ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조1공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_side1 ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조2공임</p>
              <p className="text-sm font-semibold">{activeMaster?.labor_side2 ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">센터스톤수</p>
              <p className="text-sm font-semibold">{activeMaster?.center_qty_default ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조1스톤수</p>
              <p className="text-sm font-semibold">{activeMaster?.sub1_qty_default ?? "-"}</p>
            </div>
            <div>
              <p className="text-[var(--muted)]">보조2스톤수</p>
              <p className="text-sm font-semibold">{activeMaster?.sub2_qty_default ?? "-"}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm">Order Items</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <span className="text-xs">자동 저장은 blur 시 수행됩니다.</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f8f9fc] text-[var(--foreground)] font-semibold border-b border-[var(--panel-border)] sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-10 text-center">No</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-10 text-center">취소</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[140px]">
                    <span className="text-red-500">*</span> 거래처
                  </th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[140px]">
                    <span className="text-red-500">*</span> 모델번호
                  </th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-24">분류</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-20">색상</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-16 text-center">수량</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[90px] whitespace-nowrap">중심석</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-16 text-center whitespace-nowrap">중심개수</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[90px] whitespace-nowrap">보조1석</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-16 text-center whitespace-nowrap">보조1개수</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[90px] whitespace-nowrap">보조2석</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-16 text-center whitespace-nowrap">보조2개수</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] w-16 text-center">도금</th>
                  <th className="px-3 py-2 border-r border-[var(--panel-border)] min-w-[120px]">도금색상</th>
                  <th className="px-3 py-2 min-w-[160px]">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)]">
                {rows.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE).map((row, idx) => {
                  const errors = rowErrors[row.id] ?? {};
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/30"
                      onBlur={(event) => {
                        const next = event.relatedTarget as Node | null;
                        if (next && event.currentTarget.contains(next)) return;
                        const current = rows.find((item) => item.id === row.id);
                        if (current) {
                          void saveRow(current);
                        }
                      }}
                    >
                      <td className="px-3 py-2 text-center text-[var(--muted)] border-r border-[var(--panel-border)]">
                        {(pageIndex - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--panel-border)]">
                        <button
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                        >
                          ✕
                        </button>
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-xs",
                            errors.client ? "bg-red-50" : ""
                          )}
                          value={row.client_input}
                          onChange={(event) => updateRow(row.id, { client_input: event.target.value })}
                          onBlur={(event) => resolveClient(row.id, event.currentTarget.value)}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-xs font-semibold",
                            errors.model ? "bg-red-50" : ""
                          )}
                          value={row.model_input}
                          onChange={(event) => updateRow(row.id, { model_input: event.target.value })}
                          onBlur={(event) => resolveMaster(row.id, event.currentTarget.value)}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-xs",
                            errors.category ? "bg-red-50" : ""
                          )}
                          value={row.suffix}
                          onChange={(event) => updateRow(row.id, { suffix: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-xs",
                            errors.color ? "bg-red-50" : ""
                          )}
                          value={row.color}
                          onChange={(event) => updateRow(row.id, { color: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-center font-mono text-xs",
                            errors.qty ? "bg-red-50" : ""
                          )}
                          value={row.qty}
                          onChange={(event) => updateRow(row.id, { qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-0",
                            errors.stones ? "bg-red-50" : ""
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
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-center text-xs",
                            errors.stones ? "bg-red-50" : ""
                          )}
                          value={row.center_qty}
                          onChange={(event) => updateRow(row.id, { center_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-0",
                            errors.stones ? "bg-red-50" : ""
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
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-center text-xs",
                            errors.stones ? "bg-red-50" : ""
                          )}
                          value={row.sub1_qty}
                          onChange={(event) => updateRow(row.id, { sub1_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-0",
                            errors.stones ? "bg-red-50" : ""
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
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <input
                          type="number"
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-center text-xs",
                            errors.stones ? "bg-red-50" : ""
                          )}
                          value={row.sub2_qty}
                          onChange={(event) => updateRow(row.id, { sub2_qty: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)] text-center">
                        <input
                          type="checkbox"
                          checked={row.is_plated}
                          onChange={(event) =>
                            updateRow(row.id, {
                              is_plated: event.target.checked,
                              plating_color: event.target.checked ? row.plating_color : "",
                            })
                          }
                          className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-[var(--panel-border)]">
                        <select
                          className={cn(
                            "w-full bg-transparent border-none focus:ring-0 text-xs py-0",
                            errors.plating ? "bg-red-50" : ""
                          )}
                          value={row.plating_color}
                          onChange={(event) => updateRow(row.id, { plating_color: event.target.value })}
                          disabled={!row.is_plated}
                        >
                          <option value="">선택</option>
                          {platingColors.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full bg-transparent border-none focus:ring-0 focus:bg-blue-50 rounded px-1.5 py-1 text-xs"
                          value={row.memo}
                          onChange={(event) => updateRow(row.id, { memo: event.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[var(--panel-border)] flex items-center justify-between text-xs text-[var(--muted)]">
            <span>라인 {rows.length}개</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
                disabled={pageIndex === 1}
              >
                이전
              </Button>
              <span className="text-xs">
                {pageIndex} / {Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
              </span>
              <Button
                variant="secondary"
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
