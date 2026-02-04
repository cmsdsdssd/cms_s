"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ReconcileVendorRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  vendor_name?: string | null;
};

type ReconcileIssueRow = Record<string, unknown> & {
  issue_id?: string | null;
  vendor_party_id?: string | null;
  status?: string | null;
  severity?: string | null;
};

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return new Intl.NumberFormat("ko-KR").format(value);
  if (typeof value === "string" && value.trim()) return value;
  return String(value);
};

function ApReconcileContent() {
  const schemaClient = getSchemaClient();
  const searchParams = useSearchParams();
  const initialVendor = searchParams.get("vendor_party_id") ?? "";
  const initialStatus = searchParams.get("status") ?? "OPEN,ACKED";

  const [selectedVendorId, setSelectedVendorId] = useState(initialVendor);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [ignoreNote, setIgnoreNote] = useState("");

  const vendorsQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_vendor"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apReconcileOpenByVendor)
        .select("*")
        .order("vendor_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReconcileVendorRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const issuesQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_issues", selectedVendorId, statusFilter, severityFilter],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const base = schemaClient.from(CONTRACTS.views.apReconcileIssueList).select("*");
      const scoped = selectedVendorId ? base.eq("vendor_party_id", selectedVendorId) : base;
      const statusList = statusFilter
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const withStatus = statusList.length > 0 ? scoped.in("status", statusList) : scoped;
      const withSeverity = severityFilter === "ALL" ? withStatus : withStatus.eq("severity", severityFilter);
      const { data, error } = await withSeverity.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReconcileIssueRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const selectedIssue = useMemo(
    () => (issuesQuery.data ?? []).find((row) => row.issue_id === selectedIssueId) ?? null,
    [issuesQuery.data, selectedIssueId]
  );

  const issueLegsQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_issue_legs", selectedIssueId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!selectedIssueId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from("cms_ap_reconcile_issue_leg")
        .select("*")
        .eq("issue_id", selectedIssueId);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && selectedIssueId),
  });

  const setIssueStatus = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.apReconcileSetIssueStatus,
    successMessage: "처리 완료",
    onSuccess: () => {
      issuesQuery.refetch();
      vendorsQuery.refetch();
    },
  });

  const createAdjustment = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.apReconcileCreateAdjustment,
    successMessage: "조정 생성 완료",
    onSuccess: () => {
      issuesQuery.refetch();
      vendorsQuery.refetch();
    },
  });

  const issues = issuesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 px-4 pb-10 pt-4 md:px-6">
      <ActionBar title="AP 정합 큐" subtitle="미지급 정합 이슈를 확인하고 처리합니다." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="text-sm font-semibold">공장</div>
            </CardHeader>
            <CardBody className="max-h-[70vh] overflow-y-auto p-2">
              {vendorsQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={`vendor-skel-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : (vendorsQuery.data ?? []).length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] text-sm text-[var(--muted)]">
                  조회 결과가 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(vendorsQuery.data ?? []).map((row, idx) => {
                    const vendorId = row.vendor_party_id ?? "";
                    const isSelected = vendorId === selectedVendorId;
                    return (
                      <button
                        key={`${vendorId}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedVendorId(vendorId);
                          setSelectedIssueId(null);
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3 py-3 text-left transition-all",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-transparent bg-[var(--panel)] hover:border-[var(--panel-border)]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                              {row.vendor_name ?? (vendorId || "-")}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">{vendorId}</div>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {renderValue(row.open_count ?? row.error_count ?? row.warn_count)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">이슈</div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="OPEN,ACKED">OPEN/ACKED</option>
                    <option value="OPEN">OPEN</option>
                    <option value="ACKED">ACKED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="IGNORE">IGNORE</option>
                  </Select>
                  <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                    <option value="ALL">ALL</option>
                    <option value="ERROR">ERROR</option>
                    <option value="WARN">WARN</option>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-2">
              {issuesQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : issues.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                  이슈가 없습니다.
                </div>
              ) : (
                issues.map((row, idx) => {
                  const issueId = row.issue_id ?? "";
                  const isSelected = issueId === selectedIssueId;
                  return (
                    <button
                      key={`${issueId}-${idx}`}
                      type="button"
                      onClick={() => setSelectedIssueId(issueId)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-all",
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-transparent bg-[var(--panel)] hover:border-[var(--panel-border)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{row.severity ?? row.status ?? "ISSUE"}</div>
                        <div className="text-xs text-[var(--muted)]">{row.status ?? "-"}</div>
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">{row.issue_id ?? "-"}</div>
                    </button>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="text-sm font-semibold">이슈 상세</div>
            </CardHeader>
            <CardBody className="space-y-3">
              {!selectedIssue ? (
                <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                  이슈를 선택하세요.
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-xs">
                    {Object.entries(selectedIssue).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">{key}</span>
                        <span>{renderValue(value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      placeholder="IGNORE 메모 (필수)"
                      value={ignoreNote}
                      onChange={(e) => setIgnoreNote(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (!selectedIssue.issue_id) return;
                          setIssueStatus.mutate({
                            p_issue_id: selectedIssue.issue_id,
                            p_status: "ACKED",
                            p_note: null,
                          });
                        }}
                      >
                        ACK
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (!selectedIssue.issue_id) return;
                          if (!ignoreNote.trim()) {
                            toast.error("IGNORE 메모가 필요합니다");
                            return;
                          }
                          setIssueStatus.mutate({
                            p_issue_id: selectedIssue.issue_id,
                            p_status: "IGNORE",
                            p_note: ignoreNote.trim(),
                          });
                        }}
                      >
                        IGNORE
                      </Button>
                      <Button
                        onClick={() => {
                          if (!selectedIssue.issue_id) return;
                          createAdjustment.mutate({
                            p_issue_id: selectedIssue.issue_id,
                            p_note: null,
                          });
                        }}
                      >
                        추천 조정 생성
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Leg 상세</div>
                    {issueLegsQuery.isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (issueLegsQuery.data ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                        상세 정보가 없습니다.
                      </div>
                    ) : (
                      (issueLegsQuery.data ?? []).map((row, idx) => (
                        <div key={`issue-leg-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                          {Object.entries(row).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-2">
                              <span className="text-[var(--muted)]">{key}</span>
                              <span>{renderValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ApReconcilePage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-[1800px] p-6 text-sm text-[var(--muted)]">로딩 중...</div>}
    >
      <ApReconcileContent />
    </Suspense>
  );
}
