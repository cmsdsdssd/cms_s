"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Link2 } from "lucide-react";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const primaryActions = [
  { href: "/settings/shopping/mappings", title: "미매핑 처리", desc: "상품번호/옵션코드 매핑을 먼저 정리" },
  { href: "/settings/shopping/sync-jobs", title: "실패 로그 확인", desc: "최근 실패/부분성공 건 즉시 확인" },
  { href: "/settings/shopping/rules", title: "정책 충돌 점검", desc: "R1~R4 룰과 정책 우선순위 재검토" },
];

const sectionGroups = [
  {
    title: "운영 현황",
    items: [
      { href: "/settings/shopping", title: "쇼핑몰 홈", desc: "오늘 운영 상태를 빠르게 확인" },
      { href: "/settings/shopping/dashboard", title: "가격 대시보드", desc: "권장가/현재가 비교 및 재계산" },
      { href: "/settings/shopping/sync-jobs", title: "동기화 로그", desc: "push 성공/실패/건너뜀 추적" },
    ],
  },
  {
    title: "설정/연결",
    items: [
      { href: "/settings/shopping/channels", title: "채널 설정", desc: "카페24 채널/계정 연결" },
      { href: "/settings/shopping/factors", title: "정책/팩터", desc: "마진/반올림/팩터 세트 관리" },
      { href: "/settings/shopping/rules", title: "옵션 룰 설정", desc: "R1~R4 Sync 룰 구성" },
    ],
  },
  {
    title: "카탈로그/매핑",
    items: [
      { href: "/settings/shopping/mappings", title: "상품 매핑", desc: "master_item_id와 product_no 연결" },
    ],
  },
];

export default function ShoppingSettingsHomePage() {
  return (
    <div className="space-y-4">
      <ActionBar
        title="쇼핑몰 관리"
        subtitle="운영 상태 확인 > 우선 작업 > 상세 설정 순서로 구성"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader title="채널 연결 상태" description="계정/토큰 연결 확인" />
          <CardBody>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
              <Link2 className="h-4 w-4" />
              <span>채널 설정에서 활성 채널과 OAuth 상태를 먼저 확인하세요.</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="동기화 결과" description="최근 반영 성공/실패 추적" />
          <CardBody>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
              <Activity className="h-4 w-4" />
              <span>동기화 로그에서 실패 항목을 우선 처리하세요.</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="주의 필요 항목" description="가격/정책 충돌 위험" />
          <CardBody>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
              <AlertTriangle className="h-4 w-4" />
              <span>가격 대시보드 불일치와 룰 충돌을 점검하세요.</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="지금 해야 할 일" description="우선순위 액션 3개" />
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {primaryActions.map((item) => (
            <div key={item.href} className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
              <div className="text-sm font-semibold">{item.title}</div>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.desc}</p>
              <div className="mt-3">
                <Link href={item.href}>
                  <Button variant="secondary" size="sm">바로가기</Button>
                </Link>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="space-y-4">
        {sectionGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader title={group.title} />
            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <div key={item.href} className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.desc}</p>
                  <div className="mt-3">
                    <Link href={item.href}>
                      <Button variant="secondary" size="sm">열기</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
