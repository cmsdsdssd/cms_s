import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import type { PartyRow } from "@/lib/api/cmsParty";

type PartyListProps = {
  parties: PartyRow[];
  isLoading: boolean;
  error?: Error | null;
  selectedPartyId: string | null;
  page: number;
  pageSize?: number;
  totalCount?: number | null;
  onSelect: (partyId: string) => void;
  onPageChange: (page: number) => void;
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

export function PartyList({
  parties,
  isLoading,
  error,
  selectedPartyId,
  page,
  pageSize = 50,
  totalCount,
  onSelect,
  onPageChange,
}: PartyListProps) {
  if (isLoading) {
    return <div className="p-4 text-center text-[var(--muted)]">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        목록을 불러오지 못했습니다. 다시 시도
      </div>
    );
  }

  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoNext = totalPages ? page < totalPages : parties.length >= pageSize;

  return (
    <div className="space-y-3" id="party.listPanel">
      {parties.map((party) => {
        const isCustomer = party.party_type === "customer";
        const badge = party.is_active
          ? { label: "활성", tone: "active" as const }
          : { label: "비활성", tone: "neutral" as const };

        const subtitle = `전화 ${party.phone ?? "-"}`;
        const meta = isCustomer
          ? `지역 ${party.region ?? "-"} · 잔액 ${formatSignedKrw(party.balance_krw)} · 최근 ${formatDateTimeKst(
              party.last_activity_at
            )}`
          : `지역 ${party.region ?? "-"}`;

        return (
          <button
            key={party.party_id}
            type="button"
            onClick={() => onSelect(party.party_id)}
            className="w-full text-left"
          >
            <ListCard
              title={party.name}
              subtitle={subtitle}
              meta={meta}
              badge={badge}
              selected={party.party_id === selectedPartyId}
              right={
                isCustomer ? (
                  <span className="text-xs text-[var(--muted)]">
                    {formatKrw(party.balance_krw)}
                  </span>
                ) : null
              }
            />
          </button>
        );
      })}

      {parties.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--muted)]">
              등록된 거래처가 없습니다. '거래처 추가'를 눌러 등록하세요.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-center gap-2 pt-2">
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          이전
        </Button>
        <span className="flex items-center text-sm text-[var(--muted)]">
          Page {page}
        </span>
        <Button variant="secondary" disabled={!canGoNext} onClick={() => onPageChange(page + 1)}>
          다음
        </Button>
      </div>
    </div>
  );
}
