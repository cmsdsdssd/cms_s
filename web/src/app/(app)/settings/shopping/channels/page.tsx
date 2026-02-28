"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = {
  channel_id: string;
  channel_type: "CAFE24";
  channel_code: string;
  channel_name: string;
  is_active: boolean;
};

type ChannelAccount = {
  account_id: string;
  channel_id: string;
  mall_id: string;
  shop_no: number;
  api_version: string | null;
  status: string;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  has_client_id: boolean;
  has_client_secret: boolean;
  has_access_token: boolean;
  has_refresh_token: boolean;
};

export default function ShoppingChannelsPage() {
  const qc = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });

  const channels = channelsQuery.data?.data ?? [];
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].channel_id);
    }
  }, [selectedChannelId, channels]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.channel_id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  const [channelCode, setChannelCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [editChannelCode, setEditChannelCode] = useState("");
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelActive, setEditChannelActive] = useState(true);

  const createChannel = useMutation({
    mutationFn: () =>
      shopApiSend<{ data: Channel }>("/api/channels", "POST", {
        channel_type: "CAFE24",
        channel_code: channelCode,
        channel_name: channelName,
        is_active: true,
      }),
    onSuccess: async (res) => {
      toast.success("채널 저장 완료");
      setChannelCode("");
      setChannelName("");
      await qc.invalidateQueries({ queryKey: ["shop-channels"] });
      setSelectedChannelId(res.data.channel_id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    setEditChannelCode(selectedChannel?.channel_code ?? "");
    setEditChannelName(selectedChannel?.channel_name ?? "");
    setEditChannelActive(selectedChannel?.is_active ?? true);
  }, [selectedChannel?.channel_id]);

  const updateChannel = useMutation({
    mutationFn: () => {
      if (!selectedChannelId) throw new Error("채널을 먼저 선택하세요");
      return shopApiSend<{ data: Channel }>(`/api/channels/${selectedChannelId}`, "PUT", {
        channel_code: editChannelCode,
        channel_name: editChannelName,
        is_active: editChannelActive,
      });
    },
    onSuccess: async () => {
      toast.success("채널 수정 완료");
      await qc.invalidateQueries({ queryKey: ["shop-channels"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteChannel = useMutation({
    mutationFn: () => {
      if (!selectedChannelId) throw new Error("채널을 먼저 선택하세요");
      return shopApiSend<{ ok: boolean }>(`/api/channels/${selectedChannelId}`, "DELETE");
    },
    onSuccess: async () => {
      toast.success("채널 삭제 완료");
      setSelectedChannelId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-channels"] }),
        qc.invalidateQueries({ queryKey: ["shop-channel-account"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const accountQuery = useQuery({
    queryKey: ["shop-channel-account", selectedChannelId],
    enabled: Boolean(selectedChannelId),
    queryFn: () =>
      shopApiGet<{ data: ChannelAccount | null }>(`/api/channels/${selectedChannelId}/account`),
  });

  const account = accountQuery.data?.data ?? null;
  const [mallId, setMallId] = useState("");
  const [shopNo, setShopNo] = useState("1");
  const [apiVersion, setApiVersion] = useState("2025-12-01");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  useEffect(() => {
    setMallId(account?.mall_id ?? "");
    setShopNo(String(account?.shop_no ?? 1));
    setApiVersion(account?.api_version ?? "2025-12-01");
    setAccessToken("");
    setRefreshToken("");
  }, [account?.account_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;

    const reason = params.get("reason");
    if (oauth === "success") {
      toast.success("Cafe24 OAuth 연결 완료");
      if (selectedChannelId) {
        void qc.invalidateQueries({ queryKey: ["shop-channel-account", selectedChannelId] });
      }
    } else {
      toast.error(reason ? `Cafe24 OAuth 실패: ${reason}` : "Cafe24 OAuth 실패");
    }

    params.delete("oauth");
    params.delete("reason");
    params.delete("channel_id");
    const q = params.toString();
    const nextUrl = `${window.location.pathname}${q ? `?${q}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [qc, selectedChannelId]);

  const saveAccount = useMutation({
    mutationFn: () => {
      if (!selectedChannelId) throw new Error("채널을 먼저 선택하세요");
      return shopApiSend<{ data: ChannelAccount }>(`/api/channels/${selectedChannelId}/account`, "POST", {
        mall_id: mallId,
        shop_no: Number(shopNo),
        api_version: apiVersion,
        client_id: clientId.trim() ? clientId.trim() : undefined,
        client_secret: clientSecret.trim() ? clientSecret.trim() : undefined,
        access_token: accessToken.trim() ? accessToken.trim() : undefined,
        refresh_token: refreshToken.trim() ? refreshToken.trim() : undefined,
      });
    },
    onSuccess: async () => {
      toast.success("채널 계정 저장 완료");
      await qc.invalidateQueries({ queryKey: ["shop-channel-account", selectedChannelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startCafe24Oauth = useMutation({
    mutationFn: async () => {
      if (!selectedChannelId) throw new Error("채널을 먼저 선택하세요");
      const res = await shopApiSend<{ data: { authorize_url: string } }>("/api/shop-oauth/cafe24/authorize", "POST", {
        channel_id: selectedChannelId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data?.authorize_url) {
        toast.error("OAuth 승인 URL 생성 실패");
        return;
      }
      window.location.href = data.authorize_url;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <ActionBar
        title="쇼핑몰 채널 설정"
        subtitle="채널 생성 및 카페24 계정 연결"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="채널 목록" description="채널 코드 기준으로 생성/관리" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input value={channelCode} onChange={(e) => setChannelCode(e.target.value)} placeholder="채널 코드(channel_code) 예: CAFE24_MAIN" />
              <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="채널 이름(channel_name) 예: 자사몰" />
            </div>
            <Button
              onClick={() => createChannel.mutate()}
              disabled={createChannel.isPending || !channelCode.trim() || !channelName.trim()}
            >
              {createChannel.isPending ? "저장 중..." : "채널 저장"}
            </Button>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input value={editChannelCode} onChange={(e) => setEditChannelCode(e.target.value)} placeholder="선택 채널 코드(channel_code)" />
              <Input value={editChannelName} onChange={(e) => setEditChannelName(e.target.value)} placeholder="선택 채널 이름(channel_name)" />
              <Select value={editChannelActive ? "ACTIVE" : "INACTIVE"} onChange={(e) => setEditChannelActive(e.target.value === "ACTIVE")}>
                <option value="ACTIVE">활성(ACTIVE)</option>
                <option value="INACTIVE">비활성(INACTIVE)</option>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => updateChannel.mutate()}
                disabled={updateChannel.isPending || !selectedChannelId || !editChannelCode.trim() || !editChannelName.trim()}
              >
                {updateChannel.isPending ? "수정 중..." : "선택 채널 수정"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!selectedChannelId) return;
                  const ok = window.confirm("선택 채널을 삭제할까요? 관련 매핑/로그/정책 데이터도 함께 삭제될 수 있습니다.");
                  if (ok) deleteChannel.mutate();
                }}
                disabled={deleteChannel.isPending || !selectedChannelId}
              >
                {deleteChannel.isPending ? "삭제 중..." : "선택 채널 삭제"}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[var(--muted)]">채널 선택</label>
              <Select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>
                <option value="">선택하세요</option>
                {channels.map((ch) => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_name} ({ch.channel_code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="max-h-64 overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">코드</th>
                    <th className="px-3 py-2">이름</th>
                    <th className="px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr
                      key={ch.channel_id}
                      className={`border-t border-[var(--hairline)] ${selectedChannelId === ch.channel_id ? "bg-[var(--panel)]" : ""}`}
                    >
                      <td className="px-3 py-2">{ch.channel_code}</td>
                      <td className="px-3 py-2">{ch.channel_name}</td>
                      <td className="px-3 py-2">{ch.is_active ? "활성" : "비활성"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="카페24 계정"
            description={selectedChannel ? `${selectedChannel.channel_name} 계정 설정` : "채널을 먼저 선택하세요"}
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input value={mallId} onChange={(e) => setMallId(e.target.value)} placeholder="몰 아이디(mall_id)" />
              <Input value={shopNo} onChange={(e) => setShopNo(e.target.value)} placeholder="상점 번호(shop_no)" />
            </div>
            <Input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} placeholder="API 버전(api_version) 예: 2025-12-01" />
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="클라이언트 아이디(client_id)" autoComplete="off" spellCheck={false} />
            <Input
              name="shop_client_secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="클라이언트 시크릿(client_secret)"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
            />
            <Input
              name="shop_access_token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="액세스 토큰(access_token)"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
            />
            <Input
              name="shop_refresh_token"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="리프레시 토큰(refresh_token)"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
            />

            <Button
              onClick={() => saveAccount.mutate()}
              disabled={saveAccount.isPending || !selectedChannelId || !mallId.trim()}
            >
              {saveAccount.isPending ? "저장 중..." : "계정 저장"}
            </Button>

            <Button
              onClick={() => startCafe24Oauth.mutate()}
              disabled={startCafe24Oauth.isPending || !selectedChannelId}
            >
              {startCafe24Oauth.isPending ? "이동 중..." : "카페24 OAuth 승인 페이지로 이동"}
            </Button>

            <div className="text-xs text-[var(--muted)]">
              client_id/client_secret/mall_id 저장 후 버튼을 눌러 승인하면 callback에서 토큰이 자동 저장됩니다.
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3 text-xs text-[var(--muted)]">
              <div>상태(status): {account?.status ?? "-"}</div>
              <div>클라이언트 아이디(client_id): {account?.has_client_id ? "저장됨" : "-"}</div>
              <div>클라이언트 시크릿(client_secret): {account?.has_client_secret ? "저장됨" : "-"}</div>
              <div>액세스 토큰(access_token): {account?.has_access_token ? "저장됨" : "-"}</div>
              <div>리프레시 토큰(refresh_token): {account?.has_refresh_token ? "저장됨" : "-"}</div>
              <div>액세스 토큰 만료(access_token_expires_at): {account?.access_token_expires_at ?? "-"}</div>
              <div>리프레시 토큰 만료(refresh_token_expires_at): {account?.refresh_token_expires_at ?? "-"}</div>
              <div>최근 오류 코드(last_error_code): {account?.last_error_code ?? "-"}</div>
              <div>최근 오류 메시지(last_error_message): {account?.last_error_message ?? "-"}</div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
