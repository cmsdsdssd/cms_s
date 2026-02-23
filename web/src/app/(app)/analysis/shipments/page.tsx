"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalysisPageShell } from "@/components/analysis/analysis-page-shell";

export default function AnalysisShipmentsPage() {
  return (
    <AnalysisPageShell
      title="출고 분석"
      subtitle="기존 shipments_analysis를 분석 모드 IA에서 접근"
      actions={null}
    >
      <Card>
        <CardHeader
          title="출고 분석 래핑"
          description="기존 출고 분석 화면은 유지하고, 분석 모드에서 바로 접근할 수 있게 연결합니다."
        />
        <CardBody className="space-y-3 text-sm">
          <p>v1에서는 기존 출고 분석 로직을 변경하지 않고 분석 모드에서 링크로 제공합니다.</p>
          <div className="flex gap-2">
            <Link href="/shipments_analysis" target="_blank" rel="noreferrer">
              <Button variant="secondary">기존 출고 분석 열기</Button>
            </Link>
            <Link href="/analysis/overview">
              <Button variant="ghost">요약으로 돌아가기</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </AnalysisPageShell>
  );
}
