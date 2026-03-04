"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type FlowStep = {
  title: string;
  why: string;
  uiPath: string;
  apis: string[];
  checklist: string[];
};

const steps: FlowStep[] = [
  {
    title: "1) 채널 연결",
    why: "카페24 인증/토큰 상태가 정상이어야 이후 자동 반영이 동작합니다.",
    uiPath: "/settings/shopping/channels",
    apis: [
      "/api/channels",
      "/api/channels/[id]/account",
      "/api/shop-oauth/cafe24/authorize",
      "/api/shop-oauth/cafe24/callback",
    ],
    checklist: ["채널 ACTIVE", "OAuth 성공", "access/refresh token 저장"],
  },
  {
    title: "2) 쇼핑몰-마스터 매핑",
    why: "master_item_id와 product_no/variant_code를 정확히 연결해야 계산/반영 대상이 확정됩니다.",
    uiPath: "/settings/shopping/mappings",
    apis: [
      "/api/channel-products",
      "/api/channel-products/[id]",
      "/api/channel-products/bulk",
      "/api/channel-products/variants",
      "/api/sync-rule-sets",
    ],
    checklist: ["base/variant 매핑 누락 0", "중복 active variant 0", "SYNC 룰셋 지정"],
  },
  {
    title: "3) 정책/팩터 설정",
    why: "마진/반올림/소재 팩터가 final target 계산식의 기준이 됩니다.",
    uiPath: "/settings/shopping/factors",
    apis: [
      "/api/pricing-policies",
      "/api/pricing-policies/[id]",
      "/api/material-factor-sets",
      "/api/material-factor-sets/[id]",
      "/api/material-factor-config",
    ],
    checklist: ["활성 정책 1개", "rounding/margin 점검", "factor set 연결"],
  },
  {
    title: "4) 옵션 룰(R1~R4)",
    why: "옵션별 가중치/도금/장식/마진 규칙이 옵션별 목표가를 결정합니다.",
    uiPath: "/settings/shopping/rules",
    apis: [
      "/api/sync-rule-sets",
      "/api/sync-rules/r1",
      "/api/sync-rules/r2",
      "/api/sync-rules/r3",
      "/api/sync-rules/r4",
      "/api/sync-rules/preview",
    ],
    checklist: ["활성 룰셋 지정", "preview 값 확인", "수동 override 충돌 확인"],
  },
  {
    title: "5) 자동가격 실행",
    why: "재계산 스냅샷 생성 후 run/execute로 실제 Cafe24에 반영합니다.",
    uiPath: "/settings/shopping/auto-price",
    apis: [
      "/api/pricing/recompute",
      "/api/price-sync-runs-v2",
      "/api/price-sync-runs-v2/[run_id]/execute",
      "/api/channel-floor-guards",
      "/api/channel-products/editor",
      "/api/channel-prices/push",
    ],
    checklist: ["compute_request_id 생성", "run 생성", "execute 결과 success/failed 확인"],
  },
  {
    title: "6) 모니터링/장애 추적",
    why: "run/intent, push job/item 단위로 실패 원인과 재시도 상태를 확인합니다.",
    uiPath: "/settings/shopping/cron-runs",
    apis: [
      "/api/price-sync-runs-v2",
      "/api/price-sync-runs-v2/[run_id]",
      "/api/price-sync-jobs",
      "/api/price-sync-jobs/[job_id]",
      "/api/cron/shop-sync-v2",
    ],
    checklist: ["failed reason code 추적", "run/job 카운트 대조", "재실행/수정 루프"],
  },
];

export default function ShoppingWorkflowPage() {
  const [query, setQuery] = useState("");
  const [selectedTitle, setSelectedTitle] = useState(steps[0]?.title ?? "");

  const filteredSteps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return steps;
    return steps.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.why.toLowerCase().includes(q)) return true;
      if (s.uiPath.toLowerCase().includes(q)) return true;
      return s.apis.some((a) => a.toLowerCase().includes(q));
    });
  }, [query]);

  const selectedStep = useMemo(() => {
    return steps.find((s) => s.title === selectedTitle) ?? filteredSteps[0] ?? steps[0];
  }, [filteredSteps, selectedTitle]);

  const selectedIndex = steps.findIndex((s) => s.title === selectedStep.title);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]">
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search className="w-5 h-5" />
            운영 워크플로우
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <Input
              placeholder="단계/API 검색..."
              className="pl-9 bg-[var(--chip)] border-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 py-3 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">전체 단계</span>
          <span className="font-bold text-[var(--foreground)]">{steps.length}개</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSteps.map((step, idx) => {
            const isSelected = selectedStep.title === step.title;
            return (
              <button
                key={step.title}
                onClick={() => setSelectedTitle(step.title)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors relative",
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--panel)] shadow-sm"
                    : "border-transparent hover:border-[var(--panel-border)] hover:bg-[var(--chip)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{step.why}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0 mt-0.5" />
                </div>
                <div className="mt-2 text-[11px] text-[var(--muted)]">화면: {step.uiPath}</div>
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary)] rounded-l-lg" />}
                {!isSelected && idx === 0 && filteredSteps.length === 1 && (
                  <div className="absolute inset-0 pointer-events-none rounded-lg border border-[var(--panel-border)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{selectedStep.title}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-medium">
                  단계 {selectedIndex + 1}/{steps.length}
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">{selectedStep.why}</p>
            </div>
            <div className="flex gap-2">
              <Link href={selectedStep.uiPath}>
                <Button variant="secondary" size="sm">해당 화면 열기</Button>
              </Link>
              <Link href="/settings/shopping/auto-price">
                <Button variant="secondary" size="sm">자동가격 바로가기</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">UI 경로</p>
              <p className="text-sm font-bold break-all">{selectedStep.uiPath}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">연결 API</p>
              <p className="text-sm font-bold">{selectedStep.apis.length}개</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">실행 진입점</p>
              <p className="text-sm font-bold">/api/cron/shop-sync-v2</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="min-h-[320px] shadow-sm">
              <CardHeader title="API 목록" description="이 단계에서 사용하는 엔드포인트" />
              <CardBody className="space-y-2 text-sm">
                {selectedStep.apis.map((api) => (
                  <div key={api} className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--chip)] px-3 py-2">
                    <code>{api}</code>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card className="min-h-[320px] shadow-sm">
              <CardHeader title="운영 체크리스트" description="이 단계 완료 기준" />
              <CardBody className="space-y-2 text-sm">
                {selectedStep.checklist.map((item) => (
                  <div key={item} className="rounded-[var(--radius)] border border-[var(--hairline)] px-3 py-2">
                    {item}
                  </div>
                ))}
                <div className="pt-2">
                  <Link href="/settings/shopping/cron-runs">
                    <Button variant="secondary" size="sm">런 로그에서 결과 확인</Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
