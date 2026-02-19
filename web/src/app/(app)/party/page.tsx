"use client";

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner"; // for toast error
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarInput,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { SplitLayout } from "@/components/layout/split-layout";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { fetchParties, fetchPartyDetail } from "@/lib/api/cmsParty";
import { PartyList } from "@/components/party/PartyList";
import { PartyDetail } from "@/components/party/PartyDetail";
import type { PartyForm } from "@/components/party/types";
import {
  applyVendorImmediateSettleTag,
  hasVendorImmediateSettleTag,
  stripVendorImmediateSettleTag,
} from "@/lib/vendor-immediate-settle";
import {
  applyVendorNoFactoryReceiptTag,
  hasVendorNoFactoryReceiptTag,
  stripVendorNoFactoryReceiptTag,
} from "@/lib/vendor-no-factory-receipt";

function PartyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => getSchemaClient(), []);

  const typeFilter = useMemo(() => {
    const type = searchParams.get("type");
    return type === "customer" || type === "vendor" ? type : "customer";
  }, [searchParams]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "address" | "contact" | "prefix">("basic");

  const handleTypeChange = (nextType: string) => {
    if (nextType !== "customer" && nextType !== "vendor") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", nextType);
    router.replace(`/party?${params.toString()}`);
    setPage(1);
    setSelectedPartyId(null);
    setActiveTab("basic");
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // List Query (with higher pageSize for sidebar scroll)
  const { data: listData, isLoading: isListLoading, error: listError } = useQuery({
    queryKey: ["cms", "parties", typeFilter, activeOnly, debouncedSearch, regionFilter, page],
    queryFn: () =>
      fetchParties({
        type: typeFilter,
        activeOnly,
        search: debouncedSearch,
        region: regionFilter || undefined,
        page,
        pageSize: 100, // Load more for scrolling list
      }),
  });

  const effectiveSelectedPartyId = selectedPartyId ?? listData?.data?.[0]?.party_id ?? null;

  // Detail Query
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ["cms", "party", effectiveSelectedPartyId],
    queryFn: () => fetchPartyDetail(effectiveSelectedPartyId!),
    enabled: !!effectiveSelectedPartyId && effectiveSelectedPartyId !== "new",
  });

  const form = useForm<PartyForm>({
    defaultValues: {
      party_type: "customer",
      vendor_immediate_settle: false,
      is_active: true,
    },
  });

  // Reset form when selection changes
  useEffect(() => {
    if (effectiveSelectedPartyId === "new") {
      form.reset({
        party_type: typeFilter,
        name: "",
        phone: "",
        region: "",
        address: "",
        note: "",
        vendor_immediate_settle: false,
        is_active: true,
        mask_code: "",
        prefix: "",
      });
    } else if (detailData) {
      const isVendor = detailData.party_type === "vendor";
      form.reset({
        party_type: detailData.party_type,
        name: detailData.name,
        phone: detailData.phone ?? "",
        region: detailData.region ?? "",
        address: detailData.address ?? "",
        note: stripVendorNoFactoryReceiptTag(stripVendorImmediateSettleTag(detailData.note)),
        vendor_immediate_settle: isVendor ? hasVendorImmediateSettleTag(detailData.note) : false,
        is_active: detailData.is_active,
        mask_code: detailData.mask_code ?? "",
        prefix: detailData.prefixes?.[0]?.prefix ?? "",
      });
    }
  }, [effectiveSelectedPartyId, detailData, form, typeFilter]);

  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.partyUpsert,
    successMessage: "저장 완료",
    onSuccess: async (partyId, variables) => {
      if (form.getValues("party_type") === "vendor") {
        const prefix = form.getValues("prefix")?.trim();
        if (prefix) {
          const { error } = await supabase.rpc(CONTRACTS.functions.upsertVendorPrefix, {
            p_vendor_party_id: partyId,
            p_prefix: prefix,
            p_note: "Created via Basic Info"
          });

          if (error) {
            toast.error(`Prefix 저장 실패: ${error.message}`);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["cms", "parties"] });
      queryClient.invalidateQueries({ queryKey: ["cms", "party", partyId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-parties"] });
      if (selectedPartyId === "new") {
        setSelectedPartyId(partyId);
      }
    },
  });

  const canSave = isFnConfigured(CONTRACTS.functions.partyUpsert);

  const handleCreate = () => {
    setSelectedPartyId("new");
    setActiveTab("basic");
  };

  const onSubmit = (values: PartyForm) => {
    const cleanNote = values.note ?? "";
    const enabled = values.party_type === "vendor" && Boolean(values.vendor_immediate_settle);
    const noFactoryReceiptEnabled = values.party_type === "vendor" && hasVendorNoFactoryReceiptTag(detailData?.note);
    let memo = applyVendorImmediateSettleTag(cleanNote, enabled);
    memo = applyVendorNoFactoryReceiptTag(memo, noFactoryReceiptEnabled);

    mutation.mutate({
      p_party_type: values.party_type,
      p_name: values.name,
      p_phone: values.phone || null,
      p_region: values.region || null,
      p_address: values.address || null,
      p_memo: memo || null,
      p_party_id: effectiveSelectedPartyId === "new" ? null : effectiveSelectedPartyId,
      p_is_active: values.is_active,
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-[var(--background)]" id="party.root">
      {/* Sidebar (List & Search) */}
      <div className="w-full md:w-80 flex flex-col border-r border-[var(--panel-border)] bg-[var(--surface)] shrink-0">
        <div className="p-4 border-b border-[var(--panel-border)] shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">거래처 관리</h2>
            <ToolbarButton onClick={handleCreate} size="sm" variant="primary" className="h-8 text-xs">+ 추가</ToolbarButton>
          </div>

          <div className="space-y-2">
            <ToolbarInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="이름 검색..."
              className="w-full h-9"
            />
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="flex-1 h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                <option value="customer">고객 (Customer)</option>
                <option value="vendor">공장 (Vendor)</option>
              </select>
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setPage(1);
                  setSelectedPartyId(null);
                  setActiveTab("basic");
                }}
                className="w-20 h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                <option value="">전체지역</option>
                <option value="서울">서울</option>
                <option value="부산">부산</option>
                <option value="대구">대구</option>
                <option value="인천">인천</option>
                <option value="광주">광주</option>
                <option value="대전">대전</option>
                <option value="울산">울산</option>
                <option value="세종">세종</option>
                <option value="경기">경기</option>
                <option value="강원">강원</option>
                <option value="충북">충북</option>
                <option value="충남">충남</option>
                <option value="전북">전북</option>
                <option value="전남">전남</option>
                <option value="경북">경북</option>
                <option value="경남">경남</option>
                <option value="제주">제주</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="rounded border-gray-300" />
                <span>활성 거래처만 보기</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <PartyList
            parties={listData?.data ?? []}
            isLoading={isListLoading}
            error={listError as Error}
            selectedPartyId={effectiveSelectedPartyId}
            page={page}
            totalCount={listData?.count}
            onSelect={setSelectedPartyId}
            onPageChange={setPage}
            pageSize={100} // pass pageSize prop
          />
        </div>
      </div>

      {/* Main Content (Detail) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <PartyDetail
            key={effectiveSelectedPartyId || "none"}
            selectedPartyId={effectiveSelectedPartyId}
            detail={detailData}
            isLoading={isDetailLoading}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            form={form}
            canSave={canSave}
            isSaving={mutation.isPending}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

export default function PartyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)] px-6 py-6 text-sm text-[var(--muted)]">로딩 중...</div>}>
      <PartyPageContent />
    </Suspense>
  );
}
