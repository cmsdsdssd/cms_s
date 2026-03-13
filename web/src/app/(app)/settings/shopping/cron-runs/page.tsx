"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { shopApiGet } from "@/lib/shop/http";
import { buildThresholdProfileSummary } from "@/lib/shop/price-sync-run-summary.js";

type Channel = { channel_id: string; channel_name: string; channel_code: string };

type SyncRun = {
  run_id: string;
  channel_id: string;
  pinned_compute_request_id: string | null;
  publish_version?: string | null;
  channel_threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  request_payload?: { summary?: { threshold_profile?: "GENERAL" | "MARKET_LINKED" | null } | null } | null;
  due_master_count?: number | null;
  scheduler_reason?: string | null;
  interval_minutes: number;
  trigger_type: "AUTO" | "MANUAL";
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "CANCELLED";
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
};

type RunIntent = {
  intent_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  desired_price_krw: number | null;
  publish_version?: string | null;
  snapshot_desired_price_krw?: number | null;
  effective_desired_price_krw?: number | null;
  floor_price_krw: number;
  floor_applied: boolean;
  state: "PENDING" | "SUCCEEDED" | "SKIPPED" | "FAILED";
  threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  channel_threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  effective_threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  threshold_profile_override_active?: boolean | null;
  updated_at: string | null;
  created_at: string;
  reason_code?: string | null;
  reason_label?: string | null;
  task_last_error?: string | null;
  applied_before_price_krw?: number | null;
  applied_target_price_krw?: number | null;
  applied_after_price_krw?: number | null;
  task_sync_job_id?: string | null;
};

type ReasonSummaryRow = {
  status: "FAILED" | "SKIPPED";
  reason_code: string;
  reason_label: string;
  reason_category: string;
  count: number;
};

type SchedulerLease = {
  channel_id: string;
  owner_token: string;
  lease_expires_at: string | null;
  last_tick_started_at: string | null;
  last_tick_finished_at: string | null;
  last_tick_status: string | null;
  last_tick_error: string | null;
  updated_at: string | null;
};

type SchedulerSummary = {
  active_master_count: number;
  scheduled_master_count: number;
  due_master_count: number;
  due_profile_counts?: Record<string, number>;
  lease: SchedulerLease | null;
  migration_ready: boolean;
  migration_error: string | null;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");
const fmtTs = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR");
};

const toRunStatusKo = (value: SyncRun["status"]) => {
  if (value === "RUNNING") return "진행중";
  if (value === "SUCCESS") return "성공";
  if (value === "PARTIAL") return "부분성공";
  if (value === "FAILED") return "실패";
  if (value === "CANCELLED") return "취소";
  return value;
};

const CRON_TICK_PREFIX = "CRON_TICK:";

const toRunNote = (run: SyncRun) => {
  const raw = String(run.error_message ?? "").trim();
  if (!raw) return "-";
  if (raw.toUpperCase().startsWith(CRON_TICK_PREFIX)) {
    const reason = raw.slice(CRON_TICK_PREFIX.length).trim() || "UNKNOWN";
    return `크론 체크: ${reason}`;
  }
  return raw;
};

const toIntentStateKo = (value: RunIntent["state"]) => {
  if (value === "PENDING") return "대기";
  if (value === "SUCCEEDED") return "성공";
  if (value === "SKIPPED") return "건너뜀";
  if (value === "FAILED") return "실패";
  return value;
};

export default function ShoppingCronRunsPage() {
  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].channel_id);
  }, [channelId, channels]);

  const runsQuery = useQuery({
    queryKey: ["shop-sync-runs-v2", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: SyncRun[]; scheduler?: SchedulerSummary }>(`/api/price-sync-runs-v2?channel_id=${encodeURIComponent(channelId)}&limit=200`),
    refetchInterval: 10_000,
  });

  const runs = runsQuery.data?.data ?? [];
  const scheduler = runsQuery.data?.scheduler ?? null;
  const [selectedRunId, setSelectedRunId] = useState("");
  useEffect(() => {
    if (!selectedRunId && runs.length > 0) setSelectedRunId(runs[0].run_id);
  }, [selectedRunId, runs]);

  const detailQuery = useQuery({
    queryKey: ["shop-sync-run-v2-detail", selectedRunId],
    enabled: Boolean(selectedRunId),
    queryFn: () =>
      shopApiGet<{
        data: {
          run: SyncRun;
          intents: RunIntent[];
          summary?: {
            reasons: ReasonSummaryRow[];
            skipped_reasons: ReasonSummaryRow[];
            failed_reasons: ReasonSummaryRow[];
          };
        };
      }>(`/api/price-sync-runs-v2/${selectedRunId}`),
    refetchInterval: 10_000,
  });

  const run = detailQuery.data?.data.run ?? null;
  const intents = detailQuery.data?.data.intents ?? [];
  const reasons = detailQuery.data?.data.summary?.reasons ?? [];
  const selectedRunThreshold = buildThresholdProfileSummary({
    channelThresholdProfile: run?.channel_threshold_profile ?? run?.request_payload?.summary?.threshold_profile ?? null,
    effectiveThresholdProfile: intents.find((item) => item.effective_threshold_profile)?.effective_threshold_profile ?? intents.find((item) => item.threshold_profile)?.threshold_profile ?? null,
  });
  const failedReasons = detailQuery.data?.data.summary?.failed_reasons ?? [];
  const skippedReasons = detailQuery.data?.data.summary?.skipped_reasons ?? [];

  return (
    <div className="space-y-4">
      <ActionBar title="자동동기화 런 로그" subtitle="run/intent 기준으로 cron 실행 이력을 추적" />

      <ShoppingPageHeader
        purpose="자동동기화 대상 수, 실행 결과, 사유 코드를 한 화면에서 확인합니다."
        status={[
          { label: "최근 run", value: `${runs.length}건` },
          { label: "due master", value: scheduler ? `${scheduler.due_master_count}건` : "-", tone: scheduler?.migration_ready ? "good" : "warn" },
          { label: "lease", value: scheduler?.lease?.last_tick_status ?? (scheduler?.migration_ready ? "idle" : "미적용"), tone: scheduler?.lease?.last_tick_error ? "warn" : "good" },
          { label: "선택 run", value: selectedRunId ? selectedRunId.slice(0, 8) : "미선택", tone: selectedRunId ? "good" : "warn" },
        ]}
        nextActions={[
          { label: "동기화 Job 로그", href: "/settings/shopping/sync-jobs" },
          { label: "자동 가격 설정", href: "/settings/shopping/auto-price" },
        ]}
      />

      <Card>
        <CardHeader title="Scheduler 상태" description="mixed cadence due/lease 상태를 확인합니다." />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
              <div className="text-xs text-[var(--muted)]">active master</div>
              <div className="mt-1 text-lg font-semibold">{scheduler ? fmt(scheduler.active_master_count) : "-"}</div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
              <div className="text-xs text-[var(--muted)]">scheduled master</div>
              <div className="mt-1 text-lg font-semibold">{scheduler ? fmt(scheduler.scheduled_master_count) : "-"}</div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
              <div className="text-xs text-[var(--muted)]">due master</div>
              <div className="mt-1 text-lg font-semibold">{scheduler ? fmt(scheduler.due_master_count) : "-"}</div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
              <div className="text-xs text-[var(--muted)]">lease 상태</div>
              <div className="mt-1 text-lg font-semibold">{scheduler?.lease?.last_tick_status ?? (scheduler?.migration_ready ? "IDLE" : "미적용")}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3 text-sm">
              <div className="mb-2 font-medium">due profile 분포</div>
              <div className="space-y-1 text-xs">
                <div>GENERAL: {fmt(scheduler?.due_profile_counts?.GENERAL ?? 0)}</div>
                <div>MARKET_LINKED: {fmt(scheduler?.due_profile_counts?.MARKET_LINKED ?? 0)}</div>
              </div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3 text-sm">
              <div className="mb-2 font-medium">lease detail</div>
              <div className="space-y-1 text-xs text-[var(--muted)]">
                <div>started: {fmtTs(scheduler?.lease?.last_tick_started_at)}</div>
                <div>finished: {fmtTs(scheduler?.lease?.last_tick_finished_at)}</div>
                <div>expires: {fmtTs(scheduler?.lease?.lease_expires_at)}</div>
                <div>error: {scheduler?.lease?.last_tick_error ?? scheduler?.migration_error ?? '-'}</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="조회 조건" />
        <CardBody>
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">채널 선택</option>
            {channels.map((ch) => (
              <option key={ch.channel_id} value={ch.channel_id}>
                {ch.channel_name} ({ch.channel_code})
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Run 목록" description={`총 ${runs.length}건`} />
          <CardBody>
            <div className="max-h-[520px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">run_id</th>
                    <th className="px-3 py-2">시작시간</th>
                    <th className="px-3 py-2">트리거</th>
                    <th className="px-3 py-2">scope</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">비고</th>
                    <th className="px-3 py-2">성공/실패/건너뜀/총계</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.run_id}
                      className={`cursor-pointer border-t border-[var(--hairline)] ${selectedRunId === r.run_id ? "bg-[var(--panel)]" : ""}`}
                      onClick={() => setSelectedRunId(r.run_id)}
                    >
                      <td className="px-3 py-2">{r.run_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtTs(r.started_at ?? r.created_at)}</td>
                      <td className="px-3 py-2">{r.trigger_type}</td>
                      <td className="px-3 py-2 text-xs">{r.scheduler_reason ?? "-"} / {fmt(r.due_master_count)}</td>
                      <td className="px-3 py-2">{toRunStatusKo(r.status)}</td>
                      <td className="px-3 py-2 text-xs">{toRunNote(r)}</td>
                      <td className="px-3 py-2">{r.success_count}/{r.failed_count}/{r.skipped_count}/{r.total_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Run 상세"
            description={run ? `interval=${run.interval_minutes}m · 게시 버전=${run.publish_version ?? run.pinned_compute_request_id ?? "-"} · 채널 threshold=${run.channel_threshold_profile ?? run.request_payload?.summary?.threshold_profile ?? "-"}` : "run 선택"}
          />
          <CardBody>
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <div className="mb-2 text-sm font-medium">실패 사유</div>
                {failedReasons.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">없음</div>
                ) : (
                  <div className="space-y-1 text-xs">
                    {failedReasons.map((row) => (
                      <div key={`failed-${row.reason_code}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.reason_label} ({row.reason_code})</span>
                        <span className="shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <div className="mb-2 text-sm font-medium">건너뜀 사유</div>
                {skippedReasons.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">없음</div>
                ) : (
                  <div className="space-y-1 text-xs">
                    {skippedReasons.map((row) => (
                      <div key={`skipped-${row.reason_code}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.reason_label} ({row.reason_code})</span>
                        <span className="shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className='mb-2 text-xs text-[var(--muted)]'>
              게시 기준 목표가는 publish 기준이고, 실반영 목표가/실반영 후는 push 작업 결과 기준입니다. 스냅샷 값은 debug 비교용입니다.
            </div>
            <div className="mb-3 rounded-[var(--radius)] border border-[var(--hairline)] p-3 text-sm">
              <div className="mb-2 font-medium">threshold 프로필</div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <div>채널 기본</div>
                <div className="text-right">{selectedRunThreshold.channelThresholdProfile ?? "-"}</div>
                <div>상품 적용</div>
                <div className="text-right">{selectedRunThreshold.effectiveThresholdProfile ?? "-"}</div>
                <div>override</div>
                <div className="text-right">{selectedRunThreshold.isOverrideActive ? "Y" : "N"}</div>
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">master_item_id</th>
                    <th className="px-3 py-2">product_no</th>
                    <th className="px-3 py-2">variant_code</th>
                    <th className="px-3 py-2">게시 기준 목표가</th>
                    <th className="px-3 py-2">실제 push 목표가</th>
                    <th className="px-3 py-2">실반영 후</th>
                    <th className="px-3 py-2">바닥가</th>
                    <th className="px-3 py-2">바닥가 적용</th>
                    <th className="px-3 py-2">채널 기본 threshold</th>
                    <th className="px-3 py-2">상품 적용 threshold</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">사유코드</th>
                    <th className="px-3 py-2">오류</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map((it) => (
                    <tr key={it.intent_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{it.master_item_id}</td>
                      <td className="px-3 py-2">{it.external_product_no}</td>
                      <td className="px-3 py-2">{it.external_variant_code || "-"}</td>
                      <td className="px-3 py-2">{fmt(it.snapshot_desired_price_krw ?? it.desired_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.effective_desired_price_krw ?? it.applied_target_price_krw ?? it.desired_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.applied_after_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.floor_price_krw)}</td>
                      <td className="px-3 py-2">{it.floor_applied ? "Y" : "N"}</td>
                      <td className="px-3 py-2">{it.channel_threshold_profile ?? run?.channel_threshold_profile ?? run?.request_payload?.summary?.threshold_profile ?? "-"}</td>
                      <td className="px-3 py-2">{it.effective_threshold_profile ?? it.threshold_profile ?? "-"}</td>
                      <td className="px-3 py-2">{toIntentStateKo(it.state)}</td>
                      <td className="px-3 py-2">{it.reason_code ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{it.task_last_error ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
