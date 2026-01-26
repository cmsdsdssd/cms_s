import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6" id="settings.root">
      <ActionBar
        title="설정"
        subtitle="시세/도금/룰 조회"
        actions={<Button variant="secondary">새로고침</Button>}
        id="settings.actionBar"
      />
      <div className="grid gap-4" id="settings.body">
        <Card>
          <CardHeader>
            <ActionBar title="시세" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>심볼</span>
              <span>가격</span>
              <span>관측일</span>
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
            <ActionBar title="도금 옵션" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>타입</span>
              <span>표시명</span>
              <span>상태</span>
            </div>
            <div className="grid grid-cols-3 text-sm text-[var(--foreground)]">
              <span>P</span>
              <span>G (1차)</span>
              <span>활성</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <ActionBar title="공임 밴드 룰" />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-4 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>카테고리</span>
              <span>밴드</span>
              <span>적용일</span>
              <span>상태</span>
            </div>
            <div className="grid grid-cols-4 text-sm text-[var(--foreground)]">
              <span>반지</span>
              <span>B1</span>
              <span>2026-01-01</span>
              <span>활성</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
