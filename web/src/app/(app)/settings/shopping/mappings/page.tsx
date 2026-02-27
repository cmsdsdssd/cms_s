"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = {
  channel_id: string;
  channel_code: string;
  channel_name: string;
};

type Mapping = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  mapping_source: string;
  is_active: boolean;
  updated_at: string;
};

export default function ShoppingMappingsPage() {
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

  const mappingsQuery = useQuery({
    queryKey: ["shop-mappings", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: Mapping[] }>(`/api/channel-products?channel_id=${encodeURIComponent(channelId)}`),
  });

  const [masterItemId, setMasterItemId] = useState("");
  const [externalProductNo, setExternalProductNo] = useState("");
  const [externalVariantCode, setExternalVariantCode] = useState("");

  const upsertMapping = useMutation({
    mutationFn: () =>
      shopApiSend<{ data: Mapping }>("/api/channel-products", "POST", {
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        external_variant_code: externalVariantCode || null,
        mapping_source: "MANUAL",
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("매핑 저장 완료");
      setMasterItemId("");
      setExternalProductNo("");
      setExternalVariantCode("");
      await qc.invalidateQueries({ queryKey: ["shop-mappings", channelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMapping = useMutation({
    mutationFn: (id: string) => shopApiSend<{ ok: boolean }>(`/api/channel-products/${id}`, "DELETE"),
    onSuccess: async () => {
      toast.success("매핑 삭제 완료");
      await qc.invalidateQueries({ queryKey: ["shop-mappings", channelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <ActionBar title="상품 매핑" subtitle="master_item_id ↔ external product_no" />

      <Card>
        <CardHeader title="매핑 입력" description="채널별 수동 매핑" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">채널 선택</option>
              {channels.map((ch) => (
                <option key={ch.channel_id} value={ch.channel_id}>
                  {ch.channel_name} ({ch.channel_code})
                </option>
              ))}
            </Select>
            <Input value={masterItemId} onChange={(e) => setMasterItemId(e.target.value)} placeholder="master_item_id" />
            <Input value={externalProductNo} onChange={(e) => setExternalProductNo(e.target.value)} placeholder="external_product_no" />
            <Input value={externalVariantCode} onChange={(e) => setExternalVariantCode(e.target.value)} placeholder="external_variant_code (optional)" />
          </div>
          <Button
            onClick={() => upsertMapping.mutate()}
            disabled={upsertMapping.isPending || !channelId || !masterItemId.trim() || !externalProductNo.trim()}
          >
            {upsertMapping.isPending ? "저장 중..." : "매핑 저장"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="매핑 목록" description={`총 ${mappingsQuery.data?.data?.length ?? 0}건`} />
        <CardBody>
          <div className="max-h-[560px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">master_item_id</th>
                  <th className="px-3 py-2">product_no</th>
                  <th className="px-3 py-2">variant</th>
                  <th className="px-3 py-2">source</th>
                  <th className="px-3 py-2">active</th>
                  <th className="px-3 py-2">action</th>
                </tr>
              </thead>
              <tbody>
                {(mappingsQuery.data?.data ?? []).map((row) => (
                  <tr key={row.channel_product_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{row.master_item_id}</td>
                    <td className="px-3 py-2">{row.external_product_no}</td>
                    <td className="px-3 py-2">{row.external_variant_code ?? "-"}</td>
                    <td className="px-3 py-2">{row.mapping_source}</td>
                    <td className="px-3 py-2">{row.is_active ? "Y" : "N"}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="secondary"
                        onClick={() => deleteMapping.mutate(row.channel_product_id)}
                        disabled={deleteMapping.isPending}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
                {(mappingsQuery.data?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
                      매핑 데이터가 없습니다.
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
