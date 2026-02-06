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
  vendor_region?: string | null;
  vendor_is_active?: boolean | null;
  open_count?: number | null;
  error_count?: number | null;
  warn_count?: number | null;
  last_open_at?: string | null;
};

type ReconcileIssueRow = Record<string, unknown> & {
  issue_id?: string | null;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  status?: string | null;
  severity?: string | null;
  issue_type?: string | null;
  summary?: string | null;
  created_at?: string | null;
  receipt_id?: string | null;
  snapshot_version?: number | null;
  calc_version?: number | null;
};

// ── Formatters ──────────────────────────────────────────────────────────────
const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return new Intl.NumberFormat("ko-KR").format(value);
  if (typeof value === "string" && value.trim()) return value;
  return String(value);
};

// Normalize status filter (IGNORE → IGNORED)
const normalizeStatusFilter = (status: string): string => {
  return status
    .split(",")
    .map((s) => {
      const trimmed = s.trim().toUpperCase();
      if (trimmed === "IGNORE") return "IGNORED";
      return trimmed;
    })
    .filter(Boolean)
    .join(",");
};

// Severity badge color
const getSeverityColor = (severity?: string | null) => {
  switch (severity?.toUpperCase()) {
    case "ERROR":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "WARN":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
};

// Status badge color
const getStatusColor = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "OPEN":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "ACKED":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "RESOLVED":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "IGNORED":
      return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// Priority fields to show first in issue detail
const PRIORITY_FIELDS = ["summary", "issue_type", "severity", "status", "created_at", "vendor_name"];

function ApReconcileContent() {
  const schemaClient = getSchemaClient();
  const searchParams = useSearchParams();
  const initialVendor = searchParams.get("vendor_party_id") ?? "";
  const rawInitialStatus = searchParams.get("status") ?? "OPEN,ACKED";
  const initialStatus = normalizeStatusFilter(rawInitialStatus);

  const [selectedVendorId, setSelectedVendorId] = useState(initialVendor);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [ignoreNote, setIgnoreNote] = useState("");
  const [showAllFields, setShowAllFields] = useState(false);

  // ── Vendors Query (Named View) ──
  const vendorsQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_vendor_named"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apReconcileOpenByVendorNamed)
        .select("*")
        .order("vendor_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReconcileVendorRow[];
    },
    enabled: Boolean(schemaClient),
  });

  // ── Issues Query (Named View) ──
  const issuesQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_issues_named", selectedVendorId, statusFilter, severityFilter],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const base = schemaClient.from(CONTRACTS.views.apReconcileIssueListNamed).select("*");
      const scoped = selectedVendorId ? base.eq("vendor_party_id", selectedVendorId) : base;
      const statusList = statusFilter
        .split(",")
        .map((v) => v.trim())
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

  // ── Issue Legs Query ──
  const issueLegsQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_issue_legs", selectedIssueId],
    queryFn: async () => {
      if (!schemaClient || !selectedIssueId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from("cms_ap_reconcile_issue_leg")
        .select("*")
        .eq("issue_id", selectedIssueId);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && selectedIssueId),
  });

  // ── Set Issue Status (v2 RPC) ──
  const setIssueStatus = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.apReconcileSetIssueStatus,
    successMessage: "처리 완료",
    onSuccess: () => {
      issuesQuery.refetch();
      vendorsQuery.refetch();
      setIgnoreNote("");
    },
  });

  // ── Create Adjustment ──
  const createAdjustment = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.apReconcileCreateAdjustment,
    successMessage: "조정 생성 완료",
    onSuccess: () => {
      issuesQuery.refetch();
      vendorsQuery.refetch();
    },
  });

  const issues = issuesQuery.data ?? [];

  // ── Handlers ──
  const handleAck = () => {
    if (!selectedIssue?.issue_id) return;
    setIssueStatus.mutate({
      p_issue_id: selectedIssue.issue_id,
      p_status_text: "ACKED",
      p_note: null,
    });
  };

  const handleIgnore = () => {
    if (!selectedIssue?.issue_id) return;
    if (!ignoreNote.trim()) {
      toast.error("IGNORE 메모가 필요합니다");
      return;
    }
    setIssueStatus.mutate({
      p_issue_id: selectedIssue.issue_id,
      p_status_text: "IGNORED",
      p_note: ignoreNote.trim(),
    });
  };

  const handleResolve = () => {
    if (!selectedIssue?.issue_id) return;
    setIssueStatus.mutate({
      p_issue_id: selectedIssue.issue_id,
      p_status_text: "RESOLVED",
      p_note: ignoreNote.trim() || null,
    });
  };

  const handleCreateAdjustment = () => {
    if (!selectedIssue?.issue_id) return;
    createAdjustment.mutate({
      p_issue_id: selectedIssue.issue_id,
      p_note: null,
    });
  };

  // Split fields into priority and rest
  const { priorityEntries, restEntries } = useMemo(() => {
    if (!selectedIssue) return { priorityEntries: [], restEntries: [] };
    const entries = Object.entries(selectedIssue);
    const priority: [string, unknown][] = [];
    const rest: [string, unknown][] = [];
    for (const [key, value] of entries) {
      if (PRIORITY_FIELDS.includes(key)) {
        priority.push([key, value]);
      } else {
        rest.push([key, value]);
      }
    }
    // Sort priority by PRIORITY_FIELDS order
    priority.sort((a, b) => PRIORITY_FIELDS.indexOf(a[0]) - PRIORITY_FIELDS.indexOf(b[0]));
    return { priorityEntries: priority, restEntries: rest };
  }, [selectedIssue]);

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 px-4 pb-10 pt-4 md:px-6">
      <ActionBar title="AP 정합 큐" subtitle="미지급 정합 이슈를 확인하고 처리합니다." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Vendor List */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="text-sm font-semibold">공장</div>
            </CardHeader>
            <CardBody className="max-h-[70vh] overflow-y-auto p-2">
              {vendorsQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`vendor-skel-${idx}`}
                      className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3"
                    >
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
                    const openCount = row.open_count ?? 0;
                    const errorCount = row.error_count ?? 0;
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
                              {(row.vendor_name ?? vendorId) || "-"}
                            </div>
                            {row.vendor_region && (
                              <div className="text-xs text-[var(--muted)]">{row.vendor_region}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {openCount > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {openCount}
                              </span>
                            )}
                            {errorCount > 0 && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                ERR {errorCount}
                              </span>
                            )}
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

        {/* Issues List */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">이슈</div>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(normalizeStatusFilter(e.target.value))}
                  >
                    <option value="OPEN,ACKED">OPEN/ACKED</option>
                    <option value="OPEN">OPEN</option>
                    <option value="ACKED">ACKED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="IGNORED">IGNORED</option>
                  </Select>
                  <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                    <option value="ALL">ALL</option>
                    <option value="ERROR">ERROR</option>
                    <option value="WARN">WARN</option>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-2 max-h-[60vh] overflow-y-auto">
              {issuesQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : issues.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", getSeverityColor(row.severity))}>
                            {row.severity ?? "-"}
                          </span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded", getStatusColor(row.status))}>
                            {row.status ?? "-"}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--muted)]">
                          {formatDateTimeKst(row.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium truncate">
                        {row.issue_type ?? "-"}
                      </div>
                      {row.summary && (
                        <div className="mt-1 text-xs text-[var(--muted)] line-clamp-2">
                          {row.summary}
                        </div>
                      )}
                      {row.vendor_name && (
                        <div className="mt-1 text-[10px] text-[var(--muted)]">
                          {row.vendor_name}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>

        {/* Issue Detail */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="text-sm font-semibold">이슈 상세</div>
            </CardHeader>
            <CardBody className="space-y-4">
              {!selectedIssue ? (
                <div className="rounded-md border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                  이슈를 선택하세요.
                </div>
              ) : (
                <>
                  {/* Priority Fields */}
                  <div className="space-y-2 text-xs">
                    {priorityEntries.map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-2">
                        <span className="text-[var(--muted)] shrink-0">{key}</span>
                        <span className="text-right break-words max-w-[200px]">
                          {key === "created_at" ? formatDateTimeKst(value as string) : renderValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Expandable Rest Fields */}
                  {restEntries.length > 0 && (
                    <div className="border-t pt-2">
                      <button
                        type="button"
                        className="text-xs text-[var(--primary)] hover:underline"
                        onClick={() => setShowAllFields(!showAllFields)}
                      >
                        {showAllFields ? "간략히 보기" : `+${restEntries.length}개 필드 더보기`}
                      </button>
                      {showAllFields && (
                        <div className="mt-2 space-y-1 text-[11px] max-h-[200px] overflow-y-auto">
                          {restEntries.map(([key, value]) => (
                            <div key={key} className="flex items-start justify-between gap-2">
                              <span className="text-[var(--muted)] shrink-0">{key}</span>
                              <span className="text-right break-all max-w-[180px] truncate">
                                {renderValue(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3 border-t pt-3">
                    <Textarea
                      placeholder="IGNORE/RESOLVE 메모"
                      value={ignoreNote}
                      onChange={(e) => setIgnoreNote(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAck}
                        disabled={setIssueStatus.isPending}
                      >
                        ACK
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleIgnore}
                        disabled={setIssueStatus.isPending}
                      >
                        IGNORE
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleResolve}
                        disabled={setIssueStatus.isPending}
                      >
                        RESOLVE
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateAdjustment}
                        disabled={createAdjustment.isPending}
                      >
                        추천 조정 생성
                      </Button>
                    </div>
                  </div>

                  {/* Leg Details */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="text-sm font-semibold">Leg 상세</div>
                    {issueLegsQuery.isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (issueLegsQuery.data ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                        상세 정보가 없습니다.
                      </div>
                    ) : (
                      (issueLegsQuery.data ?? []).map((row, idx) => {
                        const entries = Object.entries(row);
                        const assetCode = row.asset_code ?? row.commodity_type ?? "-";
                        const qty = row.qty ?? row.amount ?? row.diff ?? null;
                        return (
                          <div
                            key={`issue-leg-${idx}`}
                            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--chip)] font-medium">
                                {String(assetCode)}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {qty !== null ? renderValue(qty) : "-"}
                              </span>
                            </div>
                            <div className="space-y-1 text-[11px] text-[var(--muted)]">
                              {entries
                                .filter(([k]) => !["asset_code", "commodity_type", "qty", "amount", "diff", "issue_leg_id", "issue_id"].includes(k))
                                .slice(0, 3)
                                .map(([key, value]) => (
                                  <div key={key} className="flex items-center justify-between gap-2">
                                    <span>{key}</span>
                                    <span className="truncate max-w-[120px]">{renderValue(value)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      })
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
