import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6" id="settings.root">
      <ActionBar
        title="Settings"
        subtitle="시세/도금/룰 조회"
        actions={<Button variant="secondary">Refresh</Button>}
        id="settings.actionBar"
      />
      <div className="grid gap-4" id="settings.body">
        <Card>
          <CardHeader>
            <ActionBar title="Market Ticks" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>Symbol</span>
              <span>Price</span>
              <span>Observed</span>
            </div>
            <div className="grid grid-cols-3 text-sm text-[var(--foreground)]">
              <span>GOLD_KRW_PER_G</span>
              <span>₩102,000</span>
              <span>2026-01-26</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <ActionBar title="Plating Variants" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>Type</span>
              <span>Display</span>
              <span>Status</span>
            </div>
            <div className="grid grid-cols-3 text-sm text-[var(--foreground)]">
              <span>P</span>
              <span>G (Phase1)</span>
              <span>Active</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <ActionBar title="Labor Band Rules" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-4 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>Category</span>
              <span>Band</span>
              <span>Effective</span>
              <span>Status</span>
            </div>
            <div className="grid grid-cols-4 text-sm text-[var(--foreground)]">
              <span>RING</span>
              <span>B1</span>
              <span>2026-01-01</span>
              <span>Active</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
