import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { RefreshCw } from "lucide-react";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BasicInfoTab } from "@/components/party/tabs/BasicInfoTab";
import { AddressesTab } from "@/components/party/tabs/AddressesTab";
import { ContactsTab } from "@/components/party/tabs/ContactsTab";
import { PrefixMapTab } from "@/components/party/tabs/PrefixMapTab";
import type { PartyDetail } from "@/lib/api/cmsParty";
import { cn } from "@/lib/utils";
import type { PartyForm, PartyTabKey } from "@/components/party/types";

type PartyDetailProps = {
  selectedPartyId: string | null;
  detail?: PartyDetail;
  isLoading: boolean;
  activeTab: PartyTabKey;
  onTabChange: (tab: PartyTabKey) => void;
  form: UseFormReturn<PartyForm>;
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (values: PartyForm) => void;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatSignedKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}₩${new Intl.NumberFormat("ko-KR").format(abs)}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

export function PartyDetail({
  selectedPartyId,
  detail,
  isLoading,
  activeTab,
  onTabChange,
  form,
  canSave,
  isSaving,
  onSubmit,
}: PartyDetailProps) {
  const watchedPartyType = form.watch("party_type");
  const isVendor =
    detail?.party_type === "vendor" ||
    (selectedPartyId === "new" && watchedPartyType === "vendor");

  useEffect(() => {
    if (!selectedPartyId) return;
    if (!isVendor && activeTab === "prefix") {
      onTabChange("basic");
    }
  }, [activeTab, isVendor, onTabChange, selectedPartyId]);

  if (!selectedPartyId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--muted)]">좌측에서 거래처를 선택하거나 추가하세요.</p>
        </CardBody>
      </Card>
    );
  }

  const tabs: { key: PartyTabKey; label: string }[] = [
    { key: "basic", label: "기본 정보" },
    { key: "address", label: "주소" },
    { key: "contact", label: "담당자" },
  ];
  if (isVendor) {
    tabs.push({ key: "prefix", label: "Prefix Map" });
  }

  // Header display
  const displayName = selectedPartyId === "new" ? "새 거래처" : detail?.name || "로딩 중...";
  const displayType = selectedPartyId === "new" ? (watchedPartyType === "customer" ? "고객" : "공장") : detail?.party_type === "customer" ? "고객" : "공장";

  return (
    <div id="party.detailPanel" className="pb-20">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-medium">
                {displayType}
              </span>
            </div>
            {detail && (
              <p className="text-sm text-[var(--muted)] flex items-center gap-2">
                마지막 활동: {formatDateTimeKst(detail.last_activity_at)}
              </p>
            )}
          </div>
          {/* Refresh or Actions could go here */}
        </div>
      </div>

      {isLoading && selectedPartyId !== "new" ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--muted)]">로딩 중...</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Card (only for existing customers) */}
          {detail?.party_type === "customer" && selectedPartyId !== "new" && (
            <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-1">잔액</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatSignedKrw(detail.balance_krw)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-1">미수</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatKrw(detail.receivable_krw)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-1">크레딧</p>
                <p className="text-lg font-bold tabular-nums">{formatKrw(detail.credit_krw)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-1">최근 활동</p>
                <p className="text-sm font-medium">{formatDateTimeKst(detail.last_activity_at)}</p>
              </div>
            </div>
          )}

          {/* Sticky Tabs */}
          <div className="sticky top-0 bg-[var(--background)] z-10 border-b border-[var(--panel-border)] pt-2">
            <div className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.key
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            {activeTab === "basic" && (
              <BasicInfoTab
                form={form}
                isEdit={selectedPartyId !== "new"}
                canSave={canSave}
                isSaving={isSaving}
                onSubmit={onSubmit}
              />
            )}

            {activeTab === "address" && <AddressesTab addresses={detail?.addresses ?? []} />}

            {activeTab === "contact" && <ContactsTab links={detail?.links ?? []} />}

            {activeTab === "prefix" && <PrefixMapTab prefixes={detail?.prefixes ?? []} />}
          </div>
        </div>
      )}
    </div>
  );
}
