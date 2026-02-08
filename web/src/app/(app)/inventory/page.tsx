"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Package, PackageCheck, ClipboardList, Wrench, Search, History, ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LOCATION_OPTIONS = [
  { value: "MAIN", label: "메인" },
  { value: "WAREHOUSE", label: "창고" },
  { value: "SHOP", label: "매장" },
  { value: "FACTORY", label: "공장" },
] as const;

// ===================== TYPES =====================
type PositionRow = {
  location_code?: string | null;
  master_id: string;
  model_name: string;
  on_hand_qty: number;
  last_move_at?: string | null;
  image_path?: string | null;
  material_code?: string | null;
  weight_g?: number | null;
  deduction_weight_g?: number | null;
  color?: string | null;
  size?: string | null;
  center_qty?: number | null;
  sub1_qty?: number | null;
  sub2_qty?: number | null;
  memo?: string | null;
};

type MoveRow = {
  move_line_id?: string;
  move_id?: string;
  move_no?: number | string;
  move_type?: string;
  status?: string;
  occurred_at?: string;
  party_id?: string;
  party_name?: string;
  line_count?: number;
  total_in_qty?: number;
  total_out_qty?: number;
  memo?: string;
  master_model_name?: string | null;
  item_name?: string | null;
  direction?: string | null;
  qty?: number | null;
  location_code?: string | null;
};

type SessionRow = {
  session_id: string;
  session_no: number;
  session_code?: string;
  snapshot_at: string;
  status: string;
  line_count: number;
  delta_line_count: number;
  sum_abs_delta: number;
  generated_move_id?: string;
  generated_move_status?: string;
  created_at: string;
  location_code?: string | null;
};

type FinalizeResult = {
  generated_move_id?: string | null;
  nonzero_delta_lines?: number | null;
};

type CountLineRow = {
  count_line_id: string;
  line_no: number;
  item_ref_type: string;
  item_name: string;
  variant_hint?: string;
  counted_qty: number;
  system_qty_asof?: number;
  delta_qty?: number;
  abs_delta_qty?: number;
  is_void: boolean;
  master_id?: string;
};

type MasterItem = {
  master_id: string;
  model_name: string;
  vendor_name?: string;
  category_code?: string;
  material_code_default?: string;
  weight_default_g?: number;
  deduction_weight_default_g?: number;
  center_qty_default?: number;
  sub1_qty_default?: number;
  sub2_qty_default?: number;
  plating_price_sell_default?: number;
  plating_price_cost_default?: number;
  labor_base_sell?: number;
  labor_center_sell?: number;
  labor_sub1_sell?: number;
  labor_sub2_sell?: number;
  labor_base_cost?: number;
  labor_center_cost?: number;
  labor_sub1_cost?: number;
  labor_sub2_cost?: number;
  color?: string;
  size?: string;
  symbol?: string;
  photo_url?: string;
  image_path?: string;
};

type LocationRow = {
  location_code?: string | null;
  location_name?: string | null;
};

type LocationBinRow = {
  bin_code?: string | null;
  location_code?: string | null;
  bin_name?: string | null;
};

type MasterImageLookupRow = {
  master_id?: string | null;
  model_name?: string | null;
  image_path?: string | null;
};

type QuickMoveForm = {
  move_type: "RECEIPT" | "ISSUE" | "ADJUST" | "RETURN";
  location_code: string;
  bin_code?: string;
  model_name: string;
  master_id?: string;
  session_id?: string;
  qty: number;
  material_code?: string;
  color?: string;
  size?: string;
  category_code?: string;
  base_weight_g?: number;
  deduction_weight_g?: number;
  center_qty?: number;
  sub1_qty?: number;
  sub2_qty?: number;
  plating_sell?: number;
  plating_cost?: number;
  labor_base_sell?: number;
  labor_base_cost?: number;
  memo: string;
};

type SessionForm = {
  location_code: string;
  session_code: string;
  memo: string;
};

type CountLineForm = {
  item_name: string;
  counted_qty: number;
  variant_hint: string;
  master_id?: string;
};

// ===================== HELPERS =====================
const formatKst = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const getImageUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL not set");
    return null;
  }
  const bucketName =
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || "master_images";
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  const storagePrefix = `storage/v1/object/public/${bucketName}/`;
  const cleanPath = trimmed.startsWith(storagePrefix)
    ? trimmed.slice(storagePrefix.length)
    : trimmed.startsWith(`${bucketName}/`)
      ? trimmed.slice(bucketName.length + 1)
      : trimmed;
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanPath}`;
};

// ===================== MAIN COMPONENT =====================
export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [mobileSection, setMobileSection] = useState<"position" | "moves" | "stocktake" | "actions">(
    "position"
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedMasterName, setSelectedMasterName] = useState("");

  const [selectedQuickMaster, setSelectedQuickMaster] = useState<MasterItem | null>(null);
  const [masterSearchQuery, setMasterSearchQuery] = useState("");
  const [masterSearchContext, setMasterSearchContext] = useState<"quick" | "count" | null>(null);

  // ===================== GALLERY DETAIL MODAL STATE =====================
  const [galleryDetailItem, setGalleryDetailItem] = useState<PositionRow | null>(null);
  const [galleryTab, setGalleryTab] = useState<"info" | "stock" | "moves">("info");

  // ===================== GALLERY MODAL DATA =====================
  const { data: galleryStockList = [] } = useQuery({
    queryKey: ["inventory", "gallery", "stock", galleryDetailItem?.master_id],
    queryFn: async () => {
      if (!galleryDetailItem?.master_id) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");

      const { data, error } = await client
        .from(CONTRACTS.views.inventoryPositionByMasterLocation)
        .select("*")
        .eq("master_id", galleryDetailItem.master_id)
        .order("on_hand_qty", { ascending: false });

      if (error) throw error;
      return (data as PositionRow[]) ?? [];
    },
    enabled: !!galleryDetailItem?.master_id && galleryTab === "stock",
  });

  const { data: galleryMoveHistory = [] } = useQuery({
    queryKey: ["inventory", "gallery", "moves", galleryDetailItem?.master_id],
    queryFn: async () => {
      if (!galleryDetailItem?.master_id) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");

      const { data, error } = await client
        .from(CONTRACTS.views.inventoryMoveLinesEnriched)
        .select("*")
        .eq("master_id", galleryDetailItem.master_id)
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as MoveRow[]) ?? [];
    },
    enabled: !!galleryDetailItem?.master_id && galleryTab === "moves",
  });

  const galleryMoveForm = useForm<QuickMoveForm>({
    defaultValues: {
      move_type: "ADJUST",
      location_code: "",
      model_name: "",
      qty: 0,
      memo: "",
    },
  });

  // Reset tab and form when opening different item
  useEffect(() => {
    if (galleryDetailItem) {
      setGalleryTab("info");
      galleryMoveForm.reset({
        move_type: "ADJUST",
        location_code: galleryDetailItem.location_code || "",
        model_name: galleryDetailItem.model_name,
        master_id: galleryDetailItem.master_id,
        qty: 0,
        memo: "",
        material_code: galleryDetailItem.material_code || undefined,
        base_weight_g: galleryDetailItem.weight_g || undefined,
        deduction_weight_g: galleryDetailItem.deduction_weight_g || 0,
        center_qty: galleryDetailItem.center_qty || undefined,
        sub1_qty: galleryDetailItem.sub1_qty || undefined,
        sub2_qty: galleryDetailItem.sub2_qty || undefined,
        color: galleryDetailItem.color || undefined,
        size: galleryDetailItem.size || undefined,
      });
    }
  }, [galleryDetailItem, galleryMoveForm]);

  const onSubmitGalleryMove = (values: QuickMoveForm) => {
    if (values.base_weight_g === null || values.base_weight_g === undefined) {
      toast.error("기본 중량을 입력해주세요");
      return;
    }
    if (values.deduction_weight_g === null || values.deduction_weight_g === undefined) {
      toast.error("차감 중량을 입력해주세요");
      return;
    }

    if (!values.model_name || values.qty <= 0) {
      toast.error("품목명과 수량을 입력해주세요");
      return;
    }

    const resolvedLocation = values.location_code || null;

    if (!resolvedLocation) {
      toast.error("위치를 선택해주세요");
      return;
    }

    quickMoveMutation.mutate({
      p_move_type: values.move_type,
      p_item_name: values.model_name,
      p_qty: values.qty,
      p_occurred_at: new Date().toISOString(),
      p_party_id: null,
      p_location_code: resolvedLocation,
      p_master_id: values.master_id || null,
      p_variant_hint: values.material_code || null,
      p_unit: "EA",
      p_source: "MANUAL",
      p_memo: values.memo || null,
      p_meta: {},
      p_idempotency_key: null,
      p_actor_person_id: null,
      p_note: "From Gallery Detail",
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const galleryStockTotal = useMemo(() => {
    return galleryStockList.reduce((sum, row) => sum + row.on_hand_qty, 0);
  }, [galleryStockList]);

  // ===================== POSITION TAB STATE =====================
  const [positionMode, setPositionMode] = useState<"total" | "byLocation">("total");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  // ===================== POSITION TAB DATA =====================
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);

  const { data: locationList = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryLocationMaster)
        .select("*")
        .order("location_code");
      if (error) throw error;
      return (data as LocationRow[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: locationBinList = [] } = useQuery({
    queryKey: ["location-bins"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryLocationBins)
        .select("bin_code, location_code, bin_name")
        .eq("is_active", true)
        .order("location_code", { ascending: true })
        .order("bin_code", { ascending: true });
      if (error) throw error;
      return (data as LocationBinRow[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });



  const { data: positionData = [], isLoading: positionLoading } = useQuery({
    queryKey: ["inventory", "position", positionMode, selectedLocation],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const view =
        positionMode === "total"
          ? CONTRACTS.views.inventoryPositionByMaster
          : CONTRACTS.views.inventoryPositionByMasterLocation;

      let q = client.from(view).select("*").order("on_hand_qty", { ascending: false });

      if (positionMode === "byLocation" && selectedLocation) {
        if (selectedLocation === "__NULL__") q = q.is("location_code", null);
        else q = q.eq("location_code", selectedLocation);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data as PositionRow[]) ?? [];
    },
  });

  const filteredPosition = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return positionData;
    return positionData.filter((row) => (row.model_name || "").toLowerCase().includes(query));
  }, [positionData, searchTerm]);

  const positionMasterIds = useMemo(
    () => Array.from(new Set(positionData.map((row) => row.master_id).filter(Boolean))),
    [positionData]
  );

  const { data: masterImageRows = [] } = useQuery({
    queryKey: ["inventory", "master-images", positionMasterIds],
    queryFn: async () => {
      if (positionMasterIds.length === 0) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.masterItems)
        .select("master_id, model_name, image_path")
        .in("master_id", positionMasterIds);
      if (error) throw error;
      return (data as MasterImageLookupRow[]) ?? [];
    },
    enabled: positionMasterIds.length > 0,
  });

  const imageUrlByMasterId = useMemo(() => {
    const map = new Map<string, string>();
    masterImageRows.forEach((row) => {
      const masterId = String(row.master_id ?? "");
      if (!masterId) return;
      const imageUrl = getImageUrl(row.image_path);
      if (imageUrl) map.set(masterId, imageUrl);
    });
    return map;
  }, [masterImageRows]);

  const imageUrlByModelName = useMemo(() => {
    const map = new Map<string, string>();
    masterImageRows.forEach((row) => {
      const modelName = String(row.model_name ?? "").trim().toLowerCase();
      if (!modelName) return;
      const imageUrl = getImageUrl(row.image_path);
      if (imageUrl) map.set(modelName, imageUrl);
    });
    return map;
  }, [masterImageRows]);

  const galleryDetailImageUrl = useMemo(() => {
    if (!galleryDetailItem) return null;
    return (
      imageUrlByMasterId.get(galleryDetailItem.master_id) ||
      imageUrlByModelName.get((galleryDetailItem.model_name ?? "").trim().toLowerCase()) ||
      getImageUrl(galleryDetailItem.image_path)
    );
  }, [galleryDetailItem, imageUrlByMasterId, imageUrlByModelName]);

  const selectedPositionRows = useMemo(() => {
    if (!selectedMasterId) return [];
    return positionData.filter((row) => row.master_id === selectedMasterId);
  }, [positionData, selectedMasterId]);

  const selectedPositionTotal = useMemo(() => {
    if (!selectedMasterId) return null;
    if (positionMode === "byLocation") {
      return selectedPositionRows.reduce((sum, row) => sum + row.on_hand_qty, 0);
    }
    const row = positionData.find((item) => item.master_id === selectedMasterId);
    return row?.on_hand_qty ?? null;
  }, [positionData, positionMode, selectedMasterId, selectedPositionRows]);

  const selectedMasterLabel = useMemo(() => {
    if (selectedMasterName) return selectedMasterName;
    if (!selectedMasterId) return "";
    return positionData.find((row) => row.master_id === selectedMasterId)?.model_name || "";
  }, [positionData, selectedMasterId, selectedMasterName]);

  useEffect(() => {
    if (filteredPosition.length === 0) {
      setSelectedMasterId(null);
      setSelectedMasterName("");
      return;
    }

    const exists = selectedMasterId
      ? filteredPosition.some((row) => row.master_id === selectedMasterId)
      : false;

    if (!exists) {
      const first = filteredPosition[0];
      setSelectedMasterId(first.master_id);
      setSelectedMasterName(first.model_name);
    }
  }, [filteredPosition, selectedMasterId]);

  // ===================== STOCKTAKE: SESSIONS =====================
  const { data: sessionsData = [] } = useQuery({
    queryKey: ["inventory", "stocktake", "sessions"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryCountSessions)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as SessionRow[]) ?? [];
    },
  });

  const filteredSessions = useMemo(() => {
    const query = sessionSearchQuery.toLowerCase().trim();
    if (!query) return sessionsData;
    return sessionsData.filter((session) => {
      return (
        (session.session_code?.toLowerCase() || "").includes(query) ||
        (session.location_code?.toLowerCase() || "").includes(query) ||
        String(session.session_no).includes(query)
      );
    });
  }, [sessionsData, sessionSearchQuery]);

  // ===================== MASTER SEARCH FOR MOVES TAB =====================
  const { data: masterSearchResults = [] } = useQuery({
    queryKey: ["master", "search", masterSearchQuery],
    queryFn: async () => {
      if (!masterSearchQuery || masterSearchQuery.length < 1) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.masterItemLookup)
        .select("*")
        .ilike("model_name", `%${masterSearchQuery}%`)
        .limit(10);
      if (error) throw error;
      return (data as MasterItem[]) ?? [];
    },
    enabled: masterSearchContext !== null && masterSearchQuery.length > 0,
  });

  // ===================== MOVES TAB DATA =====================
  const { data: movesData = [] } = useQuery({
    queryKey: ["inventory", "moves"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryMoveLinesEnriched)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as MoveRow[]) ?? [];
    },
  });

  const filteredMoves = useMemo(() => {
    if (!selectedMasterLabel) return [];
    const target = selectedMasterLabel.toLowerCase();
    return movesData
      .filter((move) => {
        const name = (move.master_model_name || move.item_name || "").toLowerCase();
        return name.includes(target);
      })
      .slice(0, 12);
  }, [movesData, selectedMasterLabel]);

  // ===================== QUICK MOVE =====================
  const quickMoveForm = useForm<QuickMoveForm>({
    defaultValues: {
      move_type: "RECEIPT",
      location_code: "",
      bin_code: "",
      model_name: "",
      master_id: undefined,
      session_id: undefined,
      qty: 0,
      material_code: undefined,
      color: undefined,
      size: undefined,
      category_code: undefined,
      base_weight_g: undefined,
      deduction_weight_g: 0,
      center_qty: undefined,
      sub1_qty: undefined,
      sub2_qty: undefined,
      plating_sell: undefined,
      plating_cost: undefined,
      labor_base_sell: undefined,
      labor_base_cost: undefined,
      memo: "",
    },
  });

  const quickLocationCode = quickMoveForm.watch("location_code") || "";
  const quickBinOptions = useMemo(
    () =>
      locationBinList
        .filter((row) => String(row.location_code ?? "") === quickLocationCode)
        .map((row) => ({
          value: String(row.bin_code ?? ""),
          label: `${row.bin_name ?? row.bin_code} (${row.bin_code})`,
        })),
    [locationBinList, quickLocationCode]
  );

  const quickMoveMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.quickInventoryMove,
    successMessage: "등록 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      quickMoveForm.reset();
      setSelectedQuickMaster(null);
    },
  });

  const onSubmitQuickMove = (values: QuickMoveForm) => {
    if (values.base_weight_g === null || values.base_weight_g === undefined) {
      toast.error("기본 중량을 입력해주세요");
      return;
    }

    if (!values.model_name || values.qty <= 0) {
      toast.error("품목명과 수량을 입력해주세요");
      return;
    }

    const resolvedLocation =
      values.location_code ||
      (values.session_id
        ? sessionsData.find((s) => s.session_id === values.session_id)?.location_code
        : null) ||
      null;

    if (!resolvedLocation) {
      toast.error("위치를 선택해주세요");
      return;
    }

    quickMoveMutation.mutate({
      p_move_type: values.move_type,
      p_item_name: values.model_name,
      p_qty: values.qty,
      p_occurred_at: new Date().toISOString(),
      p_party_id: null,
      p_location_code: resolvedLocation,
      p_bin_code: values.bin_code || null,
      p_master_id: values.master_id || null,
      p_variant_hint: [values.material_code, values.color, values.size].filter(Boolean).join("/") || null,
      p_unit: "EA",
      p_source: "MANUAL",
      p_memo: values.memo || null,
      p_meta: {
        ...(values.session_id ? { session_id: values.session_id } : {}),
        material_code: values.material_code || null,
        color: values.color || null,
        size: values.size || null,
        base_weight_g: values.base_weight_g,
        deduction_weight_g: values.deduction_weight_g ?? 0,
        net_weight_g: Math.max(0, Number(values.base_weight_g ?? 0) - Number(values.deduction_weight_g ?? 0)),
      },
      p_idempotency_key: null,
      p_actor_person_id: null,
      p_note: values.session_id ? `Linked to session` : null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const handleMasterSelect = (master: MasterItem) => {
    setSelectedQuickMaster(master);
    quickMoveForm.setValue("model_name", master.model_name);
    quickMoveForm.setValue("master_id", master.master_id);
    quickMoveForm.setValue("material_code", master.material_code_default || "");
    quickMoveForm.setValue("color", master.color || "");
    quickMoveForm.setValue("size", master.size || master.symbol || "");
    quickMoveForm.setValue("base_weight_g", master.weight_default_g ?? undefined);
    quickMoveForm.setValue("deduction_weight_g", master.deduction_weight_default_g ?? 0);
    setMasterSearchContext(null);
    setMasterSearchQuery("");
  };

  const handleCopyFromMaster = () => {
    if (!selectedQuickMaster) {
      toast.error("마스터를 먼저 선택해주세요");
      return;
    }

    quickMoveForm.setValue("material_code", selectedQuickMaster.material_code_default || "");
    quickMoveForm.setValue("category_code", selectedQuickMaster.category_code || "");
    quickMoveForm.setValue("center_qty", selectedQuickMaster.center_qty_default || 0);
    quickMoveForm.setValue("sub1_qty", selectedQuickMaster.sub1_qty_default || 0);
    quickMoveForm.setValue("sub2_qty", selectedQuickMaster.sub2_qty_default || 0);
    quickMoveForm.setValue("plating_sell", selectedQuickMaster.plating_price_sell_default || 0);
    quickMoveForm.setValue("plating_cost", selectedQuickMaster.plating_price_cost_default || 0);
    quickMoveForm.setValue("labor_base_sell", selectedQuickMaster.labor_base_sell || 0);
    quickMoveForm.setValue("labor_base_cost", selectedQuickMaster.labor_base_cost || 0);

    toast.info("마스터 데이터 복사됨 (중량 제외)");
  };

  const handleSelectPositionRow = (row: PositionRow) => {
    setSelectedMasterId(row.master_id);
    setSelectedMasterName(row.model_name);
    quickMoveForm.setValue("model_name", row.model_name);
    quickMoveForm.setValue("master_id", row.master_id);
  };

  // ===================== STOCKTAKE TAB DATA =====================
  const { data: sessionLinesData = [] } = useQuery({
    queryKey: ["inventory", "stocktake", "lines", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryCountLinesEnriched)
        .select("*")
        .eq("session_id", selectedSessionId)
        .order("line_no", { ascending: true });
      if (error) throw error;
      return (data as CountLineRow[]) ?? [];
    },
    enabled: !!selectedSessionId,
  });

  const selectedSession = sessionsData.find((s) => s.session_id === selectedSessionId);
  const isFinalized = selectedSession?.status === "FINALIZED";

  const sessionForm = useForm<SessionForm>({
    defaultValues: {
      location_code: "",
      session_code: "",
      memo: "",
    },
  });

  const countLineForm = useForm<CountLineForm>({
    defaultValues: {
      item_name: "",
      counted_qty: 0,
      variant_hint: "",
    },
  });

  const createSessionMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.inventoryCountSessionCreate,
    successMessage: "실사 세션 생성 완료",
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      setSelectedSessionId(sessionId);
      sessionForm.reset();
    },
  });

  const addLineMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.inventoryCountLineAdd,
    successMessage: "라인 추가 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      countLineForm.reset();
    },
  });

  const finalizeMutation = useRpcMutation<FinalizeResult>({
    fn: CONTRACTS.functions.inventoryCountSessionFinalize,
    successMessage: "실사 확정 완료",
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (result.generated_move_id) {
        toast.success(`ADJUST 이동 생성됨: ${result.nonzero_delta_lines}개 델타 라인`);
      } else {
        toast.info("델타 0 - ADJUST 이동 생성하지 않음");
      }
    },
  });

  const voidSessionMutation = useRpcMutation<void>({
    fn: CONTRACTS.functions.inventoryCountSessionVoid,
    successMessage: "세션 취소 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      setSelectedSessionId(null);
    },
  });

  const onCreateSession = (values: SessionForm) => {
    if (!values.location_code) {
      toast.error("세션 위치를 선택해주세요");
      return;
    }

    createSessionMutation.mutate({
      p_snapshot_at: new Date().toISOString(),
      p_location_code: values.location_code || null,
      p_session_code: values.session_code || null,
      p_memo: values.memo || null,
      p_meta: {},
      p_idempotency_key: null,
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onAddLine = (values: CountLineForm) => {
    if (!selectedSessionId) {
      toast.error("세션을 선택해주세요");
      return;
    }
    if (!values.item_name || values.counted_qty < 0) {
      toast.error("품목명과 수량을 입력해주세요");
      return;
    }

    addLineMutation.mutate({
      p_session_id: selectedSessionId,
      p_item_ref_type: values.master_id ? "MASTER" : "UNLINKED",
      p_item_name: values.item_name,
      p_counted_qty: values.counted_qty,
      p_master_id: values.master_id || null,
      p_part_id: null,
      p_variant_hint: values.variant_hint || null,
      p_note: null,
      p_meta: {},
      p_actor_person_id: null,
      p_note2: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onFinalize = () => {
    if (!selectedSessionId) return;
    if (!confirm("실사를 확정하시겠습니까? (delta≠0이면 ADJUST 이동이 생성되고 POST됩니다)")) return;

    finalizeMutation.mutate({
      p_session_id: selectedSessionId,
      p_generate_adjust: true,
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onVoidSession = () => {
    if (!selectedSessionId) return;
    if (!confirm("이 세션을 취소하시겠습니까?")) return;

    voidSessionMutation.mutate({
      p_session_id: selectedSessionId,
      p_reason: "user_void",
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  // ===================== RENDER =====================
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]" id="inventory.root">
      {/* LEFT SIDEBAR - Inventory List */}
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5" />
            재고 관리
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <input
              placeholder="모델명 검색..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--chip)] border-none text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* View Mode Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setPositionMode("total")}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors border",
                positionMode === "total"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
              )}
            >
              전체
            </button>
            <button
              onClick={() => setPositionMode("byLocation")}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors border",
                positionMode === "byLocation"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
              )}
            >
              위치별
            </button>
          </div>
          {positionMode === "byLocation" && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full h-8 text-xs rounded-md bg-[var(--chip)] border-none px-2"
            >
              <option value="">(전체 위치)</option>
              <option value="__NULL__">미지정</option>
              {LOCATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-2 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">총 {filteredPosition.length}개 모델</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {positionLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={`position-skeleton-${i}`} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPosition.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] text-sm">
              조건에 맞는 재고가 없습니다
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredPosition.map((row) => {
                const active = selectedMasterId === row.master_id;
                return (
                  <button
                    key={`${row.master_id}-${row.location_code ?? "NA"}`}
                    onClick={() => handleSelectPositionRow(row)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all border",
                      active
                        ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-[var(--chip)] hover:border-[var(--panel-border)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn("font-medium truncate text-sm", active && "text-[var(--primary)]")}>
                        {row.model_name}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {row.on_hand_qty.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>{positionMode === "byLocation" ? (row.location_code || "미지정") : ""}</span>
                      <span>{formatKst(row.last_move_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT - 5 Column Gallery View */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)] overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight">재고 갤러리</h1>
              <p className="text-xs text-[var(--muted)]">
                총 {filteredPosition.length}개 모델 · 클릭하여 상세 보기
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => {
                  setIsQuickInputOpen(true);
                  setMasterSearchContext("quick");
                  setMasterSearchQuery("");
                  setSelectedQuickMaster(null);
                  quickMoveForm.reset();
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                재고 등록
              </Button>
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--chip)] text-[var(--muted)]">{positionMode === "total" ? "전체" : selectedLocation || "전체 위치"}</span>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {positionLoading ? (
            <div className="grid grid-cols-5 gap-4">
              {[...Array(15)].map((_, i) => (
                <div key={`skeleton-${i}`} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredPosition.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center py-20">
                <Package className="mx-auto mb-4 h-16 w-16 opacity-10" />
                <p className="text-lg font-medium mb-1 text-[var(--muted)]">재고가 없습니다</p>
                <p className="text-sm text-[var(--muted)]">검색 조건을 변경해 보세요.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {filteredPosition.map((row) => {
                const imageUrl =
                  imageUrlByMasterId.get(row.master_id) ||
                  imageUrlByModelName.get((row.model_name ?? "").trim().toLowerCase()) ||
                  getImageUrl(row.image_path);
                return (
                  <button
                    key={`${row.master_id}-${row.location_code ?? "NA"}`}
                    onClick={() => setGalleryDetailItem(row)}
                    className="group text-left rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] overflow-hidden transition-all hover:shadow-lg hover:border-[var(--primary)]/50 hover:scale-[1.02]"
                  >
                    {/* 1:1 Image */}
                    <div className="aspect-square bg-[var(--chip)] relative overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={row.model_name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-[var(--muted)] opacity-30" />
                        </div>
                      )}
                      {/* Qty Badge */}
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full tabular-nums">
                        {row.on_hand_qty.toLocaleString()}
                      </div>
                    </div>
                    {/* Info Card */}
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{row.model_name}</p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {positionMode === "byLocation" ? row.location_code || "미지정" : `${row.on_hand_qty}개`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Gallery Detail Modal */}
      {galleryDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setGalleryDetailItem(null)}>
          <div
            className="bg-[var(--panel)] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] shrink-0">
              <h2 className="text-lg font-bold truncate">{galleryDetailItem.model_name}</h2>
              <button
                onClick={() => setGalleryDetailItem(null)}
                className="p-2 rounded-lg hover:bg-[var(--chip)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--panel-border)] px-4 bg-[var(--panel)] shrink-0">
              <button
                onClick={() => setGalleryTab("info")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                  galleryTab === "info"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                기본정보
              </button>
              <button
                onClick={() => setGalleryTab("stock")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                  galleryTab === "stock"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <Package className="w-4 h-4" />
                재고목록
              </button>
              <button
                onClick={() => setGalleryTab("moves")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                  galleryTab === "moves"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <History className="w-4 h-4" />
                입출고내역
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {galleryTab === "info" && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Image */}
                  <div className="aspect-square bg-[var(--chip)] rounded-xl overflow-hidden">
                    {galleryDetailImageUrl ? (
                      <img
                        src={galleryDetailImageUrl}
                        alt={galleryDetailItem.model_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-20 h-20 text-[var(--muted)] opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-[var(--muted)] mb-1">모델명</p>
                      <p className="text-lg font-bold">{galleryDetailItem.model_name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">재고 수량</p>
                        <p className="text-2xl font-bold tabular-nums">{galleryDetailItem.on_hand_qty.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">위치</p>
                        <p className="text-lg font-semibold">{galleryDetailItem.location_code || "전체"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">소재</p>
                        <p className="font-medium">{galleryDetailItem.material_code || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">중량 (원중량 - 차감)</p>
                        <p className="font-medium tabular-nums">
                          {galleryDetailItem.weight_g ?? "-"}g - {galleryDetailItem.deduction_weight_g ?? 0}g
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">색상</p>
                        <p className="font-medium">{galleryDetailItem.color || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">사이즈</p>
                        <p className="font-medium">{galleryDetailItem.size || "-"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--chip)] rounded-lg">
                      <div className="text-center">
                        <p className="text-[10px] font-medium text-[var(--muted)] mb-0.5">메인</p>
                        <p className="text-lg font-bold tabular-nums">{galleryDetailItem.center_qty ?? "-"}</p>
                      </div>
                      <div className="text-center border-x border-[var(--panel-border)]">
                        <p className="text-[10px] font-medium text-[var(--muted)] mb-0.5">보조1</p>
                        <p className="text-lg font-bold tabular-nums">{galleryDetailItem.sub1_qty ?? "-"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-medium text-[var(--muted)] mb-0.5">보조2</p>
                        <p className="text-lg font-bold tabular-nums">{galleryDetailItem.sub2_qty ?? "-"}</p>
                      </div>
                    </div>

                    {galleryDetailItem.memo && (
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-1">비고</p>
                        <p className="text-sm p-3 bg-[var(--chip)] rounded-lg">{galleryDetailItem.memo}</p>
                      </div>
                    )}

                    <div className="text-xs text-[var(--muted)]">
                      최근 이동: {formatKst(galleryDetailItem.last_move_at)}
                    </div>
                  </div>
                </div>
              )}

              {galleryTab === "stock" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[var(--chip)] rounded-lg">
                    <span className="text-sm font-medium text-[var(--muted)]">총 재고</span>
                    <span className="text-xl font-bold tabular-nums">{galleryStockTotal.toLocaleString()} units</span>
                  </div>
                  <div className="border border-[var(--panel-border)] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--chip)] text-xs font-medium text-[var(--muted)] uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">위치</th>
                          <th className="px-4 py-2 text-right">수량</th>
                          <th className="px-4 py-2 text-right">중량</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]">
                        {galleryStockList.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-medium">{row.location_code || "미지정"}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{row.on_hand_qty.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-[var(--muted)]">
                              {(row.weight_g ?? 0) > 0 ? `${row.weight_g}g` : "-"}
                            </td>
                          </tr>
                        ))}
                        {galleryStockList.length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--muted)]">데이터가 없습니다</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {galleryTab === "moves" && (
                <div className="space-y-6">
                  {/* Record Move Form */}
                  <div className="bg-[var(--chip)] p-4 rounded-xl border border-[var(--panel-border)] space-y-3">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" />
                      재고 조정 (Record Move)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...galleryMoveForm.register("move_type")}
                      >
                        <option value="ADJUST">조정 (ADJUST)</option>
                        <option value="RECEIPT">입고 (RECEIPT)</option>
                        <option value="ISSUE">출고 (ISSUE)</option>
                        <option value="RETURN">반품 (RETURN)</option>
                      </select>
                      <input
                        type="text"
                        placeholder="위치 (예: MAIN)"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...galleryMoveForm.register("location_code")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="수량"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...galleryMoveForm.register("qty", { valueAsNumber: true })}
                      />
                      <input
                        type="text"
                        placeholder="메모"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...galleryMoveForm.register("memo")}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={galleryMoveForm.handleSubmit(onSubmitGalleryMove)}
                      disabled={quickMoveMutation.isPending}
                    >
                      {quickMoveMutation.isPending ? "처리중..." : "기록하기"}
                    </Button>
                  </div>

                  {/* Move History List */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[var(--muted)]">최근 내역</p>
                    <div className="border border-[var(--panel-border)] rounded-lg overflow-hidden divide-y divide-[var(--panel-border)]">
                      {galleryMoveHistory.map((move) => (
                        <div key={move.move_line_id} className="p-3 text-sm flex justify-between items-center bg-[var(--panel)]">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge tone="neutral" className="text-[10px] h-5 px-1.5">{move.move_type}</Badge>
                              <span className="font-medium text-[var(--foreground)]">{move.location_code ?? "-"}</span>
                            </div>
                            <p className="text-xs text-[var(--muted)]">{formatKst(move.occurred_at)}</p>
                          </div>
                          <div className={cn("text-right font-bold tabular-nums", (move.qty ?? 0) > 0 ? "text-blue-500" : "text-red-500")}>
                            {(move.qty ?? 0) > 0 ? "+" : ""}{move.qty?.toLocaleString()}
                          </div>
                        </div>
                      ))}
                      {galleryMoveHistory.length === 0 && (
                        <div className="p-4 text-center text-[var(--muted)] text-sm">기록이 없습니다</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Quick Input Modal */}
      {isQuickInputOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setIsQuickInputOpen(false); setMasterSearchContext(null); }}>
          <div
            className="bg-[var(--panel)] rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                재고 등록 (Quick Input)
              </h2>
              <button
                onClick={() => { setIsQuickInputOpen(false); setMasterSearchContext(null); }}
                className="p-2 rounded-lg hover:bg-[var(--chip)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {!selectedQuickMaster ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    <input
                      type="text"
                      placeholder="모델명 또는 공급사 검색..."
                      className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    {masterSearchResults.map((master) => (
                      <button
                        key={master.master_id}
                        onClick={() => handleMasterSelect(master)}
                        className="w-full text-left p-3 rounded-lg border border-[var(--panel-border)] hover:bg-[var(--chip)] transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-[var(--background)] rounded-md overflow-hidden flex items-center justify-center border border-[var(--panel-border)]">
                          {getImageUrl(master.image_path) ? (
                            <img src={getImageUrl(master.image_path)!} alt={master.model_name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-[var(--muted)] opacity-50" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{master.model_name}</p>
                          <p className="text-xs text-[var(--muted)]">{master.vendor_name || "공급사 미지정"}</p>
                        </div>
                      </button>
                    ))}
                    {masterSearchQuery && masterSearchResults.length === 0 && (
                      <div className="text-center p-8 text-[var(--muted)] text-sm">
                        검색 결과가 없습니다.
                      </div>
                    )}
                    {!masterSearchQuery && (
                      <div className="text-center p-8 text-[var(--muted)] text-sm">
                        모델명을 검색하세요.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[var(--chip)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[var(--background)] rounded-md overflow-hidden flex items-center justify-center border border-[var(--panel-border)]">
                        {getImageUrl(selectedQuickMaster.image_path) ? (
                          <img src={getImageUrl(selectedQuickMaster.image_path)!} alt={selectedQuickMaster.model_name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-[var(--muted)] opacity-50" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-base">{selectedQuickMaster.model_name}</p>
                        <p className="text-xs text-[var(--muted)]">{selectedQuickMaster.vendor_name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedQuickMaster(null)}>변경</Button>
                  </div>

                  {/* Read-only Properties */}
                  <div className="grid grid-cols-3 gap-2 p-3 border border-[var(--panel-border)] rounded-lg bg-[var(--background)]">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1">소재 (Material)</label>
                      <p className="text-sm font-medium">{selectedQuickMaster.material_code_default || "-"}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1">색상 (Color)</label>
                      <p className="text-sm font-medium">{selectedQuickMaster.color || "-"}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1">사이즈 (Size)</label>
                      <p className="text-sm font-medium">{selectedQuickMaster.size || selectedQuickMaster.symbol || "-"}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">마스터 기본값을 참고해 아래 입력값을 수정해서 등록할 수 있습니다.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">구분</label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("move_type")}
                      >
                        <option value="RECEIPT">입고 (RECEIPT)</option>
                        <option value="ISSUE">출고 (ISSUE)</option>
                        <option value="ADJUST">조정 (ADJUST)</option>
                        <option value="RETURN">반품 (RETURN)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">중량(g)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="기본 중량"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("base_weight_g", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">차감중량(g)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="차감 중량"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("deduction_weight_g", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">수량</label>
                      <input
                        type="number"
                        placeholder="수량"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("qty", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">총중량(g)</label>
                      <input
                        type="text"
                        readOnly
                        value={Math.max(0, Number(quickMoveForm.watch("base_weight_g") ?? 0) - Number(quickMoveForm.watch("deduction_weight_g") ?? 0)).toFixed(2)}
                        className="w-full h-9 rounded-md border border-input bg-[var(--chip)] px-3 py-1 text-sm text-right tabular-nums"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">위치 (Location)</label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("location_code")}
                      >
                        <option value="">위치 선택</option>
                        {locationList.map((loc) => (
                          <option key={loc.location_code} value={loc.location_code}>
                            {loc.location_name || loc.location_code} ({loc.location_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">세부 위치 (bin)</label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("bin_code")}
                      >
                        <option value="">bin 선택 (선택)</option>
                        {quickBinOptions.map((bin) => (
                          <option key={bin.value} value={bin.value}>{bin.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">소재</label>
                      <input
                        type="text"
                        placeholder="예: 14, 925"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("material_code")}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">색상</label>
                      <input
                        type="text"
                        placeholder="예: Y, WG"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("color")}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">사이즈</label>
                      <input
                        type="text"
                        placeholder="예: 12, 45cm"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("size")}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">비고 (Memo)</label>
                      <input
                        type="text"
                        placeholder="메모 입력"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...quickMoveForm.register("memo")}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[var(--muted)] mb-1 block">추가 메모</label>
                      <input
                        type="text"
                        placeholder="추가 메모 입력"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onBlur={(e) => {
                          const current = quickMoveForm.getValues("memo") || "";
                          if (e.target.value) {
                            const newVal = current ? `${current} / ${e.target.value}` : e.target.value;
                            quickMoveForm.setValue("memo", newVal);
                            e.target.value = ""; // Clear after appending
                          }
                        }}
                      />
                      <p className="text-[10px] text-[var(--muted)] mt-1">* 입력 후 포커스를 이동하면 비고에 자동 추가됩니다.</p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={quickMoveForm.handleSubmit(onSubmitQuickMove)}
                    disabled={quickMoveMutation.isPending}
                  >
                    {quickMoveMutation.isPending ? "처리중..." : "등록하기"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
