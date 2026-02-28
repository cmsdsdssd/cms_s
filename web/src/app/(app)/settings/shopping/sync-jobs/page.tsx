"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { shopApiGet } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_name: string; channel_code: string };

type SyncJob = {
  job_id: string;
  channel_id: string;
  run_type: "MANUAL" | "AUTO";
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "CANCELLED";
  success_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string;
  finished_at: string | null;
};

type SyncJobItem = {
  job_item_id: string;
  external_product_no: string;
  external_variant_code: string;
  before_price_krw: number | null;
  target_price_krw: number;
  after_price_krw: number | null;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  raw_response_json?: unknown;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");

const toJobStatusKo = (value: SyncJob["status"]) => {
  if (value === "RUNNING") return "진행중";
  if (value === "SUCCESS") return "성공";
  if (value === "PARTIAL") return "부분성공";
  if (value === "FAILED") return "실패";
  if (value === "CANCELLED") return "취소";
  return value;
};

const toItemStatusKo = (value: SyncJobItem["status"]) => {
  if (value === "SUCCESS") return "성공";
  if (value === "FAILED") return "실패";
  if (value === "SKIPPED") return "건너뜀";
  return value;
};

export default function ShoppingSyncJobsPage() {
  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].channel_id);
  }, [channelId, channels]);

  const jobsQuery = useQuery({
    queryKey: ["shop-sync-jobs", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: SyncJob[] }>(`/api/price-sync-jobs?channel_id=${encodeURIComponent(channelId)}&limit=200`),
    refetchInterval: 10_000,
  });

  const jobs = jobsQuery.data?.data ?? [];
  const [selectedJobId, setSelectedJobId] = useState("");
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) setSelectedJobId(jobs[0].job_id);
  }, [selectedJobId, jobs]);

  const detailQuery = useQuery({
    queryKey: ["shop-sync-job-detail", selectedJobId],
    enabled: Boolean(selectedJobId),
    queryFn: () =>
      shopApiGet<{ data: { job: SyncJob; items: SyncJobItem[] } }>(`/api/price-sync-jobs/${selectedJobId}`),
    refetchInterval: 10_000,
  });

  const items = detailQuery.data?.data.items ?? [];

  return (
    <div className="space-y-4">
      <ActionBar title="동기화 로그" subtitle="push 작업 및 item 결과 추적" />

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
          <CardHeader title="작업(Job) 목록" description={`총 ${jobs.length}건`} />
          <CardBody>
            <div className="max-h-[520px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">작업 ID(job_id)</th>
                    <th className="px-3 py-2">상태(status)</th>
                    <th className="px-3 py-2">성공/실패/건너뜀</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.job_id}
                      className={`cursor-pointer border-t border-[var(--hairline)] ${selectedJobId === job.job_id ? "bg-[var(--panel)]" : ""}`}
                      onClick={() => setSelectedJobId(job.job_id)}
                    >
                      <td className="px-3 py-2">{job.job_id}</td>
                      <td className="px-3 py-2">{toJobStatusKo(job.status)}</td>
                      <td className="px-3 py-2">{job.success_count}/{job.failed_count}/{job.skipped_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="작업 상세" description={`항목(items): ${items.length}건`} />
          <CardBody>
            <div className="max-h-[520px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">상품번호(product_no)</th>
                    <th className="px-3 py-2">옵션코드(variant_code)</th>
                    <th className="px-3 py-2">반영전(before_price_krw)</th>
                    <th className="px-3 py-2">목표가(target_price_krw)</th>
                    <th className="px-3 py-2">반영후(after_price_krw)</th>
                    <th className="px-3 py-2">상태(status)</th>
                    <th className="px-3 py-2">오류코드(error_code)</th>
                    <th className="px-3 py-2">오류메시지(error_message)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.job_item_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{it.external_product_no}</td>
                      <td className="px-3 py-2">{it.external_variant_code || "-"}</td>
                      <td className="px-3 py-2">{fmt(it.before_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.target_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.after_price_krw)}</td>
                      <td className="px-3 py-2">{toItemStatusKo(it.status)}</td>
                      <td className="px-3 py-2">{it.error_code ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{it.error_message ?? "-"}</td>
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
