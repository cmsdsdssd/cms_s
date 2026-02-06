"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { CONTRACTS } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type FactoryPoSummaryRow = {
  po_id?: string | null;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  vendor_prefix?: string | null;
  status?: string | null;
  fax_sent_at?: string | null;
  fax_provider?: string | null;
  fax_payload_url?: string | null;
  line_count?: number | null;
  total_qty?: number | null;
  model_names?: string | null;
  customers?: string | null;
};

type FactoryPoDetailLine = {
  customer_name?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  size?: string | null;
  qty?: number | null;
  memo?: string | null;
};

type FactoryPoDetailResponse = { lines?: FactoryPoDetailLine[] } | FactoryPoDetailLine[] | null;

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

const getKstStartIso = (ymd: string) => `${ymd}T00:00:00+09:00`;

const getKstNextStartIso = (ymd: string) => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const shiftYmd = (ymd: string, delta: number) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + delta * 86400000));

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
};

const formatTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

function FactoryPoHistoryPageContent() {
  const schemaClient = getSchemaClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateParam = (searchParams.get("date") ?? "").trim();
  const vendorPartyId = (searchParams.get("vendor_party_id") ?? "").trim();
  const vendorPrefix = (searchParams.get("vendor_prefix") ?? "").trim();
  const selectedDate = useMemo(() => (isValidYmd(dateParam) ? dateParam : getKstYmd()), [dateParam]);
  const dateStartIso = useMemo(() => getKstStartIso(selectedDate), [selectedDate]);
  const dateEndIso = useMemo(() => getKstNextStartIso(selectedDate), [selectedDate]);
  const selectedVendorKey = vendorPartyId
    ? `party:${vendorPartyId}`
    : vendorPrefix
      ? `prefix:${vendorPrefix}`
      : "";
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePoId, setActivePoId] = useState<string | null>(null);

  const updateQuery = useCallback(
    (next: { date?: string; vendorPartyId?: string | null; vendorPrefix?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.date) {
        params.set("date", next.date);
      }
      if (next.vendorPartyId) {
        params.set("vendor_party_id", next.vendorPartyId);
        params.delete("vendor_prefix");
      } else if (next.vendorPartyId === null) {
        params.delete("vendor_party_id");
      }
      if (next.vendorPrefix) {
        params.set("vendor_prefix", next.vendorPrefix);
        params.delete("vendor_party_id");
      } else if (next.vendorPrefix === null) {
        params.delete("vendor_prefix");
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [searchParams, router, pathname]
  );

  const summaryQuery = useQuery({
    queryKey: ["factory-po-history", selectedDate, vendorPartyId, vendorPrefix],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from(CONTRACTS.views.factoryPoSummary)
        .select("*")
        .eq("status", "SENT_TO_VENDOR")
        .gte("fax_sent_at", dateStartIso)
        .lt("fax_sent_at", dateEndIso);
      if (vendorPartyId) {
        query = query.eq("vendor_party_id", vendorPartyId);
      } else if (vendorPrefix) {
        query = query.eq("vendor_prefix", vendorPrefix);
      }
      const { data, error } = await query.order("fax_sent_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FactoryPoSummaryRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const vendorOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();
    (summaryQuery.data ?? []).forEach((row) => {
      const prefix = (row.vendor_prefix ?? "").trim();
      const name = (row.vendor_name ?? "").trim() || prefix || "-";
      if (row.vendor_party_id) {
        map.set(`party:${row.vendor_party_id}`, {
          value: `party:${row.vendor_party_id}`,
          label: prefix ? `${name} (${prefix})` : name,
        });
      } else if (prefix) {
        map.set(`prefix:${prefix}`, {
          value: `prefix:${prefix}`,
          label: `${name} (${prefix})`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "ko-KR"));
  }, [summaryQuery.data]);

  const summaryStats = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.totalPos += 1;
        acc.totalLines += Number(row.line_count ?? 0);
        acc.totalQty += Number(row.total_qty ?? 0);
        return acc;
      },
      { totalPos: 0, totalLines: 0, totalQty: 0 }
    );
  }, [summaryQuery.data]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { vendorName: string; vendorPrefix: string; vendorPartyId: string; rows: FactoryPoSummaryRow[] }
    >();
    (summaryQuery.data ?? []).forEach((row) => {
      const key = row.vendor_party_id ?? row.vendor_prefix ?? row.po_id ?? "unknown";
      const vendorName = (row.vendor_name ?? "").trim() || (row.vendor_prefix ?? "").trim() || "미지정";
      const vendorPrefixValue = (row.vendor_prefix ?? "").trim();
      const entry =
        map.get(key) ??
        {
          vendorName,
          vendorPrefix: vendorPrefixValue,
          vendorPartyId: row.vendor_party_id ?? "",
          rows: [],
        };
      entry.rows.push(row);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName, "ko-KR"));
  }, [summaryQuery.data]);

  const detailQuery = useQuery({
    queryKey: ["factory-po-detail", activePoId],
    queryFn: async () => {
      if (!activePoId) return null;
      return callRpc<FactoryPoDetailResponse>(CONTRACTS.functions.factoryPoGetDetails, {
        p_po_id: activePoId,
      });
    },
    enabled: Boolean(activePoId) && detailOpen,
  });

  const detailLines = useMemo(() => {
    const data = detailQuery.data;
    if (!data) return [] as FactoryPoDetailLine[];
    if (Array.isArray(data)) return data as FactoryPoDetailLine[];
    if (typeof data === "object" && data !== null && "lines" in data) {
      const linesValue = (data as { lines?: unknown }).lines;
      if (Array.isArray(linesValue)) return linesValue as FactoryPoDetailLine[];
    }
    return [] as FactoryPoDetailLine[];
  }, [detailQuery.data]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="공장발주 전송내역"
          subtitle={`기준일: ${selectedDate} · SENT_TO_VENDOR · FAX sent`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(selectedDate, -1) })}>
                  ◀
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    if (!isValidYmd(next)) return;
                    updateQuery({ date: next });
                  }}
                  className="h-8 w-[140px]"
                />
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(selectedDate, 1) })}>
                  ▶
                </Button>
              </div>
              <div className="min-w-[220px]">
                <SearchSelect
                  placeholder="공장 검색..."
                  options={vendorOptions}
                  value={selectedVendorKey || undefined}
                  onChange={(value) => {
                    if (value.startsWith("party:")) {
                      updateQuery({ vendorPartyId: value.replace("party:", "") });
                      return;
                    }
                    if (value.startsWith("prefix:")) {
                      updateQuery({ vendorPrefix: value.replace("prefix:", "") });
                      return;
                    }
                    updateQuery({ vendorPartyId: null, vendorPrefix: null });
                  }}
                  className="space-y-1"
                  showResultsOnEmptyQuery
                />
              </div>
              <Button variant="secondary" onClick={() => updateQuery({ vendorPartyId: null, vendorPrefix: null })}>
                전체
              </Button>
              <Button variant="secondary" onClick={() => summaryQuery.refetch()}>
                새로고침
              </Button>
            </div>
          }
        />
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">전송 PO 수</div>
              <div className="text-xl font-semibold tabular-nums">{summaryStats.totalPos}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 라인 수</div>
              <div className="text-xl font-semibold tabular-nums">{formatNumber(summaryStats.totalLines)}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 수량</div>
              <div className="text-xl font-semibold tabular-nums">{formatNumber(summaryStats.totalQty)}</div>
            </CardBody>
          </Card>
        </div>

        {summaryQuery.isLoading ? (
          <div className="text-sm text-[var(--muted)]">로딩 중...</div>
        ) : grouped.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">조회된 전송 내역이 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <Card key={`${group.vendorPartyId}-${group.vendorPrefix}`} className="border-[var(--panel-border)]">
                <CardHeader className="border-b border-[var(--panel-border)] py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{group.vendorName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {group.vendorPrefix ? `Prefix: ${group.vendorPrefix}` : "Prefix 없음"}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{group.rows.length}건</div>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[var(--panel-border)]">
                    {group.rows.map((row) => (
                      <div key={row.po_id ?? "unknown"} className="p-4 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold tabular-nums">
                            {formatTimeKst(row.fax_sent_at)} 전송
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                if (!row.fax_payload_url) return;
                                window.open(row.fax_payload_url, "_blank");
                              }}
                              disabled={!row.fax_payload_url}
                            >
                              FAX 열기
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setActivePoId(row.po_id ?? null);
                                setDetailOpen(true);
                              }}
                            >
                              상세
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
                          <div>라인 {formatNumber(row.line_count ?? 0)}</div>
                          <div>수량 {formatNumber(row.total_qty ?? 0)}</div>
                          <div className="uppercase">{row.fax_provider ?? "-"}</div>
                        </div>
                        <div className="text-xs">
                          <div className={cn("truncate", row.model_names ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
                            모델: {row.model_names ?? "-"}
                          </div>
                          <div
                            className={cn(
                              "truncate",
                              row.customers ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                            )}
                          >
                            거래처: {row.customers ?? "-"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setActivePoId(null);
        }}
        title="발주 상세"
        className="max-w-4xl"
      >
        {detailQuery.isLoading ? (
          <div className="text-sm text-[var(--muted)]">로딩 중...</div>
        ) : detailLines.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">표시할 라인 정보가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--chip)] text-[var(--muted)] font-medium border-b border-[var(--panel-border)]">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">거래처</th>
                  <th className="px-3 py-2 whitespace-nowrap">모델</th>
                  <th className="px-3 py-2 whitespace-nowrap">Suffix</th>
                  <th className="px-3 py-2 whitespace-nowrap">색상</th>
                  <th className="px-3 py-2 whitespace-nowrap">사이즈</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">수량</th>
                  <th className="px-3 py-2 whitespace-nowrap">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)]">
                {detailLines.map((line, index) => (
                  <tr key={`${line.model_name ?? "line"}-${index}`} className="hover:bg-[var(--panel-hover)]">
                    <td className="px-3 py-2">{line.customer_name ?? "-"}</td>
                    <td className="px-3 py-2">{line.model_name ?? "-"}</td>
                    <td className="px-3 py-2">{line.suffix ?? "-"}</td>
                    <td className="px-3 py-2">{line.color ?? "-"}</td>
                    <td className="px-3 py-2">{line.size ?? "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(line.qty ?? 0)}</td>
                    <td className="px-3 py-2">{line.memo ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function FactoryPoHistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)] px-6 py-6 text-sm text-[var(--muted)]">로딩 중...</div>}>
      <FactoryPoHistoryPageContent />
    </Suspense>
  );
}
