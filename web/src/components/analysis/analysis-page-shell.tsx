"use client";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AnalysisRangeWarning } from "@/components/analysis/analysis-common";

type AnalysisFilterBarProps = {
  fromYmd: string;
  toYmd: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  children?: React.ReactNode;
};

type AnalysisPageShellProps = {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
};

export function AnalysisPageShell({
  title,
  subtitle,
  actions,
  filterBar,
  children,
}: AnalysisPageShellProps) {
  return (
    <div className="space-y-4">
      <ActionBar title={title} subtitle={subtitle} actions={actions} />
      {filterBar}
      {children}
    </div>
  );
}

export function AnalysisFilterBar({
  fromYmd,
  toYmd,
  onFromChange,
  onToChange,
  children,
}: AnalysisFilterBarProps) {
  return (
    <div className="sticky top-14 z-30">
      <Card className="bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
        <CardHeader title="공통 필터" description="기본 조회 기간은 최근 30일입니다." />
        <CardBody className="space-y-3">
          <AnalysisRangeWarning fromYmd={fromYmd} toYmd={toYmd} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="analysis-from-date">시작일</label>
              <Input id="analysis-from-date" type="date" value={fromYmd} onChange={(e) => onFromChange(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="analysis-to-date">종료일</label>
              <Input id="analysis-to-date" type="date" value={toYmd} onChange={(e) => onToChange(e.target.value)} />
            </div>
            <div className="md:col-span-2">{children}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

type Option = { value: string; label: string };

type AnalysisSimpleSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

export function AnalysisSimpleSelect({
  label,
  value,
  onChange,
  options,
}: AnalysisSimpleSelectProps) {
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--muted)]">{label}</div>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function AnalysisHeaderRefresh({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <Button variant="secondary" onClick={onRefresh} disabled={loading}>
      {loading ? "갱신 중..." : "새로고침"}
    </Button>
  );
}
