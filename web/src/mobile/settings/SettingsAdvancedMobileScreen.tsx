"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileSection } from "@/mobile/shared/MobileSection";

type MarketConfigRow = {
  fx_markup?: number | null;
  cs_correction_factor?: number | null;
  silver_kr_correction_factor?: number | null;
  rule_rounding_unit_krw?: number | null;
};

type VendorRow = {
  party_id?: string;
  name?: string;
};

export function SettingsAdvancedMobileScreen() {
  const sb = getSchemaClient();
  const [open, setOpen] = useState<"margins" | "market" | "fax">("margins");
  const [fxMarkup, setFxMarkup] = useState("");
  const [csFactor, setCsFactor] = useState("");
  const [silverFactor, setSilverFactor] = useState("");
  const [roundUnit, setRoundUnit] = useState("0");
  const [vendorId, setVendorId] = useState("");
  const [faxNumber, setFaxNumber] = useState("");
  const [faxProvider, setFaxProvider] = useState("mock");

  const configQuery = useQuery({
    queryKey: ["cms", "market_tick_config_mobile"],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env is missing");
      const { data, error } = await sb
        .from("cms_market_tick_config")
        .select("fx_markup,cs_correction_factor,silver_kr_correction_factor,rule_rounding_unit_krw")
        .eq("config_key", "default")
        .maybeSingle();
      if (error) throw error;
      return (data ?? {}) as MarketConfigRow;
    },
    enabled: Boolean(sb),
  });

  const vendorsQuery = useQuery({
    queryKey: ["cms", "vendors_mobile_settings"],
    queryFn: async () => {
      const response = await fetch("/api/vendors", { cache: "no-store" });
      const json = (await response.json()) as { data?: VendorRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "공장 조회 실패");
      return json.data ?? [];
    },
  });

  const upsertMarketMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.marketTickConfigUpsert,
    successMessage: "시세 설정 저장 완료",
    onSuccess: () => {
      void configQuery.refetch();
    },
  });

  const setRoundMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.setRuleRoundingUnit,
    successMessage: "올림 단위 저장 완료",
    onSuccess: () => {
      void configQuery.refetch();
    },
  });

  const faxMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.vendorFaxConfigUpsert,
    successMessage: "팩스 설정 저장 완료",
  });

  const currentConfig = configQuery.data;

  const marketValues = useMemo(() => {
    return {
      fx: fxMarkup || String(currentConfig?.fx_markup ?? 1.03),
      cs: csFactor || String(currentConfig?.cs_correction_factor ?? 1.2),
      silver: silverFactor || String(currentConfig?.silver_kr_correction_factor ?? 1.2),
      round: roundUnit || String(currentConfig?.rule_rounding_unit_krw ?? 0),
    };
  }, [currentConfig, fxMarkup, csFactor, silverFactor, roundUnit]);

  return (
    <MobilePage title="고급설정" subtitle="마진 · 시세 · 팩스 설정">
      <div className="grid grid-cols-3 gap-1">
        <Button size="sm" variant={open === "margins" ? "primary" : "secondary"} onClick={() => setOpen("margins")}>마진</Button>
        <Button size="sm" variant={open === "market" ? "primary" : "secondary"} onClick={() => setOpen("market")}>시세</Button>
        <Button size="sm" variant={open === "fax" ? "primary" : "secondary"} onClick={() => setOpen("fax")}>팩스</Button>
      </div>

      {open === "margins" ? (
        <MobileSection title="마진 / 올림 단위">
          <div className="space-y-2">
            <div className="text-xs text-[var(--muted)]">룰 올림 단위 (KRW)</div>
            <Input inputMode="numeric" value={marketValues.round} onChange={(event) => setRoundUnit(event.target.value)} />
          </div>
          <div className="mt-3">
            <Button
              className="w-full"
              onClick={() => {
                void setRoundMutation.mutateAsync({
                  p_rounding_unit_krw: Number(marketValues.round) || 0,
                  p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
                  p_session_id: null,
                  p_memo: "mobile settings",
                });
              }}
            >
              저장
            </Button>
          </div>
        </MobileSection>
      ) : null}

      {open === "market" ? (
        <MobileSection title="시세 보정">
          <div className="space-y-2">
            <div className="text-xs text-[var(--muted)]">FX 마크업</div>
            <Input inputMode="decimal" value={marketValues.fx} onChange={(event) => setFxMarkup(event.target.value)} />
            <div className="text-xs text-[var(--muted)]">중국 CS 보정</div>
            <Input inputMode="decimal" value={marketValues.cs} onChange={(event) => setCsFactor(event.target.value)} />
            <div className="text-xs text-[var(--muted)]">한국 실버 보정</div>
            <Input inputMode="decimal" value={marketValues.silver} onChange={(event) => setSilverFactor(event.target.value)} />
          </div>
          <div className="mt-3">
            <Button
              className="w-full"
              onClick={() => {
                void upsertMarketMutation.mutateAsync({
                  p_fx_markup: Number(marketValues.fx),
                  p_cs_correction_factor: Number(marketValues.cs),
                  p_silver_kr_correction_factor: Number(marketValues.silver),
                });
              }}
            >
              저장
            </Button>
          </div>
        </MobileSection>
      ) : null}

      {open === "fax" ? (
        <MobileSection title="공장 팩스 설정">
          <div className="space-y-2">
            <div className="text-xs text-[var(--muted)]">공장</div>
            <Select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
              <option value="">선택</option>
              {(vendorsQuery.data ?? []).map((vendor) => (
                <option key={vendor.party_id} value={vendor.party_id}>
                  {vendor.name ?? vendor.party_id}
                </option>
              ))}
            </Select>
            <div className="text-xs text-[var(--muted)]">팩스 번호</div>
            <Input value={faxNumber} onChange={(event) => setFaxNumber(event.target.value)} placeholder="02-0000-0000" />
            <div className="text-xs text-[var(--muted)]">팩스 제공자</div>
            <Select value={faxProvider} onChange={(event) => setFaxProvider(event.target.value)}>
              <option value="mock">mock</option>
              <option value="blue">blue</option>
              <option value="kt">kt</option>
            </Select>
          </div>
          <div className="mt-3">
            <Button
              className="w-full"
              onClick={() => {
                if (!vendorId) return;
                void faxMutation.mutateAsync({
                  p_vendor_party_id: vendorId,
                  p_fax_number: faxNumber || null,
                  p_fax_provider: faxProvider,
                  p_is_active: true,
                  p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
                });
              }}
            >
              저장
            </Button>
          </div>
        </MobileSection>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 px-3">
        <div className="mx-auto max-w-xl rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)]/95 p-2 text-center text-xs text-[var(--muted)]">
          변경사항이 있으면 각 섹션에서 저장 버튼을 눌러 반영하세요.
        </div>
      </div>
    </MobilePage>
  );
}
