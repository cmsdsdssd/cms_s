"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";

// ===================== TYPES =====================
type RepairLine = {
  repair_line_id: string;
  customer_party_id: string;
  customer_name: string;
  received_at: string;
  model_name: string;
  model_name_raw?: string;
  suffix: string;
  color: string;
  material_code?: string;
  qty: number;
  measured_weight_g?: number;
  is_plated: boolean;
  plating_variant_id?: string;
  plating_code?: string;
  plating_display_name?: string;
  repair_fee_krw?: number;
  requested_due_date?: string;
  priority_code?: string;
  status: string;
  memo?: string;
  source_channel?: string;
  created_at: string;
  updated_at: string;
};

type RepairForm = {
  customer_party_id: string;
  customer_name: string;
  received_at: string;
  model_name: string;
  model_name_raw?: string;
  suffix: string;
  color: string;
  material_code?: string;
  qty: number;
  weight_received_g?: number;
  is_plated: boolean;
  plating_variant_id?: string;
  repair_fee_krw?: number;
  requested_due_date?: string;
  priority_code?: string;
  memo?: string;
  source_channel?: string;
};

type PartyOption = { party_id: string; name: string };
type ModelOption = { model_name: string; suffix: string; color: string; material_code?: string };
type PlatingOption = { plating_variant_id: string; plating_code: string; display_name: string };

// ===================== CONSTANTS =====================
const STATUS_OPTIONS = [
  { value: "RECEIVED", label: "접수" },
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "READY_TO_SHIP", label: "출고준비" },
  { value: "SHIPPED", label: "출고완료" },
  { value: "CANCELLED", label: "취소" },
  { value: "CLOSED", label: "마감" },
];

const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "일반" },
  { value: "URGENT", label: "긴급" },
  { value: "VVIP", label: "VVIP" },
];

const MATERIAL_OPTIONS = [
  { value: "14", label: "14K" },
  { value: "18", label: "18K" },
  { value: "24", label: "24K" },
  { value: "925", label: "925" },
  { value: "00", label: "기타" },
];

const LOCKED_STATUSES = ["SHIPPED", "CANCELLED"];

// ===================== SEARCHABLE DROPDOWN =====================
function SearchableDropdown<T extends { label: string; value: string }>({
  label,
  placeholder,
  value,
  displayValue,
  onSearch,
  onSelect,
  options,
  loading,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  displayValue: string;
  onSearch: (query: string) => void;
  onSelect: (option: T) => void;
  options: T[];
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(displayValue);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(displayValue);
  }, [displayValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-1 relative" ref={ref}>
      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</label>
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          onSearch(inputValue);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-2 text-xs text-gray-400">로딩 중...</div>
          ) : options.length === 0 ? (
            <div className="p-2 text-xs text-gray-400">결과 없음</div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.value}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-blue-50",
                  value === opt.value && "bg-blue-100"
                )}
                onClick={() => {
                  onSelect(opt);
                  setInputValue(opt.label);
                  setOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function RepairsPage() {
  const [repairs, setRepairs] = useState<RepairLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterKeyword, setFilterKeyword] = useState<string>("");
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");

  // Customer dropdown
  const [customerOptions, setCustomerOptions] = useState<PartyOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

  // Model dropdown
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState("");

  // Plating options
  const [platingOptions, setPlatingOptions] = useState<PlatingOption[]>([]);

  const form = useForm<RepairForm>({
    defaultValues: {
      received_at: new Date().toISOString().split("T")[0],
      qty: 1,
      is_plated: false,
      priority_code: "NORMAL",
    },
  });

  const selectedRepair = useMemo(
    () => repairs.find((r) => r.repair_line_id === selectedId) ?? null,
    [repairs, selectedId]
  );

  const isLocked = useMemo(
    () => selectedRepair && LOCKED_STATUSES.includes(selectedRepair.status),
    [selectedRepair]
  );

  const watchedCustomerId = form.watch("customer_party_id");

  // ===================== FETCH REPAIRS =====================
  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPriority) params.set("priority", filterPriority);
      if (filterKeyword) params.set("keyword", filterKeyword);
      if (filterFromDate) params.set("from_date", filterFromDate);
      if (filterToDate) params.set("to_date", filterToDate);

      const res = await fetch(`/api/repairs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch repairs");
      const data = await res.json();
      setRepairs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterKeyword, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  // ===================== FETCH PLATING OPTIONS =====================
  useEffect(() => {
    async function fetchPlatingOptions() {
      try {
        const res = await fetch("/api/plating-options");
        if (res.ok) {
          const data = await res.json();
          setPlatingOptions(data);
        }
      } catch {
        // silent
      }
    }
    fetchPlatingOptions();
  }, []);

  // ===================== FETCH CUSTOMERS =====================
  const fetchCustomers = useCallback(async (keyword: string) => {
    setCustomerLoading(true);
    try {
      const res = await fetch(`/api/parties?type=customer&keyword=${encodeURIComponent(keyword)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerOptions(data.map((p: PartyOption) => ({ ...p })));
      }
    } catch {
      // silent
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  // ===================== FETCH MODELS =====================
  const fetchModels = useCallback(async (customerId: string, keyword: string) => {
    if (!customerId) {
      setModelOptions([]);
      return;
    }
    setModelLoading(true);
    try {
      const res = await fetch(`/api/shipped-models?customer_party_id=${customerId}&keyword=${encodeURIComponent(keyword)}`);
      if (res.ok) {
        const data = await res.json();
        setModelOptions(data);
      }
    } catch {
      // silent
    } finally {
      setModelLoading(false);
    }
  }, []);

  // ===================== POPULATE FORM =====================
  useEffect(() => {
    if (selectedRepair) {
      form.reset({
        customer_party_id: selectedRepair.customer_party_id,
        customer_name: selectedRepair.customer_name,
        received_at: selectedRepair.received_at,
        model_name: selectedRepair.model_name,
        model_name_raw: selectedRepair.model_name_raw ?? "",
        suffix: selectedRepair.suffix,
        color: selectedRepair.color,
        material_code: selectedRepair.material_code ?? "",
        qty: selectedRepair.qty,
        weight_received_g: selectedRepair.measured_weight_g ?? undefined,
        is_plated: selectedRepair.is_plated,
        plating_variant_id: selectedRepair.plating_variant_id ?? "",
        repair_fee_krw: selectedRepair.repair_fee_krw ?? undefined,
        requested_due_date: selectedRepair.requested_due_date ?? "",
        priority_code: selectedRepair.priority_code ?? "NORMAL",
        memo: selectedRepair.memo ?? "",
        source_channel: selectedRepair.source_channel ?? "",
      });
      setSelectedCustomerName(selectedRepair.customer_name);
      setSelectedModelName(selectedRepair.model_name);
    }
  }, [selectedRepair, form]);

  // ===================== MUTATION =====================
  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.repairUpsertV2,
    successMessage: "저장 완료",
    onSuccess: () => {
      fetchRepairs();
    },
  });

  const canSave = isFnConfigured(CONTRACTS.functions.repairUpsertV2);
  const isPlated = form.watch("is_plated");

  // ===================== SUBMIT =====================
  const onSubmit = (values: RepairForm) => {
    if (values.is_plated && !values.plating_variant_id) {
      form.setError("plating_variant_id", { message: "도금 옵션을 선택해주세요." });
      return;
    }

    mutation.mutate({
      p_customer_party_id: values.customer_party_id,
      p_received_at: values.received_at,
      p_model_name: values.model_name?.trim() ?? null,
      p_model_name_raw: values.model_name_raw?.trim() ?? null,
      p_suffix: values.suffix?.trim() ?? null,
      p_color: values.color?.trim() ?? null,
      p_material_code: values.material_code || null,
      p_qty: values.qty ?? 1,
      p_weight_received_g: values.weight_received_g ?? null,
      p_is_plated: values.is_plated ?? false,
      p_plating_variant_id: values.plating_variant_id || null,
      p_repair_fee_krw: values.repair_fee_krw ?? null,
      p_priority_code: values.priority_code || "NORMAL",
      p_requested_due_date: values.requested_due_date || null,
      p_source_channel: values.source_channel || null,
      p_repair_line_id: selectedId ?? null,
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const labels: Record<string, string> = {
    RECEIVED: "접수",
    IN_PROGRESS: "진행",
    READY_TO_SHIP: "준비",
    SHIPPED: "출고",
    CANCELLED: "취소",
    CLOSED: "마감",
  };

  // ===================== RENDER =====================
  return (
    <div className="space-y-6" id="repairs.root">
      {/* Header */}
      <ActionBar
        title="수리 관리"
        subtitle="수리 접수 / 진행 / 출고"
        actions={
          <Button
            onClick={() => {
              setSelectedId(null);
              form.reset({
                received_at: new Date().toISOString().split("T")[0],
                qty: 1,
                is_plated: false,
                priority_code: "NORMAL",
              });
              setSelectedCustomerName("");
              setSelectedModelName("");
            }}
          >
            + 신규 접수
          </Button>
        }
      />

      {/* Filter Bar */}
      <FilterBar>
        <Input
          type="date"
          className="w-32"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
        />
        <span className="text-[var(--muted)]">~</span>
        <Input
          type="date"
          className="w-32"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
        />
        <Select className="w-24" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">상태</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <Select className="w-24" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">우선</option>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <Input
          placeholder="모델/메모 검색"
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
        />
        <Button variant="secondary" onClick={fetchRepairs}>
          조회
        </Button>
      </FilterBar>

      {/* Body: Split Layout */}
      <SplitLayout
        left={
          <div className="space-y-4">
            {/* List Panel */}
            <div className="space-y-3">
              {loading ? (
                <Card>
                  <CardBody><p className="text-sm text-[var(--muted)]">로딩 중...</p></CardBody>
                </Card>
              ) : error ? (
                <Card>
                  <CardBody><p className="text-sm text-red-500">{error}</p></CardBody>
                </Card>
              ) : repairs.length === 0 ? (
                <Card>
                  <CardBody><p className="text-sm text-[var(--muted)]">수리 내역이 없습니다.</p></CardBody>
                </Card>
              ) : (
                repairs.map((repair) => {
                  const badgeTone = repair.status === 'RECEIVED' ? 'neutral' : repair.status === 'SHIPPED' ? 'active' : 'neutral';
                  return (
                    <button
                      key={repair.repair_line_id}
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedId(repair.repair_line_id)}
                    >
                      <ListCard
                        title={`${repair.model_name} (${repair.suffix})`}
                        subtitle={`${repair.customer_name} · ${repair.color}`}
                        meta={`${repair.received_at} · 수량 ${repair.qty}`}
                        badge={{ label: labels[repair.status] ?? repair.status, tone: badgeTone }}
                        selected={selectedId === repair.repair_line_id}
                        right={
                          repair.priority_code !== 'NORMAL' ? (
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded font-bold border",
                              repair.priority_code === 'URGENT' ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-purple-100 text-purple-700 border-purple-200"
                            )}>
                              {repair.priority_code}
                            </span>
                          ) : null
                        }
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <ActionBar title={selectedId ? "수리 상세" : "신규 수리 접수"} />
                  {isLocked && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200">
                      수정 불가
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <fieldset disabled={isLocked ?? false} className="space-y-4">
                    {/* Row 1 */}
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableDropdown
                        label="거래처 *"
                        placeholder="거래처 검색"
                        value={form.watch("customer_party_id")}
                        displayValue={selectedCustomerName}
                        onSearch={(q) => fetchCustomers(q)}
                        onSelect={(opt) => {
                          form.setValue("customer_party_id", opt.value);
                          form.setValue("customer_name", opt.label);
                          setSelectedCustomerName(opt.label);
                          form.setValue("model_name", "");
                          form.setValue("suffix", "");
                          form.setValue("color", "");
                          setSelectedModelName("");
                          setModelOptions([]);
                        }}
                        options={customerOptions.map((c) => ({ value: c.party_id, label: c.name }))}
                        loading={customerLoading}
                        disabled={isLocked ?? false}
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">접수일 *</label>
                        <Input type="date" {...form.register("received_at", { required: true })} />
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableDropdown
                        label="모델명 *"
                        placeholder="모델명 검색"
                        value={form.watch("model_name")}
                        displayValue={selectedModelName}
                        onSearch={(q) => fetchModels(watchedCustomerId, q)}
                        onSelect={(opt) => {
                          const model = modelOptions.find(m => m.model_name === opt.value);
                          if (model) {
                            form.setValue("model_name", model.model_name);
                            form.setValue("suffix", model.suffix);
                            form.setValue("color", model.color);
                            form.setValue("material_code", model.material_code ?? "");
                            setSelectedModelName(model.model_name);
                          }
                        }}
                        options={modelOptions.map((m) => ({ value: m.model_name, label: `${m.model_name} (${m.suffix})` }))}
                        loading={modelLoading}
                        disabled={(isLocked ?? false) || !watchedCustomerId}
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">종류</label>
                        <Input {...form.register("suffix")} readOnly className="bg-[var(--chip)]" placeholder="자동 입력" />
                      </div>
                    </div>

                    {/* Row 3 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">색상 *</label>
                        <Input {...form.register("color", { required: true })} placeholder="G, W, PG..." />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">재질</label>
                        <Select {...form.register("material_code")}>
                          <option value="">선택</option>
                          {MATERIAL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Row 4 */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수량 *</label>
                        <Input type="number" min={1} {...form.register("qty", { required: true, valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">중량 (g)</label>
                        <Input type="number" step="0.01" {...form.register("weight_received_g", { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수리비 (₩)</label>
                        <Input type="number" {...form.register("repair_fee_krw", { valueAsNumber: true })} />
                      </div>
                    </div>

                    {/* Row 5 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">도금</label>
                        <div className="flex items-center gap-2 h-10">
                          <Controller
                            control={form.control}
                            name="is_plated"
                            render={({ field }) => (
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="w-4 h-4"
                              />
                            )}
                          />
                          <span className="text-sm text-[var(--muted)]">도금 필요</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          도금 색상 {isPlated && "*"}
                        </label>
                        <Select
                          {...form.register("plating_variant_id")}
                          className={cn(!isPlated && "bg-[var(--chip)]")}
                          disabled={!isPlated}
                        >
                          <option value="">선택</option>
                          {platingOptions.map((opt) => (
                            <option key={opt.plating_variant_id} value={opt.plating_variant_id}>
                              {opt.display_name}
                            </option>
                          ))}
                        </Select>
                        {form.formState.errors.plating_variant_id && (
                          <p className="text-[10px] text-red-500">{form.formState.errors.plating_variant_id.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 6 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">요청 납기</label>
                        <Input type="date" {...form.register("requested_due_date")} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">우선순위</label>
                        <Select {...form.register("priority_code")}>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Row 7 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">메모</label>
                      <Textarea {...form.register("memo")} placeholder="수리 관련 메모" rows={3} />
                    </div>

                    {/* Row 8 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">접수 채널</label>
                      <Input {...form.register("source_channel")} placeholder="전화, 방문, 카톡 등" />
                    </div>
                  </fieldset>

                  <div className="flex items-center justify-between pt-4 border-t border-[var(--panel-border)]">
                    <div>
                      {selectedId && !isLocked && (
                        <Button type="button" variant="secondary" className="h-9 px-4">
                          출고에 담기
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {!canSave && (
                        <span className="text-xs text-orange-500">RPC 미설정</span>
                      )}
                      <Button
                        type="submit"
                        disabled={!canSave || mutation.isPending || isLocked}
                      >
                        {mutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        }
      />
    </div>
  );
}
