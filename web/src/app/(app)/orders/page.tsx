"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { getSchemaClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";

type OrderRow = {
  order_line_id?: string;
  customer_party_id?: string;
  customer_name?: string;
  model_name?: string;
  model_name_raw?: string | null;
  suffix?: string;
  color?: string;
  size?: string | null;
  qty?: number;
  is_plated?: boolean;
  plating_variant_id?: string | null;
  requested_due_date?: string | null;
  priority_code?: string | null;
  status?: string;
  match_state?: string | null;
  memo?: string | null;
  source_channel?: string | null;
  created_at?: string | null;
};

type PartyRow = {
  party_id?: string;
  name?: string;
  party_type?: string;
  is_active?: boolean;
};

type PlatingVariantRow = {
  plating_variant_id?: string;
  display_name?: string | null;
  plating_type?: string | null;
  color_code?: string | null;
  thickness_code?: string | null;
  is_active?: boolean;
};

type VendorPrefixRow = {
  prefix?: string;
  vendor_party_id?: string;
};

type EnumValueRow = {
  value?: string;
};

type OrderForm = {
  customer_party_id: string;
  model_name: string;
  suffix: string;
  color: string;
  qty: number;
  size?: string;
  is_plated?: boolean;
  plating_variant_id?: string;
  requested_due_date?: string;
  priority_code?: string;
  source_channel?: string;
  memo?: string;
};

const normalizeText = (value?: string) => (value ?? "").trim();
const toNullable = (value?: string) => {
  const trimmed = normalizeText(value);
  return trimmed.length > 0 ? trimmed : null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return value.slice(0, 10);
};

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function OrdersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPlating, setSelectedPlating] = useState("");
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState("");
  const [selectedDetailPlating, setSelectedDetailPlating] = useState("");
  const [keepCustomer, setKeepCustomer] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [shipmentDate, setShipmentDate] = useState("");
  const [shipmentMemo, setShipmentMemo] = useState("");
  const [statusTo, setStatusTo] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterPlated, setFilterPlated] = useState("all");
  const [filterDue, setFilterDue] = useState("all");

  const quickForm = useForm<OrderForm>({
    defaultValues: { qty: 1, is_plated: false },
  });
  const detailForm = useForm<OrderForm>({
    defaultValues: { qty: 1, is_plated: false },
  });

  const schemaClient = getSchemaClient();
  const enumFn = CONTRACTS.functions.enumValues;
  const orderUpsertFn = CONTRACTS.functions.orderUpsertV2;
  const canUpsert = isFnConfigured(orderUpsertFn);
  const canSetStatus = isFnConfigured(CONTRACTS.functions.orderSetStatus);
  const canCreateShipment = isFnConfigured(CONTRACTS.functions.shipmentCreateFromOrders);

  const actorId = process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? "";

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

  const platingQuery = useQuery({
    queryKey: ["cms", "plating_variants"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_plating_variant")
        .select("plating_variant_id, display_name, plating_type, color_code, thickness_code, is_active")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as PlatingVariantRow[];
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

  const ordersQuery = useQuery({
    queryKey: ["cms", "orders", "worklist"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.ordersWorklist)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const orderStatusQuery = useQuery({
    queryKey: ["cms", "enum", "order_status"],
    queryFn: async () => {
      if (!isFnConfigured(enumFn)) return [] as EnumValueRow[];
      const data = await callRpc<EnumValueRow[]>(enumFn, { p_enum: "cms_e_order_status" });
      return data ?? [];
    },
  });

  const priorityQuery = useQuery({
    queryKey: ["cms", "enum", "priority"],
    queryFn: async () => {
      if (!isFnConfigured(enumFn)) return [] as EnumValueRow[];
      const data = await callRpc<EnumValueRow[]>(enumFn, { p_enum: "cms_e_priority_code" });
      return data ?? [];
    },
  });


  const customerOptions = useMemo(() => {
    return (customersQuery.data ?? [])
      .filter((row) => row.party_id && row.name)
      .map((row) => ({ label: row.name ?? "-", value: row.party_id ?? "" }));
  }, [customersQuery.data]);

  const platingOptions = useMemo(() => {
    return (platingQuery.data ?? [])
      .filter((row) => row.plating_variant_id)
      .map((row) => {
        const label = row.display_name
          ? String(row.display_name)
          : [row.plating_type, row.color_code, row.thickness_code].filter(Boolean).join("/") || "도금";
        return { label, value: row.plating_variant_id ?? "" };
      });
  }, [platingQuery.data]);

  const platingLabelById = useMemo(() => {
    const map = new Map<string, string>();
    platingOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [platingOptions]);

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

  const ordersWithGuess = useMemo(() => {
    return (ordersQuery.data ?? []).map((order) => {
      const model = (order.model_name ?? "").toLowerCase();
      let vendorPartyId = "";
      for (const row of vendorPrefixes) {
        if (model.startsWith(row.prefix.toLowerCase())) {
          vendorPartyId = row.vendorPartyId;
          break;
        }
      }
      const vendorGuess = vendorPartyId ? vendorNameById.get(vendorPartyId) ?? vendorPartyId : "";
      return { ...order, vendor_guess: vendorGuess, vendor_guess_id: vendorPartyId } as OrderRow & {
        vendor_guess: string;
        vendor_guess_id: string;
      };
    });
  }, [ordersQuery.data, vendorPrefixes, vendorNameById]);

  const vendorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    ordersWithGuess.forEach((order) => {
      if (order.vendor_guess_id && order.vendor_guess) {
        unique.set(order.vendor_guess_id, order.vendor_guess);
      }
    });
    return Array.from(unique.entries()).map(([value, label]) => ({ value, label }));
  }, [ordersWithGuess]);

  const filteredOrders = useMemo(() => {
    const today = new Date();
    return ordersWithGuess.filter((order) => {
      if (filterStatus && order.status !== filterStatus) return false;
      if (filterCustomer && order.customer_party_id !== filterCustomer) return false;
      if (filterModel) {
        const target = [order.model_name, order.suffix, order.color]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!target.includes(filterModel.toLowerCase())) return false;
      }
      if (filterVendor && order.vendor_guess_id !== filterVendor) return false;
      if (filterPlated === "plated" && !order.is_plated) return false;
      if (filterPlated === "not_plated" && order.is_plated) return false;

      if (filterDue !== "all") {
        const dueDate = normalizeDate(order.requested_due_date ?? null);
        if (!dueDate) return false;
        const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (filterDue === "overdue" && diff >= 0) return false;
        if (filterDue === "7" && diff > 7) return false;
        if (filterDue === "14" && diff > 14) return false;
      }
      return true;
    });
  }, [
    ordersWithGuess,
    filterStatus,
    filterCustomer,
    filterVendor,
    filterModel,
    filterPlated,
    filterDue,
  ]);

  const selectedOrder = useMemo(
    () => ordersWithGuess.find((order) => order.order_line_id === selectedOrderId) ?? null,
    [ordersWithGuess, selectedOrderId]
  );

  const statusOptions = useMemo(() => {
    return (orderStatusQuery.data ?? []).map((row) => row.value ?? "").filter(Boolean);
  }, [orderStatusQuery.data]);

  const priorityOptions = useMemo(() => {
    return (priorityQuery.data ?? []).map((row) => row.value ?? "").filter(Boolean);
  }, [priorityQuery.data]);

  const selectionSummary = useMemo(() => {
    const groups = new Map<string, { name: string; count: number }>();
    selectedOrderIds.forEach((id) => {
      const order = ordersWithGuess.find((row) => row.order_line_id === id);
      if (!order?.customer_party_id) return;
      const name = order.customer_name ?? order.customer_party_id;
      const current = groups.get(order.customer_party_id) ?? { name, count: 0 };
      current.count += 1;
      groups.set(order.customer_party_id, current);
    });
    return Array.from(groups.values());
  }, [ordersWithGuess, selectedOrderIds]);

  const quickIsPlated = quickForm.watch("is_plated");
  const detailIsPlated = detailForm.watch("is_plated");

  const createMutation = useRpcMutation<string>({
    fn: orderUpsertFn,
    successMessage: "생성 완료",
    onSuccess: (orderLineId) => {
      const createdId = String(orderLineId ?? "");
      setHighlightId(createdId || null);
      ordersQuery.refetch();
      if (keepCustomer) {
        const values = quickForm.getValues();
        quickForm.reset({
          ...values,
          model_name: "",
          color: "",
        });
      } else {
        quickForm.reset({ qty: 1, is_plated: false });
        setSelectedCustomer("");
      }
    },
  });

  const updateMutation = useRpcMutation<string>({
    fn: orderUpsertFn,
    successMessage: "저장 완료",
    onSuccess: () => {
      ordersQuery.refetch();
    },
  });

  const statusMutation = useRpcMutation<{ ok: boolean }>({
    fn: CONTRACTS.functions.orderSetStatus,
    successMessage: "상태 변경 완료",
    onSuccess: () => {
      ordersQuery.refetch();
    },
  });

  const shipmentMutation = useRpcMutation<{ ok: boolean }>({
    fn: CONTRACTS.functions.shipmentCreateFromOrders,
    successMessage: "출고 생성 완료",
    onSuccess: () => {
      ordersQuery.refetch();
      setSelectedOrderIds(new Set());
      setShipmentDate("");
      setShipmentMemo("");
      setShipmentModalOpen(false);
    },
  });

  const handleQuickSubmit = quickForm.handleSubmit((values) => {
    if (!canUpsert) {
      toast.error("처리 실패", { description: "주문 등록 RPC(V2)가 필요합니다." });
      return;
    }
    if (!values.customer_party_id) {
      toast.error("입력 오류", { description: "거래처를 선택해 주세요." });
      return;
    }
    if (!values.model_name || !values.suffix || !values.color) {
      toast.error("입력 오류", { description: "모델명/종류/색상은 필수입니다." });
      return;
    }
    if (values.qty && values.qty < 1) {
      toast.error("입력 오류", { description: "수량은 1 이상이어야 합니다." });
      return;
    }
    if (values.is_plated && !values.plating_variant_id) {
      toast.error("입력 오류", { description: "도금 옵션을 선택해 주세요." });
      return;
    }

    const modelNameRaw = values.model_name;

    createMutation.mutate({
      p_customer_party_id: values.customer_party_id,
      p_model_name: normalizeText(values.model_name),
      p_suffix: normalizeText(values.suffix),
      p_color: normalizeText(values.color),
      p_qty: values.qty ?? 1,
      p_size: toNullable(values.size),
      p_is_plated: values.is_plated ?? false,
      p_plating_variant_id: values.is_plated ? values.plating_variant_id ?? null : null,
      p_requested_due_date: values.requested_due_date || null,
      p_priority_code: values.priority_code || null,
      p_source_channel: toNullable(values.source_channel),
      p_model_name_raw: modelNameRaw,
      p_memo: toNullable(values.memo),
      p_order_line_id: null,
    });
  });

  const handleUpdateSubmit = detailForm.handleSubmit((values) => {
    if (!selectedOrder?.order_line_id) {
      toast.error("입력 오류", { description: "편집할 주문을 선택해 주세요." });
      return;
    }
    if (!canUpsert) {
      toast.error("처리 실패", { description: "주문 수정 RPC(V2)가 필요합니다." });
      return;
    }
    if (!values.customer_party_id || !values.model_name || !values.suffix || !values.color) {
      toast.error("입력 오류", { description: "거래처/모델명/종류/색상은 필수입니다." });
      return;
    }
    if (values.qty && values.qty < 1) {
      toast.error("입력 오류", { description: "수량은 1 이상이어야 합니다." });
      return;
    }
    if (values.is_plated && !values.plating_variant_id) {
      toast.error("입력 오류", { description: "도금 옵션을 선택해 주세요." });
      return;
    }

    updateMutation.mutate({
      p_customer_party_id: values.customer_party_id,
      p_model_name: normalizeText(values.model_name),
      p_suffix: normalizeText(values.suffix),
      p_color: normalizeText(values.color),
      p_qty: values.qty ?? 1,
      p_size: toNullable(values.size),
      p_is_plated: values.is_plated ?? false,
      p_plating_variant_id: values.is_plated ? values.plating_variant_id ?? null : null,
      p_requested_due_date: values.requested_due_date || null,
      p_priority_code: values.priority_code || null,
      p_source_channel: toNullable(values.source_channel),
      p_model_name_raw: values.model_name,
      p_memo: toNullable(values.memo),
      p_order_line_id: selectedOrder.order_line_id,
    });
  });

  const handleStatusChange = () => {
    if (!selectedOrder?.order_line_id) {
      toast.error("처리 실패", { description: "주문 라인을 선택해 주세요." });
      return;
    }
    if (!canSetStatus) {
      toast.error("처리 실패", { description: "상태 변경 RPC가 필요합니다." });
      return;
    }
    if (!statusTo) {
      toast.error("입력 오류", { description: "변경할 상태를 선택해 주세요." });
      return;
    }
    if (!actorId) {
      toast.error("처리 실패", { description: "담당자 ID가 필요합니다." });
      return;
    }

    statusMutation.mutate({
      p_order_line_id: selectedOrder.order_line_id,
      p_to_status: statusTo,
      p_actor_person_id: actorId,
      p_reason: toNullable(statusReason),
    });
  };

  const handleShipmentCreate = () => {
    if (!canCreateShipment) {
      toast.error("처리 실패", { description: "출고 생성 RPC가 필요합니다." });
      return;
    }
    if (!actorId) {
      toast.error("처리 실패", { description: "담당자 ID가 필요합니다." });
      return;
    }
    if (selectedOrderIds.size === 0) {
      toast.error("입력 오류", { description: "출고로 보낼 라인을 선택해 주세요." });
      return;
    }
    shipmentMutation.mutate({
      p_order_line_ids: Array.from(selectedOrderIds),
      p_ship_date: shipmentDate || null,
      p_memo: toNullable(shipmentMemo),
      p_actor_person_id: actorId,
    });
  };

  const toggleSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const isLoading =
    customersQuery.isLoading ||
    ordersQuery.isLoading ||
    platingQuery.isLoading ||
    vendorPrefixQuery.isLoading;

  const quickSubmitDisabled = !canUpsert || createMutation.isPending;
  const updateDisabled = !canUpsert || updateMutation.isPending || !selectedOrder;
  const statusDisabled = !canSetStatus || statusMutation.isPending || !selectedOrder;

  useEffect(() => {
    if (!selectedOrder) return;
    setSelectedDetailCustomer(selectedOrder.customer_party_id ?? "");
    setSelectedDetailPlating(selectedOrder.plating_variant_id ?? "");
    detailForm.reset({
      customer_party_id: selectedOrder.customer_party_id ?? "",
      model_name: selectedOrder.model_name ?? "",
      suffix: selectedOrder.suffix ?? "",
      color: selectedOrder.color ?? "",
      qty: selectedOrder.qty ?? 1,
      size: selectedOrder.size ?? "",
      is_plated: selectedOrder.is_plated ?? false,
      plating_variant_id: selectedOrder.plating_variant_id ?? "",
      requested_due_date: selectedOrder.requested_due_date ?? "",
      priority_code: selectedOrder.priority_code ?? "",
      source_channel: selectedOrder.source_channel ?? "",
      memo: selectedOrder.memo ?? "",
    });
  }, [detailForm, selectedOrder]);

  useEffect(() => {
    if (!quickIsPlated) {
      setSelectedPlating("");
      quickForm.setValue("plating_variant_id", "", { shouldDirty: true });
    }
  }, [quickForm, quickIsPlated]);

  useEffect(() => {
    if (!detailIsPlated) {
      setSelectedDetailPlating("");
      detailForm.setValue("plating_variant_id", "", { shouldDirty: true });
    }
  }, [detailForm, detailIsPlated]);

  return (
    <div className="space-y-6" id="orders.root">
      <ActionBar
        title="주문"
        subtitle="주문 라인 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => ordersQuery.refetch()}>
              새로고침
            </Button>
            <Button
              variant="secondary"
              disabled={selectedOrderIds.size === 0}
              onClick={() => setShipmentModalOpen(true)}
            >
              출고 만들기
            </Button>
          </div>
        }
        id="orders.actionBar"
      />
      <Card id="orders.quickCreate">
        <CardHeader>
          <ActionBar title="빠른 주문 입력" subtitle="필수 4개 항목 + 옵션" />
        </CardHeader>
        <CardBody>
          <form className="grid gap-3 lg:grid-cols-3" onSubmit={handleQuickSubmit}>
            <SearchSelect
              label="거래처*"
              placeholder="검색"
              options={customerOptions}
              value={selectedCustomer}
              onChange={(value) => {
                setSelectedCustomer(value);
                quickForm.setValue("customer_party_id", value, { shouldDirty: true });
              }}
            />
            <Input placeholder="모델명*" {...quickForm.register("model_name", { required: true })} />
            <Input placeholder="종류*" {...quickForm.register("suffix", { required: true })} />
            <Input placeholder="색상*" {...quickForm.register("color", { required: true })} />
            <Input type="number" min={1} placeholder="수량" {...quickForm.register("qty", { valueAsNumber: true })} />
            <Input placeholder="사이즈" {...quickForm.register("size")} />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="orders.quick.is_plated"
                className="h-4 w-4 rounded border border-[var(--panel-border)]"
                {...quickForm.register("is_plated")}
              />
              <label htmlFor="orders.quick.is_plated" className="text-sm text-[var(--foreground)]">
                도금 있음
              </label>
            </div>
            <SearchSelect
              label="도금 옵션"
              placeholder={quickIsPlated ? "검색" : "도금 없음"}
              options={platingOptions}
              value={selectedPlating}
              onChange={(value) => {
                if (!quickIsPlated) return;
                setSelectedPlating(value);
                quickForm.setValue("plating_variant_id", value, { shouldDirty: true });
              }}
              className={quickIsPlated ? undefined : "opacity-60"}
            />
            <Input type="date" placeholder="납기" {...quickForm.register("requested_due_date")} />
            <Select {...quickForm.register("priority_code")}>
              <option value="">우선순위</option>
              {priorityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input placeholder="주문 경로" {...quickForm.register("source_channel")} />
            <Textarea placeholder="메모" {...quickForm.register("memo")} />
            <div className="flex items-center justify-between lg:col-span-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="orders.quick.keepCustomer"
                  className="h-4 w-4 rounded border border-[var(--panel-border)]"
                  checked={keepCustomer}
                  onChange={(event) => setKeepCustomer(event.target.checked)}
                />
                <label htmlFor="orders.quick.keepCustomer" className="text-sm text-[var(--muted)]">
                  저장 후 거래처 유지 (모델명/색상만 초기화)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={quickSubmitDisabled || isLoading}>
                  저장
                </Button>
                {!canUpsert ? (
                  <p className="text-xs text-[var(--muted)]">
                    cms 계약의 주문 등록 RPC(V2)가 필요합니다.
                  </p>
                ) : null}
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
      <FilterBar id="orders.filterBar">
        <Input
          placeholder="모델명/색상 검색"
          value={filterModel}
          onChange={(event) => setFilterModel(event.target.value)}
        />
        <Select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
          <option value="">상태</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select value={filterCustomer} onChange={(event) => setFilterCustomer(event.target.value)}>
          <option value="">거래처</option>
          {customerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={filterVendor} onChange={(event) => setFilterVendor(event.target.value)}>
          <option value="">공장 추정</option>
          {vendorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={filterPlated} onChange={(event) => setFilterPlated(event.target.value)}>
          <option value="all">도금 전체</option>
          <option value="plated">도금</option>
          <option value="not_plated">비도금</option>
        </Select>
        <Select value={filterDue} onChange={(event) => setFilterDue(event.target.value)}>
          <option value="all">납기</option>
          <option value="7">7일 이내</option>
          <option value="14">14일 이내</option>
          <option value="overdue">지연</option>
        </Select>
      </FilterBar>
      <div id="orders.body">
        <SplitLayout
          left={
            <div className="space-y-4" id="orders.listPanel">
              <Card id="orders.list">
                <CardHeader>
                  <ActionBar title="주문 리스트" subtitle={`총 ${filteredOrders.length}건`} />
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-[32px_96px_140px_1.5fr_80px_120px_140px_110px_110px_1fr] gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                    <span></span>
                    <span>생성일</span>
                    <span>거래처</span>
                    <span>모델/종류/색상/사이즈</span>
                    <span>수량</span>
                    <span>도금</span>
                    <span>납기/우선</span>
                    <span>상태</span>
                    <span>매칭</span>
                    <span>메모</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {filteredOrders.map((order) => {
                      const orderId = order.order_line_id ?? "";
                      const selected = orderId === selectedOrderId;
                      const isUnmatched = order.match_state === "UNMATCHED";
                      const isHighlighted = highlightId && orderId === highlightId;
                      const platingLabel = order.is_plated
                        ? platingLabelById.get(order.plating_variant_id ?? "") ?? "도금"
                        : "없음";
                      return (
                        <button
                          key={orderId}
                          type="button"
                          className={cn(
                            "grid w-full grid-cols-[32px_96px_140px_1.5fr_80px_120px_140px_110px_110px_1fr] items-center gap-2 rounded-[12px] border border-[var(--panel-border)] px-3 py-2 text-left text-sm",
                            selected ? "bg-[#eef2f6]" : "hover:bg-[#f6f7f9]",
                            isUnmatched ? "border-red-200 bg-red-50/60" : "bg-white",
                            isHighlighted ? "ring-2 ring-emerald-200" : ""
                          )}
                          onClick={() => setSelectedOrderId(orderId)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(orderId)}
                            onChange={() => toggleSelection(orderId)}
                            onClick={(event) => event.stopPropagation()}
                            className="h-4 w-4 rounded border border-[var(--panel-border)]"
                          />
                          <span className="text-xs text-[var(--muted)]">{formatDate(order.created_at)}</span>
                          <span className="text-xs text-[var(--foreground)]">{order.customer_name ?? "-"}</span>
                          <span className="text-xs text-[var(--foreground)]">
                            {order.model_name ?? "-"} / {order.suffix ?? "-"} / {order.color ?? "-"}
                            {order.size ? ` / ${order.size}` : ""}
                          </span>
                          <span className="text-xs text-[var(--foreground)]">{order.qty ?? 0}</span>
                          <span className="text-xs text-[var(--foreground)]">{platingLabel}</span>
                          <span className="text-xs text-[var(--foreground)]">
                            {formatDate(order.requested_due_date)} / {order.priority_code ?? "-"}
                          </span>
                          <span className="text-xs text-[var(--foreground)]">{order.status ?? "-"}</span>
                          <span className="text-xs">
                            {isUnmatched ? <Badge tone="danger">UNMATCHED</Badge> : order.match_state ?? "-"}
                          </span>
                          <span className="text-xs text-[var(--muted)] line-clamp-1">{order.memo ?? "-"}</span>
                        </button>
                      );
                    })}
                    {filteredOrders.length === 0 ? (
                      <p className="text-xs text-[var(--muted)]">주문 데이터 없음</p>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </div>
          }
          right={
            <div className="space-y-4" id="orders.detailPanel">
              <Card id="orders.detail.basic">
                <CardHeader>
                  <ActionBar title="주문 상세" subtitle="선택된 라인 편집" />
                </CardHeader>
                <CardBody>
                  <form className="grid gap-3" onSubmit={handleUpdateSubmit}>
                    <SearchSelect
                      label="거래처*"
                      placeholder="검색"
                      options={customerOptions}
                      value={selectedDetailCustomer}
                      onChange={(value) => {
                        setSelectedDetailCustomer(value);
                        detailForm.setValue("customer_party_id", value, { shouldDirty: true });
                      }}
                    />
                    <Input placeholder="모델명*" {...detailForm.register("model_name", { required: true })} />
                    <Input placeholder="종류*" {...detailForm.register("suffix", { required: true })} />
                    <Input placeholder="색상*" {...detailForm.register("color", { required: true })} />
                    <Input type="number" min={1} placeholder="수량" {...detailForm.register("qty", { valueAsNumber: true })} />
                    <Input placeholder="사이즈" {...detailForm.register("size")} />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="orders.detail.is_plated"
                        className="h-4 w-4 rounded border border-[var(--panel-border)]"
                        {...detailForm.register("is_plated")}
                      />
                      <label htmlFor="orders.detail.is_plated" className="text-sm text-[var(--foreground)]">
                        도금 있음
                      </label>
                    </div>
                    <SearchSelect
                      label="도금 옵션"
                      placeholder={detailIsPlated ? "검색" : "도금 없음"}
                      options={platingOptions}
                      value={selectedDetailPlating}
                      onChange={(value) => {
                        if (!detailIsPlated) return;
                        setSelectedDetailPlating(value);
                        detailForm.setValue("plating_variant_id", value, { shouldDirty: true });
                      }}
                      className={detailIsPlated ? undefined : "opacity-60"}
                    />
                    <Input type="date" placeholder="납기" {...detailForm.register("requested_due_date")} />
                    <Select {...detailForm.register("priority_code")}>
                      <option value="">우선순위</option>
                      {priorityOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                    <Input placeholder="주문 경로" {...detailForm.register("source_channel")} />
                    <Textarea placeholder="메모" {...detailForm.register("memo")} />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateDisabled}>
                        저장
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
              <Card id="orders.detail.status">
                <CardHeader>
                  <ActionBar title="상태 변경" subtitle="상태 변경 이벤트 기록" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <Select value={statusTo} onChange={(event) => setStatusTo(event.target.value)}>
                    <option value="">변경할 상태</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    placeholder="사유 (선택)"
                    value={statusReason}
                    onChange={(event) => setStatusReason(event.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--muted)]">
                      {actorId ? "담당자 ID 설정됨" : "담당자 ID 필요"}
                    </p>
                    <Button type="button" disabled={statusDisabled} onClick={handleStatusChange}>
                      상태 변경
                    </Button>
                  </div>
                </CardBody>
              </Card>
              <Card id="orders.detail.meta">
                <CardHeader>
                  <ActionBar title="매칭 상태" subtitle="매칭 상태 강조" />
                </CardHeader>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted)]">현재 매칭</span>
                    {selectedOrder?.match_state === "UNMATCHED" ? (
                      <Badge tone="danger">UNMATCHED</Badge>
                    ) : (
                      <Badge tone="neutral">{selectedOrder?.match_state ?? "-"}</Badge>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    매칭 상태는 자동 보강되며, UNMATCHED는 우선 확인 대상입니다.
                  </div>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
      <Modal open={shipmentModalOpen} onClose={() => setShipmentModalOpen(false)} title="출고 만들기">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            선택된 라인을 거래처별로 묶어 출고 문서를 생성합니다.
          </p>
          <div className="space-y-2 rounded-[12px] border border-dashed border-[var(--panel-border)] px-4 py-4">
            {selectionSummary.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">선택된 라인이 없습니다.</p>
            ) : (
              selectionSummary.map((group) => (
                <div key={group.name} className="flex items-center justify-between text-sm">
                  <span>{group.name}</span>
                  <span>{group.count}건</span>
                </div>
              ))
            )}
          </div>
          <Input
            type="date"
            placeholder="출고일"
            value={shipmentDate}
            onChange={(event) => setShipmentDate(event.target.value)}
          />
          <Textarea
            placeholder="메모"
            value={shipmentMemo}
            onChange={(event) => setShipmentMemo(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShipmentModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleShipmentCreate} disabled={!canCreateShipment || shipmentMutation.isPending}>
              생성
            </Button>
          </div>
        </div>
      </Modal>
      {!isFnConfigured(enumFn) ? (
        <p className="text-xs text-[var(--muted)]">
          enum 값 조회 RPC가 없어 필터 옵션이 제한됩니다.
        </p>
      ) : null}
      {isLoading ? <p className="text-xs text-[var(--muted)]">데이터 로딩 중...</p> : null}
    </div>
  );
}
