"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_name: string; channel_code: string };
type DashboardRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  final_target_price_krw: number | null;
  current_channel_price_krw: number | null;
  diff_krw: number | null;
  diff_pct: number | null;
  price_state: "OK" | "OUT_OF_SYNC" | "ERROR" | "UNMAPPED";
  active_adjustment_count: number;
  active_override_id: string | null;
  computed_at: string | null;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");

export default function ShoppingDashboardPage() {
  const qc = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].channel_id);
  }, [channelId, channels]);

  const [priceState, setPriceState] = useState("");
  const [modelName, setModelName] = useState("");
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [onlyAdjustments, setOnlyAdjustments] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["shop-dashboard", channelId, priceState, modelName, onlyOverrides, onlyAdjustments],
    enabled: Boolean(channelId),
    queryFn: () => {
      const query = new URLSearchParams();
      query.set("channel_id", channelId);
      if (priceState) query.set("price_state", priceState);
      if (modelName.trim()) query.set("model_name", modelName.trim());
      if (onlyOverrides) query.set("only_overrides", "true");
      if (onlyAdjustments) query.set("only_adjustments", "true");
      query.set("limit", "500");
      return shopApiGet<{ data: DashboardRow[] }>(`/api/channel-price-dashboard?${query.toString()}`);
    },
  });

  const rows = dashboardQuery.data?.data ?? [];

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setSelected({});
  }, [channelId, priceState, modelName, onlyOverrides, onlyAdjustments]);

  const selectedIds = useMemo(
    () => rows.filter((r) => selected[r.channel_product_id]).map((r) => r.channel_product_id),
    [rows, selected],
  );

  const doRecompute = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number }>("/api/pricing/recompute", "POST", {
        channel_id: channelId,
        master_item_ids: selectedIds.length > 0
          ? rows.filter((r) => selected[r.channel_product_id]).map((r) => r.master_item_id)
          : undefined,
      }),
    onSuccess: async (res) => {
      toast.success(`재계산 완료: ${res.inserted}건`);
      await qc.invalidateQueries({ queryKey: ["shop-dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPull = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number }>("/api/channel-prices/pull", "POST", {
        channel_id: channelId,
        channel_product_ids: selectedIds.length > 0 ? selectedIds : undefined,
      }),
    onSuccess: async (res) => {
      toast.success(`현재가 pull 완료: ${res.inserted}건`);
      await qc.invalidateQueries({ queryKey: ["shop-dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPush = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; job_id: string }>("/api/channel-prices/push", "POST", {
        channel_id: channelId,
        channel_product_ids: selectedIds.length > 0 ? selectedIds : undefined,
      }),
    onSuccess: async (res) => {
      toast.success(`push 작업 생성: ${res.job_id}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["shop-sync-jobs"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <ActionBar
        title="가격 대시보드"
        subtitle="권장가/현재가 비교 및 재계산/조회/반영"
        actions={(
          <>
            <Button variant="secondary" onClick={() => doPull.mutate()} disabled={doPull.isPending || !channelId}>
              {doPull.isPending ? "불러오는 중..." : "현재가 불러오기"}
            </Button>
            <Button variant="secondary" onClick={() => doRecompute.mutate()} disabled={doRecompute.isPending || !channelId}>
              {doRecompute.isPending ? "재계산 중..." : "재계산"}
            </Button>
            <Button onClick={() => doPush.mutate()} disabled={doPush.isPending || !channelId}>
              {doPush.isPending ? "반영 중..." : "선택 반영(push)"}
            </Button>
          </>
        )}
      />

      <Card>
        <CardHeader title="필터" description={`조회건수: ${rows.length}`} />
        <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">채널 선택</option>
            {channels.map((ch) => (
              <option key={ch.channel_id} value={ch.channel_id}>
                {ch.channel_name}
              </option>
            ))}
          </Select>
          <Select value={priceState} onChange={(e) => setPriceState(e.target.value)}>
            <option value="">상태 전체</option>
            <option value="OK">OK</option>
            <option value="OUT_OF_SYNC">OUT_OF_SYNC</option>
            <option value="ERROR">ERROR</option>
            <option value="UNMAPPED">UNMAPPED</option>
          </Select>
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="model_name contains" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOverrides} onChange={(e) => setOnlyOverrides(e.target.checked)} />
            override만
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyAdjustments} onChange={(e) => setOnlyAdjustments(e.target.checked)} />
            adjustment만
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              const allSelected: Record<string, boolean> = {};
              for (const row of rows) allSelected[row.channel_product_id] = true;
              setSelected(allSelected);
            }}
          >
            전체 선택
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="대시보드 테이블" description={`선택 ${selectedIds.length}건`} />
        <CardBody>
          <div className="max-h-[620px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">선택</th>
                  <th className="px-3 py-2">model</th>
                  <th className="px-3 py-2">product_no</th>
                  <th className="px-3 py-2">target</th>
                  <th className="px-3 py-2">current</th>
                  <th className="px-3 py-2">diff</th>
                  <th className="px-3 py-2">diff%</th>
                  <th className="px-3 py-2">state</th>
                  <th className="px-3 py-2">adj</th>
                  <th className="px-3 py-2">ovr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.channel_product_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected[row.channel_product_id] ?? false}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [row.channel_product_id]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-3 py-2">{row.model_name ?? "-"}</td>
                    <td className="px-3 py-2">{row.external_product_no}</td>
                    <td className="px-3 py-2">{fmt(row.final_target_price_krw)}</td>
                    <td className="px-3 py-2">{fmt(row.current_channel_price_krw)}</td>
                    <td className="px-3 py-2">{fmt(row.diff_krw)}</td>
                    <td className="px-3 py-2">{typeof row.diff_pct === "number" ? `${(row.diff_pct * 100).toFixed(2)}%` : "-"}</td>
                    <td className="px-3 py-2">{row.price_state}</td>
                    <td className="px-3 py-2">{row.active_adjustment_count}</td>
                    <td className="px-3 py-2">{row.active_override_id ? "Y" : "N"}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[var(--muted)]">
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
