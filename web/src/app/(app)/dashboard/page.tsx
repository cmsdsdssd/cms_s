import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";

const kpis = [
  { label: "오늘 출고", value: "18" },
  { label: "출고 매출", value: "₩24,800,000" },
  { label: "미수 잔액", value: "₩7,320,000" },
  { label: "수리 진행", value: "12" },
];

const recent = [
  {
    title: "출고 #S-240126-04",
    subtitle: "소매A · 6라인",
    meta: "방금 전",
    badge: { label: "확정", tone: "active" as const },
  },
  {
    title: "주문 #O-240126-11",
    subtitle: "소매B · 3라인",
    meta: "15분 전",
    badge: { label: "준비", tone: "warning" as const },
  },
  {
    title: "미수 결제",
    subtitle: "소매A · ₩2,000,000",
    meta: "1시간 전",
    badge: { label: "결제", tone: "neutral" as const },
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6" id="dashboard.root">
      <ActionBar
        title="대시보드"
        subtitle="1차 운영 요약"
        actions={<Button variant="secondary">빠른 작업</Button>}
        className="mb-2"
        id="dashboard.actionBar"
      />
      <FilterBar id="dashboard.filterBar">
        <Button variant="ghost" size="sm">
          최근 7일
        </Button>
        <Button variant="ghost" size="sm">
          최근 30일
        </Button>
        <Button variant="ghost" size="sm">
          기간 설정
        </Button>
      </FilterBar>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4" id="dashboard.body">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>
      <div className="space-y-4">
        <ActionBar title="최근 활동" />
        <div className="space-y-3">
          {recent.map((item) => (
            <ListCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
