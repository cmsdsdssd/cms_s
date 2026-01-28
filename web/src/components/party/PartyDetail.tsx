import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ActionBar } from "@/components/layout/action-bar";
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
  if (!selectedPartyId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--muted)]">좌측에서 거래처를 선택하거나 추가하세요.</p>
        </CardBody>
      </Card>
    );
  }

  const watchedPartyType = form.watch("party_type");
  const isVendor =
    detail?.party_type === "vendor" ||
    (selectedPartyId === "new" && watchedPartyType === "vendor");

  useEffect(() => {
    if (!isVendor && activeTab === "prefix") {
      onTabChange("basic");
    }
  }, [activeTab, isVendor, onTabChange]);

  const tabs: { key: PartyTabKey; label: string }[] = [
    { key: "basic", label: "기본 정보" },
    { key: "address", label: "주소" },
    { key: "contact", label: "담당자" },
  ];
  if (isVendor) {
    tabs.push({ key: "prefix", label: "Prefix Map" });
  }

  return (
    <div id="party.detailPanel">
      {isLoading && selectedPartyId !== "new" ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--muted)]">로딩 중...</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {detail?.party_type === "customer" && (
            <Card>
              <CardHeader>
                <ActionBar title="AR 요약" />
              </CardHeader>
              <CardBody>
                <div className="grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-[var(--muted)]">잔액</p>
                    <p className="text-base font-semibold">
                      {formatSignedKrw(detail.balance_krw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">미수</p>
                    <p className="text-base font-semibold">
                      {formatKrw(detail.receivable_krw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">크레딧</p>
                    <p className="text-base font-semibold">{formatKrw(detail.credit_krw)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">최근 활동</p>
                    <p className="text-sm">{formatDateTimeKst(detail.last_activity_at)}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  activeTab === tab.key
                    ? "border-[var(--primary)] bg-[var(--chip)] text-[var(--primary)]"
                    : "border-[var(--panel-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
      )}
    </div>
  );
}
