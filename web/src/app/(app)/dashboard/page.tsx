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
    title: "Shipment #S-240126-04",
    subtitle: "소매A · 6 lines",
    meta: "방금 전",
    badge: { label: "CONFIRMED", tone: "active" as const },
  },
  {
    title: "Order #O-240126-11",
    subtitle: "소매B · 3 lines",
    meta: "15분 전",
    badge: { label: "READY", tone: "warning" as const },
  },
  {
    title: "AR Payment",
    subtitle: "소매A · ₩2,000,000",
    meta: "1시간 전",
    badge: { label: "PAYMENT", tone: "neutral" as const },
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6" id="dashboard.root">
      <ActionBar
        title="Dashboard"
        subtitle="Phase1 operations overview"
        actions={<Button variant="secondary">Quick Actions</Button>}
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
          커스텀
        </Button>
      </FilterBar>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4" id="dashboard.body">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>
      <div className="space-y-4">
        <ActionBar title="Recent Activity" />
        <div className="space-y-3">
          {recent.map((item) => (
            <ListCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
