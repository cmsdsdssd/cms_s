"use client";

import { useMemo } from "react";
import { Link2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { diffDaysInclusive, downloadCsv, toCsv } from "@/components/analysis/analysis-helpers";

export function AnalysisReadOnlyBadge() {
  return <Badge tone="neutral">Read-only 분석 화면</Badge>;
}

export function AnalysisFreshnessBadge({ isFetching }: { isFetching: boolean }) {
  return <Badge tone={isFetching ? "warning" : "active"}>{isFetching ? "갱신 중" : "최신"}</Badge>;
}

export function AnalysisRangeWarning({ fromYmd, toYmd }: { fromYmd: string; toYmd: string }) {
  const days = useMemo(() => diffDaysInclusive(fromYmd, toYmd), [fromYmd, toYmd]);
  if (days <= 180) return null;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--foreground)]">
      조회 기간이 {days}일입니다. 180일 초과 조회는 성능 저하 가능성이 있습니다.
    </div>
  );
}

export function AnalysisCopyLinkButton() {
  const href = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        const absolute = href || window.location.href;
        await navigator.clipboard.writeText(absolute);
      }}
      title="현재 필터 링크 복사"
    >
      <Link2 className="h-4 w-4" />
      링크 복사
    </Button>
  );
}

export function AnalysisExportCsvButton({
  rows,
  filename,
  maxRows = 10000,
}: {
  rows: Array<Record<string, unknown>>;
  filename: string;
  maxRows?: number;
}) {
  const disabled = rows.length === 0;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={() => {
        const safeRows = rows.slice(0, maxRows);
        const csv = toCsv(safeRows);
        downloadCsv(filename, csv);
      }}
      title={rows.length > maxRows ? `최대 ${maxRows}건까지만 내보냅니다` : "CSV 다운로드"}
    >
      <FileDown className="h-4 w-4" />
      CSV
    </Button>
  );
}

export function AnalysisHelpSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; description: string }>;
}) {
  return (
    <Card>
      <CardHeader title={title} description="지표 정의/주의사항" />
      <CardBody className="space-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-[var(--hairline)] p-3">
            <p className="font-semibold">{item.label}</p>
            <p className="text-[var(--muted)]">{item.description}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export function AnalysisEvidencePreview({ evidence }: { evidence: Record<string, unknown> | null | undefined }) {
  return (
    <pre className="overflow-auto rounded border border-[var(--hairline)] bg-[var(--chip)] p-2 text-xs" aria-label="evidence-json">
      {JSON.stringify(evidence ?? {}, null, 2)}
    </pre>
  );
}

export function AnalysisEmptyState({ message }: { message: string }) {
  return <p className="text-sm text-[var(--muted)]">{message}</p>;
}

export function AnalysisSkeletonBlock() {
  return <div className="h-16 animate-pulse rounded-[var(--radius)] bg-[var(--chip)]" aria-hidden="true" />;
}
