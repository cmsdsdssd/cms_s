import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function AnalysisNotFound() {
  return (
    <Card>
      <CardHeader title="분석 페이지를 찾을 수 없습니다" description="URL 또는 권한 상태를 확인하세요." />
      <CardBody className="space-y-2 text-sm">
        <p>요청하신 분석 화면이 없거나 접근할 수 없습니다.</p>
        <Link className="text-[var(--primary)] underline" href="/analysis/overview">
          분석 요약으로 이동
        </Link>
      </CardBody>
    </Card>
  );
}
