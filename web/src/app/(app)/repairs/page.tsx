"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { readView } from "@/lib/supabase/read";
import { getSchemaClient } from "@/lib/supabase/client";

type RepairRow = {
  repair_line_id: string;
  customer_party_id: string;
  customer_name?: string | null;
  received_at?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  material_code?: string | null;
  qty?: number | null;
  measured_weight_g?: number | null;
  repair_fee_krw?: number | null;
  repair_fee_reason?: string | null;
  issue_desc?: string | null;
  status?: string | null;
  memo?: string | null;
  plating_display_name?: string | null;
  created_at?: string | null;
};

type PartyOption = { label: string; value: string };

type PartyRow = {
  party_id: string;
  name: string;
  party_type?: string | null;
};

type MasterItem = {
  master_item_id?: string | null;
  model_name?: string | null;
  material_code_default?: string | null;
};

type CreateRepairLine = {
  model_name: string;
  material_code?: string | null;
  qty: number;
  issue_desc: string;
  memo?: string | null;
};

const statusOptions = [
  { value: "RECEIVED", label: "접수" },
  { value: "IN_PROGRESS", label: "진행" },
  { value: "READY_TO_SHIP", label: "출고대기" },
  { value: "SHIPPED", label: "출고완료" },
  { value: "CANCELLED", label: "취소" },
];

const statusBadge = (status?: string | null) => {
  const normalized = (status ?? "").trim();
  const map: Record<string, { label: string; tone: "neutral" | "active" | "warning" | "danger" }> = {
    RECEIVED: { label: "접수", tone: "warning" },
    IN_PROGRESS: { label: "진행", tone: "active" },
    READY_TO_SHIP: { label: "출고대기", tone: "active" },
    SHIPPED: { label: "출고완료", tone: "neutral" },
    CANCELLED: { label: "취소", tone: "danger" },
  };
  return map[normalized] ?? { label: normalized || "-", tone: "neutral" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
};

export default function RepairsPage() {
  const schemaClient = getSchemaClient();
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [issueDesc, setIssueDesc] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const [extraFee, setExtraFee] = useState<string>("0");
  const [extraFeeReason, setExtraFeeReason] = useState<string>("");
  const extraFeeValue = Number(extraFee);
  const requiresReason = Number.isFinite(extraFeeValue) && extraFeeValue > 0;

  const repairsQuery = useQuery({
    queryKey: ["repairs"],
    queryFn: async () =>
      readView<RepairRow>(CONTRACTS.views.repairLineEnriched, 200, {
        orderBy: { column: "received_at", ascending: false },
      }),
    enabled: true,
  });

  const partiesQuery = useQuery({
    queryKey: ["repair-parties"],
    queryFn: async () => {
      if (!schemaClient) return [] as PartyOption[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as PartyRow[] | null | undefined ?? [])
        .filter((row) => row.party_type === "customer")
        .map((row) => ({ label: row.name, value: row.party_id }));
    },
    enabled: Boolean(schemaClient),
  });

  const masterQuery = useQuery({
    queryKey: ["repair-master-items"],
    queryFn: async () =>
      readView<MasterItem>(CONTRACTS.views.masterItemLookup, 20000, {
        orderBy: { column: "model_name", ascending: true },
      }),
    enabled: true,
  });

  const masterOptions = useMemo(() => {
    const rows = masterQuery.data ?? [];
    return rows
      .filter((row) => row.master_item_id && row.model_name)
      .map((row) => ({ label: String(row.model_name), value: String(row.master_item_id) }));
  }, [masterQuery.data]);

  const selectedMaster = useMemo(
    () => (masterQuery.data ?? []).find((row) => String(row.master_item_id) === selectedModelId),
    [masterQuery.data, selectedModelId]
  );

  const filteredRepairs = useMemo(() => {
    const rows = repairsQuery.data ?? [];
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (partyFilter && row.customer_party_id !== partyFilter) return false;
      if (modelFilter) {
        const needle = modelFilter.trim().toLowerCase();
        if (!needle) return true;
        const name = String(row.model_name ?? "").toLowerCase();
        if (!name.includes(needle)) return false;
      }
      return true;
    });
  }, [repairsQuery.data, statusFilter, partyFilter, modelFilter]);

  const selectedRepair = useMemo(
    () => filteredRepairs.find((row) => row.repair_line_id === selectedRepairId) ?? filteredRepairs[0] ?? null,
    [filteredRepairs, selectedRepairId]
  );

  const createRepairMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.repairCreate,
    successMessage: "수리 접수 완료",
    onSuccess: (repairId) => {
      setCreateOpen(false);
      setSelectedRepairId(String(repairId));
      setSelectedPartyId("");
      setSelectedModelId("");
      setIssueDesc("");
      setMemo("");
      setQty(1);
      repairsQuery.refetch();
    },
  });

  const statusMutation = useRpcMutation<void>({
    fn: CONTRACTS.functions.repairSetStatus,
    successMessage: "상태 변경 완료",
    onSuccess: () => repairsQuery.refetch(),
  });

  const sendToShipmentMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.repairSendToShipment,
    successMessage: "출고 전환 완료",
    onSuccess: () => {
      setSendOpen(false);
      setExtraFee("0");
      setExtraFeeReason("");
      repairsQuery.refetch();
    },
  });

  const handleCreate = async () => {
    const partyId = selectedPartyId;
    const modelName = selectedMaster?.model_name ? String(selectedMaster.model_name) : "";
    if (!partyId || !modelName || !issueDesc.trim()) return;

    const line: CreateRepairLine = {
      model_name: modelName,
      material_code: selectedMaster?.material_code_default ?? null,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      issue_desc: issueDesc.trim(),
      memo: memo.trim() || null,
    };

    await createRepairMutation.mutateAsync({
      p_party_id: partyId,
      p_notes: memo.trim() || null,
      p_lines: [line],
    });
  };

  const handleSetStatus = async (nextStatus: string) => {
    if (!selectedRepair) return;
    await statusMutation.mutateAsync({
      p_repair_id: selectedRepair.repair_line_id,
      p_status: nextStatus,
      p_reason: null,
    });
  };

  const handleSendToShipment = async () => {
    if (!selectedRepair) return;
    const feeValue = Number(extraFee);
    const reason = extraFeeReason.trim();
    await sendToShipmentMutation.mutateAsync({
      p_repair_id: selectedRepair.repair_line_id,
      p_extra_fee_krw: Number.isFinite(feeValue) ? feeValue : 0,
      p_extra_fee_reason: reason || null,
      p_note: "send repair to shipment",
    });
  };

  const partyOptions = partiesQuery.data ?? [];

  return (
    <div className="space-y-6" id="repairs.root">
      <ActionBar
        title="수리"
        subtitle="수리 접수 및 출고 전환"
        actions={
          <Button onClick={() => setCreateOpen(true)} id="repairs.action.new">
            수리 접수
          </Button>
        }
        id="repairs.actionBar"
      />
      <FilterBar id="repairs.filterBar">
        <Input
          placeholder="모델명 검색"
          value={modelFilter}
          onChange={(event) => setModelFilter(event.target.value)}
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">상태</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)}>
          <option value="">거래처</option>
          {partyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterBar>
      <div id="repairs.body">
        <SplitLayout
          left={
            <div className="space-y-3" id="repairs.listPanel">
              {(filteredRepairs ?? []).map((repair) => {
                const badge = statusBadge(repair.status);
                return (
                  <button
                    type="button"
                    key={repair.repair_line_id}
                    onClick={() => setSelectedRepairId(repair.repair_line_id)}
                  >
                    <ListCard
                      title={repair.customer_name ?? "거래처"}
                      subtitle={`${repair.model_name ?? "-"} · ${repair.qty ?? 0}개`}
                      meta={formatDate(repair.received_at)}
                      badge={{ label: badge.label, tone: badge.tone }}
                      selected={repair.repair_line_id === selectedRepair?.repair_line_id}
                    />
                  </button>
                );
              })}
              {filteredRepairs.length === 0 ? (
                <Card className="border-dashed text-center text-sm text-[var(--muted)] py-10">
                  접수된 수리가 없습니다.
                </Card>
              ) : null}
            </div>
          }
          right={
            <div id="repairs.detailPanel">
              <Card id="repairs.detail.basic">
                <CardHeader>
                  <ActionBar title="수리 상세" />
                </CardHeader>
                <CardBody className="space-y-4">
                  {!selectedRepair ? (
                    <p className="text-sm text-[var(--muted)]">수리를 선택하세요.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold">{selectedRepair.model_name ?? "-"}</div>
                          <div className="text-sm text-[var(--muted)]">{selectedRepair.customer_name ?? "-"}</div>
                        </div>
                        <Badge tone={statusBadge(selectedRepair.status).tone}>
                          {statusBadge(selectedRepair.status).label}
                        </Badge>
                      </div>

                      <div className="grid gap-3 text-sm text-[var(--muted)]">
                        <div>접수일: {formatDate(selectedRepair.received_at)}</div>
                        <div>수량: {selectedRepair.qty ?? 0}</div>
                        <div>증상: {selectedRepair.issue_desc ?? "-"}</div>
                        <div>메모: {selectedRepair.memo ?? "-"}</div>
                        {selectedRepair.repair_fee_krw ? (
                          <div>
                            추가수리비: ₩{Number(selectedRepair.repair_fee_krw).toLocaleString()}
                            {selectedRepair.repair_fee_reason ? ` (${selectedRepair.repair_fee_reason})` : ""}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => handleSetStatus("IN_PROGRESS")}
                          disabled={statusMutation.isPending || selectedRepair.status === "IN_PROGRESS"}
                        >
                          진행 처리
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleSetStatus("READY_TO_SHIP")}
                          disabled={statusMutation.isPending || selectedRepair.status === "READY_TO_SHIP"}
                        >
                          수리 완료 처리
                        </Button>
                        <Button onClick={() => setSendOpen(true)} disabled={sendToShipmentMutation.isPending}>
                          출고로 보내기
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="수리 접수">
        <div className="space-y-4">
          <SearchSelect
            label="거래처*"
            placeholder="거래처 검색"
            options={partyOptions}
            value={selectedPartyId}
            onChange={(value) => setSelectedPartyId(value)}
          />
          <SearchSelect
            label="모델*"
            placeholder="모델 검색"
            options={masterOptions}
            value={selectedModelId}
            onChange={(value) => setSelectedModelId(value)}
          />
          <Input
            placeholder="증상/요청사항*"
            value={issueDesc}
            onChange={(event) => setIssueDesc(event.target.value)}
          />
          <Input
            type="number"
            min={1}
            placeholder="수량"
            value={qty}
            onChange={(event) => setQty(Number(event.target.value) || 1)}
          />
          <Textarea
            placeholder="메모"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createRepairMutation.isPending ||
                !selectedPartyId ||
                !selectedModelId ||
                !issueDesc.trim()
              }
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="출고로 보내기">
        <div className="space-y-4">
          <Input
            type="number"
            min={0}
            placeholder="추가 수리비 (원)"
            value={extraFee}
            onChange={(event) => setExtraFee(event.target.value)}
          />
          <Textarea
            placeholder="추가 수리비 사유 (수리비가 있으면 필수)"
            value={extraFeeReason}
            onChange={(event) => setExtraFeeReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSendOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSendToShipment}
              disabled={sendToShipmentMutation.isPending || (requiresReason && !extraFeeReason.trim())}
            >
              출고 전환
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
