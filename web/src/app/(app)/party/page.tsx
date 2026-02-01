"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarInput,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { SplitLayout } from "@/components/layout/split-layout";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { fetchParties, fetchPartyDetail } from "@/lib/api/cmsParty";
import { PartyList } from "@/components/party/PartyList";
import { PartyDetail } from "@/components/party/PartyDetail";
import type { PartyForm } from "@/components/party/types";

function PartyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
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

  // List Query
  const { data: listData, isLoading: isListLoading, error: listError } = useQuery({
    queryKey: ["cms", "parties", typeFilter, activeOnly, debouncedSearch, regionFilter, page],
    queryFn: () =>
      fetchParties({
        type: typeFilter,
        activeOnly,
        search: debouncedSearch,
        region: regionFilter || undefined,
        page,
        pageSize: 50,
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
        is_active: true,
      });
    } else if (detailData) {
      form.reset({
        party_type: detailData.party_type,
        name: detailData.name,
        phone: detailData.phone ?? "",
        region: detailData.region ?? "",
        address: detailData.address ?? "",
        note: detailData.note ?? "",
        is_active: detailData.is_active,
      });
    }
  }, [effectiveSelectedPartyId, detailData, form, typeFilter]);

  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.partyUpsert,
    successMessage: "저장 완료",
    onSuccess: (partyId) => {
      queryClient.invalidateQueries({ queryKey: ["cms", "parties"] });
      queryClient.invalidateQueries({ queryKey: ["cms", "party", partyId] });
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
    mutation.mutate({
      p_party_type: values.party_type,
      p_name: values.name,
      p_phone: values.phone || null,
      p_region: values.region || null,
      p_address: values.address || null,
      p_memo: values.note || null,
      p_party_id: effectiveSelectedPartyId === "new" ? null : effectiveSelectedPartyId,
      p_is_active: values.is_active,
    });
  };

  return (
    <div className="space-y-3" id="party.root">
      {/* Unified Toolbar - Compact Header */}
      <UnifiedToolbar
        title="거래처관리"
        actions={<ToolbarButton onClick={handleCreate}>+ 거래처 추가</ToolbarButton>}
      >
        <ToolbarSelect
          value={typeFilter}
          onChange={handleTypeChange}
          className="w-24"
        >
          <option value="customer">고객</option>
          <option value="vendor">공장</option>
        </ToolbarSelect>

        <ToolbarInput
          value={regionFilter}
          onChange={(value) => {
            setRegionFilter(value);
            setPage(1);
            setSelectedPartyId(null);
            setActiveTab("basic");
          }}
          placeholder="지역"
          className="w-20"
        />

        <ToolbarSelect
          value={activeOnly ? "active" : "all"}
          onChange={(value) => {
            setActiveOnly(value === "active");
            setPage(1);
            setSelectedPartyId(null);
            setActiveTab("basic");
          }}
          className="w-24"
        >
          <option value="active">활성만</option>
          <option value="all">전체</option>
        </ToolbarSelect>

        <div className="w-px h-6 bg-[var(--hairline)] mx-1" />

        <ToolbarInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="이름 검색"
          className="w-32 md:w-40"
        />
      </UnifiedToolbar>

      {/* Content Area */}
      <div className="px-4" id="party.body">
        <SplitLayout
          className="pt-1"
          left={
            <PartyList
              parties={listData?.data ?? []}
              isLoading={isListLoading}
              error={listError as Error}
              selectedPartyId={effectiveSelectedPartyId}
              page={page}
              totalCount={listData?.count}
              onSelect={setSelectedPartyId}
              onPageChange={setPage}
            />
          }
          right={
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
          }
        />
      </div>
    </div>
  );
}

export default function PartyPage() {
  return (
    <Suspense fallback={null}>
      <PartyPageContent />
    </Suspense>
  );
}
