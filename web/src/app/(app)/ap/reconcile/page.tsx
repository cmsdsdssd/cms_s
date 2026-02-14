"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
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
  details?: unknown;
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


const JsonBlock = ({ value }: { value: unknown }) => {
  try {
    return (
      <pre className="mt-2 max-h-[260px] overflow-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-[11px]">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  } catch {
    return <div className="text-xs">{String(value)}</div>;
  }
};

function IssueDetailsPanel({ issue }: { issue: ReconcileIssueRow }) {
  const details = issue.details as any;
  if (!details || typeof details !== "object") return null;

  if (issue.issue_type === "RECENT_PAYMENT_INCONSISTENT") {
    return (
      <div className="rounded-lg border border-[var(--panel-border)] p-3">
        <div className="text-sm font-semibold">최근결제(best-fit) 힌트</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--muted)]">best_candidate:</span>{" "}
            {String(details.best_candidate ?? "-")}
          </div>
          <div>
            <span className="text-[var(--muted)]">best_score:</span> {String(details.best_score ?? "-")}
          </div>
          <div>
            <span className="text-[var(--muted)]">factory_ref_date:</span>{" "}
            {String(details.factory_ref_date ?? "-")}
          </div>
          <div>
            <span className="text-[var(--muted)]">last_pay_date:</span> {String(details.last_pay_date ?? "-")}
          </div>
          <div className="col-span-2">
            <span className="text-[var(--muted)]">as_of_occurred_at:</span>{" "}
            {String(details.as_of_occurred_at ?? details.cur_occurred_at ?? "-")}
          </div>
        </div>
        <JsonBlock value={details} />
      </div>
    );
  }

  if (issue.issue_type === "FACTORY_POST_NEQ_SYSTEM_ASOF") {
    const rows = Array.isArray(details.system_position) ? details.system_position : [];
    return (
      <div className="rounded-lg border border-[var(--panel-border)] p-3">
        <div className="text-sm font-semibold">시스템 포지션(as-of) (due/paid/alloc/net/credit)</div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--panel-border)]">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-[var(--chip)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">asset</th>
                <th className="px-3 py-2 text-right font-medium">due</th>
                <th className="px-3 py-2 text-right font-medium">paid</th>
                <th className="px-3 py-2 text-right font-medium">alloc</th>
                <th className="px-3 py-2 text-right font-medium">net_balance</th>
                <th className="px-3 py-2 text-right font-medium">allocated_balance</th>
                <th className="px-3 py-2 text-right font-medium">unallocated_credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, idx: number) => (
                <tr key={idx} className="border-t border-[var(--panel-border)]">
                  <td className="px-3 py-2">{String(r.asset_code ?? "-")}</td>
                  <td className="px-3 py-2 text-right">{String(r.due ?? "-")}</td>
                  <td className="px-3 py-2 text-right">{String(r.paid ?? "-")}</td>
                  <td className="px-3 py-2 text-right">{String(r.alloc ?? "-")}</td>
                  <td className="px-3 py-2 text-right font-semibold">{String(r.net_balance ?? "-")}</td>
                  <td className="px-3 py-2 text-right">{String(r.allocated_balance ?? "-")}</td>
                  <td className="px-3 py-2 text-right">{String(r.unallocated_credit ?? "-")}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-[var(--muted)]" colSpan={7}>
                    details.system_position 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-[var(--muted)]">
          as_of_occurred_at: {String(details.as_of_occurred_at ?? "-")}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--panel-border)] p-3">
      <div className="text-sm font-semibold">details</div>
      <JsonBlock value={details} />
    </div>
  );
}

const toSeverityLabel = (severity?: string | null) => {
  switch (severity?.toUpperCase()) {
    case "ERROR":
      return "오류";
    case "WARN":
      return "경고";
    default:
      return severity ?? "-";
  }
};

const toStatusLabel = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "OPEN":
      return "미해결";
    case "ACKED":
      return "확인완료";
    case "RESOLVED":
      return "해결완료";
    case "IGNORED":
      return "무시";
    default:
      return status ?? "-";
  }
};

const toIssueTypeLabel = (issueType?: string | null) => {
  switch (issueType) {
    case "PRE_NEQ_PREV_POST":
      return "이전 POST와 현재 PRE 불일치";
    case "PRE_PLUS_SALE_NEQ_POST":
      return "PRE + SALE - 최근결제 vs POST 불일치";
    case "FACTORY_POST_NEQ_SYSTEM_ASOF":
      return "공장 POST vs 시스템 NET(as-of) 불일치";
    case "RECENT_PAYMENT_INCONSISTENT":
      return "공장 최근결제 vs 시스템 결제 불일치 (best-fit)";
    case "FACTORY_SALE_NEQ_INTERNAL_CALC":
      return "공장 SALE vs 내부 계산 불일치";
    default:
      return issueType ?? "-";
  }
};

const toIssueTypeDescription = (issueType?: string | null) => {
  switch (issueType) {
    case "PRE_NEQ_PREV_POST":
      return "이전 영수증의 POST(거래 후 미수)와 현재 영수증의 PRE(거래 전 미수)가 일치하는지 확인합니다.";
    case "PRE_PLUS_SALE_NEQ_POST":
      return "공장 4행 산식(PRE + SALE - 최근결제 = POST)이 맞는지 확인합니다.";
    case "FACTORY_POST_NEQ_SYSTEM_ASOF":
      return "공장 POST(거래 후 미수)와 시스템 NET 잔액(as-of occurred_at)이 일치하는지 확인합니다.";
    case "RECENT_PAYMENT_INCONSISTENT":
      return "공장 최근결제와 시스템 결제내역이 (best-fit 기준으로) 일치하는지 확인합니다.";
    case "FACTORY_SALE_NEQ_INTERNAL_CALC":
      return "공장 SALE(판매)와 내부 라인 기반 계산값이 일치하는지 확인합니다.";
    default:
      return "";
  }
};

const toIssueSummaryKorean = (issueType?: string | null, summary?: string | null) => {
  if (!summary) return toIssueTypeDescription(issueType) || "-";

  
// ── v0430+ (best-fit / occurred_at / NET) summary mappings ──
if (summary === "PRE_BALANCE(current) != POST_BALANCE(previous) (check missing/backdated receipt order)") {
  return "현재 PRE가 이전 영수증 POST와 다릅니다. (누락/백데이트/정렬 문제 가능)";
}
if (
  summary === "PRE + SALE - RECENT_PAYMENT != POST_BALANCE (factory statement inconsistent or missing component)"
) {
  return "공장 4행 산식(PRE + SALE - 최근결제 = POST)이 맞지 않습니다. (팩스 입력/누락 요소 점검)";
}
if (
  summary ===
    "RECENT_PAYMENT(factory) != system payments (best-fit window). Check ref_date/window or missing payment entry."
) {
  return "공장 ‘최근결제’가 시스템 결제와 다릅니다. (best-fit 기준/결제 누락/기준일 확인)";
}
if (
  summary ===
    "POST_BALANCE(factory) != system NET balance(as-of occurred_at). Check missing SALE sync, wrong payment entry, or adjustment needed."
) {
  return "공장 POST와 시스템 NET 잔액(as-of)이 다릅니다. (SALE sync 누락/결제 누락/조정 필요)";
}
if (summary === "PRE_BALANCE + SALE - RECENT_PAYMENT != POST_BALANCE (requires adjustment or missing component)") {
  return "PRE + SALE - 최근결제 값이 POST와 다릅니다. 누락/정정/조정이 필요할 수 있습니다.";
}
if (
  summary ===
    "POST_BALANCE(factory) != system NET balance(as-of occurred_at). Check missing SALE invoice, wrong payment entry, or adjustment needed."
) {
  return "공장 POST와 시스템 NET 잔액(as-of)이 다릅니다. (SALE 누락/결제 입력 오류/조정 필요)";
}
if (summary === "PRE_BALANCE != previous POST_BALANCE (asset-level mismatch)") {
    return "현재 PRE_BALANCE가 이전 영수증 POST_BALANCE와 자산 단위로 일치하지 않습니다.";
  }
  if (summary === "PRE_BALANCE + SALE != POST_BALANCE (requires adjustment or missing component)") {
    return "PRE_BALANCE + SALE 값이 POST_BALANCE와 다릅니다. 누락 라인 또는 조정이 필요합니다.";
  }
  if (summary === "FACTORY SALE != INTERNAL CALC (review receipt line inputs / calc rules)") {
    return "공장 SALE과 내부 계산값이 다릅니다. 영수증 라인 입력/계산 규칙을 확인하세요.";
  }
  if (
    summary ===
    "RECENT_PAYMENT != system payments in period (prev issued_at, current issued_at] (check window/ref_date)"
  ) {
    return "공장 최근결제와 해당 기간 시스템 결제합이 다릅니다. 기간/기준일(ref_date)을 확인하세요.";
  }
  if (
    summary ===
    "POST_BALANCE(factory) != system balance(as-of issued_at). Check missing SALE invoice, wrong payment alloc, or adjustment needed."
  ) {
    return "공장 POST_BALANCE와 발행일 기준 시스템 잔액이 다릅니다. SALE 누락/결제배분 오류/조정을 확인하세요.";
  }

  return summary;
};

const toIssueFieldLabel = (key: string) => {
  switch (key) {
    case "summary":
      return "요약";
    case "issue_type":
      return "이슈유형";
    case "severity":
      return "심각도";
    case "status":
      return "상태";
    case "created_at":
      return "생성시각";
    case "vendor_name":
      return "공장명";
    case "vendor_party_id":
      return "공장ID";
    case "receipt_id":
      return "영수증ID";
    case "snapshot_version":
      return "스냅샷버전";
    case "calc_version":
      return "계산버전";
    case "issue_id":
      return "이슈ID";
    case "expected":
      return "기준값";
    case "actual":
      return "실제값";
    case "acutal":
      return "실제값";
    case "diff":
      return "차이";
    case "asset_code":
      return "자산";
    case "commodity_type":
      return "자산유형";
    case "qty":
      return "수량";
    case "amount":
      return "금액";
    case "vendor":
      return "공장";
    case "vendor_id":
      return "공장ID";
    case "vendor_code":
      return "공장코드";
    case "vendor_region":
      return "공장권역";
    case "vendor_mask_code":
      return "공장마스크코드";
    case "vendor_seq_no":
      return "공장순번";
    case "movement_code":
      return "전표코드";
    case "memo":
      return "메모";
    case "note":
      return "비고";
    default:
      return key;
  }
};

const toAssetLabel = (assetCode?: string | null) => {
  switch (assetCode) {
    case "XAU_G":
      return "금(g)";
    case "XAG_G":
      return "은(g)";
    case "KRW_LABOR":
      return "공임(원)";
    case "KRW_MATERIAL":
      return "소재비(원)";
    default:
      return assetCode ?? "-";
  }
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
const HIDDEN_FIELDS = ["details"];

type IssueSortKey = "created_desc" | "created_asc" | "severity_desc" | "issue_type_asc";

const ISSUE_SORT_STORAGE_KEY = "ap-reconcile:issue-sort";

const getSeverityRank = (severity?: string | null) => {
  switch ((severity ?? "").toUpperCase()) {
    case "ERROR":
      return 3;
    case "WARN":
      return 2;
    case "INFO":
      return 1;
    default:
      return 0;
  }
};

const getDateValue = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"issues" | "detail">("issues");
  const [issueSort, setIssueSort] = useState<IssueSortKey>(() => {
    if (typeof window === "undefined") return "severity_desc";
    const saved = window.localStorage.getItem(ISSUE_SORT_STORAGE_KEY);
    if (saved === "created_desc" || saved === "created_asc" || saved === "severity_desc" || saved === "issue_type_asc") {
      return saved;
    }
    return "severity_desc";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ISSUE_SORT_STORAGE_KEY, issueSort);
  }, [issueSort]);

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
  const sortedIssues = useMemo(() => {
    const list = [...issues];
    if (issueSort === "created_desc") {
      return list.sort((a, b) => getDateValue(b.created_at) - getDateValue(a.created_at));
    }
    if (issueSort === "created_asc") {
      return list.sort((a, b) => getDateValue(a.created_at) - getDateValue(b.created_at));
    }
    if (issueSort === "issue_type_asc") {
      return list.sort((a, b) => {
        const typeA = (a.issue_type ?? "").toString();
        const typeB = (b.issue_type ?? "").toString();
        const typeCompare = typeA.localeCompare(typeB, "ko");
        if (typeCompare !== 0) return typeCompare;
        return getDateValue(b.created_at) - getDateValue(a.created_at);
      });
    }
    return list.sort((a, b) => {
      const sev = getSeverityRank(b.severity) - getSeverityRank(a.severity);
      if (sev !== 0) return sev;
      const statusA = (a.status ?? "").toString();
      const statusB = (b.status ?? "").toString();
      const statusCompare = statusA.localeCompare(statusB, "ko");
      if (statusCompare !== 0) return statusCompare;
      return getDateValue(b.created_at) - getDateValue(a.created_at);
    });
  }, [issues, issueSort]);
  const vendors = vendorsQuery.data ?? [];

  const filteredVendors = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return vendors;
    return vendors.filter((row) => {
      const name = (row.vendor_name ?? "").toLowerCase();
      const region = (row.vendor_region ?? "").toLowerCase();
      return name.includes(keyword) || region.includes(keyword);
    });
  }, [searchQuery, vendors]);

  const selectedVendor = useMemo(
    () => vendors.find((row) => (row.vendor_party_id ?? "") === selectedVendorId) ?? null,
    [vendors, selectedVendorId]
  );

  const vendorSummary = useMemo(() => {
    return vendors.reduce<{ open: number; error: number; warn: number }>(
      (acc, row) => {
        acc.open += Number(row.open_count ?? 0);
        acc.error += Number(row.error_count ?? 0);
        acc.warn += Number(row.warn_count ?? 0);
        return acc;
      },
      { open: 0, error: 0, warn: 0 }
    );
  }, [vendors]);

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
      if (HIDDEN_FIELDS.includes(key)) continue;
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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]" id="ap-reconcile.root">
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search className="w-5 h-5" />
            공장 찾기
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <Input
              placeholder="공장명/권역 검색..."
              className="pl-9 bg-[var(--chip)] border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 py-3 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">열린 정합 이슈</span>
          <span className="font-bold text-[var(--foreground)]">{vendorSummary.open}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
          ) : filteredVendors.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] text-sm text-[var(--muted)]">
              조회 결과가 없습니다.
            </div>
          ) : (
            filteredVendors.map((row, idx) => {
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
                      ? "border-[var(--primary)] bg-[var(--chip)]"
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
                          오류 {errorCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{selectedVendor?.vendor_name ?? "AP 정합 큐"}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-medium">
                  reconcile
                </span>
                {(selectedVendor?.error_count ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                    AP 결제 차단
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--muted)] flex items-center gap-2">
                권역: {selectedVendor?.vendor_region ?? "-"}
              </p>
              {(selectedVendor?.error_count ?? 0) > 0 && (
                <p className="mt-1 text-xs text-red-700">
                  결제 차단됨: reconcile ERROR 해결 후 /ap에서 결제를 진행할 수 있습니다.
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                vendorsQuery.refetch();
                issuesQuery.refetch();
                issueLegsQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">OPEN</p>
              <p className="text-lg font-bold tabular-nums text-[var(--danger)]">{vendorSummary.open}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">ERROR</p>
              <p className="text-lg font-bold tabular-nums">{vendorSummary.error}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">WARN</p>
              <p className="text-lg font-bold tabular-nums">{vendorSummary.warn}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-1">현재 이슈 수</p>
              <p className="text-lg font-bold tabular-nums">{issues.length}</p>
            </div>
          </div>
        </div>

        <div className="flex border-b border-[var(--panel-border)] px-6 bg-[var(--panel)] sticky top-0">
          <button
            onClick={() => setActiveTab("issues")}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "issues"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            이슈 목록
          </button>
          <button
            onClick={() => setActiveTab("detail")}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "detail"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            이슈 상세
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "issues" && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">이슈</div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(normalizeStatusFilter(e.target.value))}
                    >
                      <option value="OPEN,ACKED">미해결/확인완료</option>
                      <option value="OPEN">미해결</option>
                      <option value="ACKED">확인완료</option>
                      <option value="RESOLVED">해결완료</option>
                      <option value="IGNORED">무시</option>
                    </Select>
                    <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                      <option value="ALL">전체</option>
                      <option value="ERROR">오류</option>
                      <option value="WARN">경고</option>
                    </Select>
                    <Select value={issueSort} onChange={(e) => setIssueSort(e.target.value as IssueSortKey)}>
                      <option value="severity_desc">오류우선</option>
                      <option value="created_desc">최신순</option>
                      <option value="created_asc">오래된순</option>
                      <option value="issue_type_asc">유형순</option>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-2 max-h-[60vh] overflow-y-auto">
              {issuesQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : sortedIssues.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                  이슈가 없습니다.
                </div>
              ) : (
                sortedIssues.map((row, idx) => {
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
                            {toSeverityLabel(row.severity)}
                          </span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded", getStatusColor(row.status))}>
                            {toStatusLabel(row.status)}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--muted)]">
                          {formatDateTimeKst(row.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium truncate">
                        {toIssueTypeLabel(row.issue_type)}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--muted)] line-clamp-2">
                        {toIssueTypeDescription(row.issue_type)}
                      </div>
                      {row.summary && (
                        <div className="mt-1 text-xs text-[var(--muted)] line-clamp-2">
                          {toIssueSummaryKorean(row.issue_type, row.summary)}
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
          )}

          {activeTab === "detail" && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
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
                          <span className="text-[var(--muted)] shrink-0">{toIssueFieldLabel(key)}</span>
                          <span className="text-right break-words max-w-[200px]">
                            {key === "created_at"
                              ? formatDateTimeKst(value as string)
                              : key === "severity"
                                ? toSeverityLabel(value as string)
                              : key === "status"
                                ? toStatusLabel(value as string)
                                : key === "issue_type"
                                  ? toIssueTypeLabel(value as string)
                                  : key === "summary"
                                    ? toIssueSummaryKorean(selectedIssue?.issue_type, value as string)
                                : renderValue(value)}
                          </span>
                      </div>
                    ))}
                  </div>

                  <IssueDetailsPanel issue={selectedIssue as ReconcileIssueRow} />

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
                              <span className="text-[var(--muted)] shrink-0">{toIssueFieldLabel(key)}</span>
                              <span className="text-right break-all max-w-[180px] truncate">
                                  {key === "severity"
                                    ? toSeverityLabel(value as string)
                                    : key === "status"
                                      ? toStatusLabel(value as string)
                                      : key === "issue_type"
                                        ? toIssueTypeLabel(value as string)
                                        : key === "summary"
                                          ? toIssueSummaryKorean(selectedIssue?.issue_type, value as string)
                                      : renderValue(value)}
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
                      placeholder="무시/해결 메모"
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
                        확인
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleIgnore}
                        disabled={setIssueStatus.isPending}
                      >
                        무시
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleResolve}
                        disabled={setIssueStatus.isPending}
                      >
                        해결
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
                    <div className="text-sm font-semibold">레그 상세 (expected / actual / diff)</div>
                    {issueLegsQuery.isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (issueLegsQuery.data ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                        상세 정보가 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)]">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="bg-[var(--chip)] text-[var(--muted)]">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">자산</th>
                              <th className="px-3 py-2 text-right font-medium">기준값(expected)</th>
                              <th className="px-3 py-2 text-right font-medium">실제값(actual)</th>
                              <th className="px-3 py-2 text-right font-medium">차이(diff)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(issueLegsQuery.data ?? []).map((row, idx) => {
                              const assetCode =
                                typeof row.asset_code === "string"
                                  ? row.asset_code
                                  : typeof row.commodity_type === "string"
                                    ? row.commodity_type
                                    : "-";
                              const expected = row.expected ?? row.expected_qty ?? row.expected_amount ?? null;
                              const actual = row.actual ?? row.acutal ?? row.actual_qty ?? row.actual_amount ?? null;
                              const diff = row.diff ?? row.diff_qty ?? row.diff_amount ?? null;

                              return (
                                <tr key={`issue-leg-row-${idx}`} className="border-t border-[var(--panel-border)] bg-[var(--panel)]">
                                  <td className="px-3 py-2 font-medium">{toAssetLabel(assetCode)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{renderValue(expected)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{renderValue(actual)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{renderValue(diff)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
              </CardBody>
            </Card>
          )}
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
