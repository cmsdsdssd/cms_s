"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ===================== TYPES =====================
type LatestGoldSilver = {
    gold_tick_id?: string;
    gold_price_krw_per_g?: number;
    gold_observed_at?: string;
    gold_source?: string;
    silver_tick_id?: string;
    silver_price_krw_per_g?: number;
    silver_observed_at?: string;
    silver_source?: string;
    as_of?: string;
};

type CsConfig = {
    config_key: string;
    fx_markup: number;
    cs_correction_factor: number;
    updated_at: string;
};

type SeriesTick = {
    tick_id: string;
    symbol: string;
    price_krw_per_g: number;
    observed_at: string;
    source: string;
    meta?: Record<string, unknown> | null;
    created_at: string;
};

type DailyOhlc = {
    day: string;
    symbol: string;
    close_krw_per_g: number;
    high_krw_per_g: number;
    low_krw_per_g: number;
    open_krw_per_g: number;
};

type TickForm = {
    role_code: "GOLD" | "SILVER";
    observed_at: string;
    price_krw_per_g: number;
    source: string;
    note: string;
};

type MarketTickConfigUpsert = {
    config_key: string;
    fx_markup: number;
    cs_correction_factor: number;
};

// ===================== HELPERS =====================
const formatKrw = (value?: number | null) => {
    if (value === null || value === undefined) return "-";
    return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(parsed);
};

const getStaleMinutes = (observedAt?: string | null) => {
    if (!observedAt) return null;
    const now = new Date();
    const observed = new Date(observedAt);
    return Math.round((now.getTime() - observed.getTime()) / 1000 / 60);
};

const getKstNow = () => {
    const now = new Date();
    const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    const hours = String(kstDate.getHours()).padStart(2, '0');
    const minutes = String(kstDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// ===================== MAIN COMPONENT =====================
export default function MarketPage() {
    const queryClient = useQueryClient();
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [dayFilter, setDayFilter] = useState<number>(7);

    const form = useForm<TickForm>({
        defaultValues: {
            role_code: "GOLD",
            observed_at: getKstNow(),
            source: "MANUAL",
            note: "",
        },
    });

    // CS(중국 은시세) 계산계수 설정 (웹에서 조정)
    const [csFxMarkup, setCsFxMarkup] = useState<string>("1.030000");
    const [csCorrectionFactor, setCsCorrectionFactor] = useState<string>("1.000000");
    const [csConfigSaving, setCsConfigSaving] = useState(false);

    // ===================== QUERIES =====================
    const { data: latestData, isLoading: latestLoading } = useQuery({
        queryKey: ["market", "latest"],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const { data, error } = await client
                .from(CONTRACTS.views.marketLatestGoldSilverOps)
                .select("*")
                .maybeSingle();
            if (error) throw error;
            return data as LatestGoldSilver | null;
        },
    });

    const { data: csConfigData, isLoading: csConfigLoading } = useQuery({
        queryKey: ["market", "csConfig"],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const { data, error } = await client
                .from("cms_market_tick_config")
                .select("config_key, fx_markup, cs_correction_factor, updated_at")
                .eq("config_key", "DEFAULT")
                .maybeSingle();
            if (error) throw error;
            return data as CsConfig | null;
        },
    });

    useEffect(() => {
        if (!csConfigData) return;
        setCsFxMarkup(String(csConfigData.fx_markup));
        setCsCorrectionFactor(String(csConfigData.cs_correction_factor));
    }, [csConfigData]);

    const saveCsConfig = async () => {
        const fx = Number(csFxMarkup);
        const corr = Number(csCorrectionFactor);
        if (!Number.isFinite(fx) || fx <= 0) {
            toast.error("CS 설정 저장 실패", { description: "fx_markup 값이 올바르지 않습니다." });
            return;
        }
        if (!Number.isFinite(corr) || corr <= 0) {
            toast.error("CS 설정 저장 실패", { description: "보정계수 값이 올바르지 않습니다." });
            return;
        }

        try {
            setCsConfigSaving(true);
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const { error } = await (
                client.from("cms_market_tick_config") as unknown as {
                    upsert: (values: MarketTickConfigUpsert) => Promise<{ error: { message?: string } | null }>;
                }
            ).upsert({
                config_key: "DEFAULT",
                fx_markup: fx,
                cs_correction_factor: corr,
            });
            if (error) throw error;

            toast.success("CS 설정 저장 완료", { description: "n8n이 다음 실행부터 새로운 값으로 계산합니다." });
            queryClient.invalidateQueries({ queryKey: ["market", "csConfig"] });
        } catch (e) {
            const msg = e instanceof Error ? e.message : "저장 실패";
            toast.error("CS 설정 저장 실패", { description: msg });
        } finally {
            setCsConfigSaving(false);
        }
    };

    const { data: seriesData = [] } = useQuery({
        queryKey: ["market", "series", roleFilter, dayFilter],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - dayFilter);

            const query = client
                .from(CONTRACTS.views.marketSeries)
                .select("*")
                .gte("observed_at", cutoff.toISOString())
                .order("observed_at", { ascending: false })
                .limit(100);

            if (roleFilter === "GOLD") {
                // Filter gold based on role mapping - we'll just use symbol name heuristic
                // In production, join with role table or filter by returned symbol
            } else if (roleFilter === "SILVER") {
                // Same for silver
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data as SeriesTick[]) ?? [];
        },
    });

    const { data: ohlcData = [] } = useQuery({
        queryKey: ["market", "ohlc", dayFilter],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - dayFilter);

            const { data, error } = await client
                .from(CONTRACTS.views.marketDailyOhlc)
                .select("*")
                .gte("day", cutoff.toISOString().split("T")[0])
                .order("day", { ascending: true });

            if (error) throw error;
            return (data as DailyOhlc[]) ?? [];
        },
    });

    // ===================== MUTATION =====================
    const mutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.marketTickUpsertByRole,
        successMessage: "시세 저장 완료",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["market"] });
            form.reset({
                role_code: form.getValues("role_code"),
                observed_at: getKstNow(),
                source: "MANUAL",
                note: "",
            });
        },
    });

    const onSubmit = (values: TickForm) => {
        if (!values.price_krw_per_g || values.price_krw_per_g <= 0) {
            toast.error("가격을 입력해주세요");
            return;
        }

        mutation.mutate({
            p_role_code: values.role_code,
            p_price_krw_per_g: values.price_krw_per_g,
            p_observed_at: values.observed_at ? new Date(values.observed_at).toISOString() : null,
            p_source: values.source || "MANUAL",
            p_meta: values.note ? { note: values.note } : null,
            p_actor_person_id: null,
            p_correlation_id: crypto.randomUUID(),
            p_note: values.note || null,
        });
    };

    // ===================== RENDER HELPERS =====================
    const goldMinutes = getStaleMinutes(latestData?.gold_observed_at);
    const silverMinutes = getStaleMinutes(latestData?.silver_observed_at);
    const isGoldStale = goldMinutes !== null && goldMinutes > 60;
    const isSilverStale = silverMinutes !== null && silverMinutes > 60;

    // Simple SVG chart data
    const chartData = useMemo(() => {
        const filtered = ohlcData.filter((d) => {
            if (roleFilter === "ALL") return true;
            // Heuristic: symbol contains 'GOLD' or 'SILVER' or similar
            // In production, use proper role mapping
            return d.symbol?.toUpperCase().includes(roleFilter);
        });
        return filtered;
    }, [ohlcData, roleFilter]);

    const chartMax = useMemo(() => {
        if (chartData.length === 0) return 1;
        return Math.max(...chartData.map((d) => d.high_krw_per_g || 0));
    }, [chartData]);

    const chartMin = useMemo(() => {
        if (chartData.length === 0) return 0;
        return Math.min(...chartData.map((d) => d.low_krw_per_g || 0));
    }, [chartData]);

    // ===================== RENDER =====================
    return (
        <div className="space-y-6">
            <ActionBar title="시세관리" subtitle="금/은 원/그램 입력 및 추이" />

            <FilterBar>
                <Select className="w-32" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="ALL">전체</option>
                    <option value="GOLD">금</option>
                    <option value="SILVER">은</option>
                </Select>
                <Select className="w-32" value={String(dayFilter)} onChange={(e) => setDayFilter(Number(e.target.value))}>
                    <option value="7">7일</option>
                    <option value="30">30일</option>
                    <option value="90">90일</option>
                </Select>
            </FilterBar>

            <SplitLayout
                left={
                    <div className="space-y-4">
                        {/* Latest Gold Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <ActionBar title="금 (GOLD)" />
                                    {isGoldStale && (
                                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded border border-orange-200">
                                            지연 ({goldMinutes}분)
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardBody>
                                {latestLoading ? (
                                    <p className="text-sm text-[var(--muted)]">로딩 중...</p>
                                ) : latestData?.gold_price_krw_per_g ? (
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold">{formatKrw(latestData.gold_price_krw_per_g)}</p>
                                        <p className="text-xs text-[var(--muted)]">
                                            {formatDateTimeKst(latestData.gold_observed_at)} · {latestData.gold_source}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                                )}
                            </CardBody>
                        </Card>

                        {/* Latest Silver Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <ActionBar title="은 (SILVER)" />
                                    {isSilverStale && (
                                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded border border-orange-200">
                                            지연 ({silverMinutes}분)
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardBody>
                                {latestLoading ? (
                                    <p className="text-sm text-[var(--muted)]">로딩 중...</p>
                                ) : latestData?.silver_price_krw_per_g ? (
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold">{formatKrw(latestData.silver_price_krw_per_g)}</p>
                                        <p className="text-xs text-[var(--muted)]">
                                            {formatDateTimeKst(latestData.silver_observed_at)} · {latestData.silver_source}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                                )}
                            </CardBody>
                        </Card>

                        {/* CS(중국 은시세) 설정: fx_markup / 보정계수 */}
                        <Card>
                            <CardHeader>
                                <ActionBar title="CS 설정" subtitle="중국 은시세 계산계수" />
                            </CardHeader>
                            <CardBody>
                                {csConfigLoading ? (
                                    <p className="text-sm text-[var(--muted)]">로딩 중...</p>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                                fx_markup
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.000001"
                                                value={csFxMarkup}
                                                onChange={(e) => setCsFxMarkup(e.target.value)}
                                            />
                                            <p className="text-xs text-[var(--muted)]">원 환율에 곱하는 마크업(예: 1.03)</p>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                                보정계수
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.000001"
                                                value={csCorrectionFactor}
                                                onChange={(e) => setCsCorrectionFactor(e.target.value)}
                                            />
                                            <p className="text-xs text-[var(--muted)]">최종 CS에 추가로 곱하는 계수(예: 1.00)</p>
                                        </div>

                                        <div className="text-xs text-[var(--muted)]">
                                            마지막 변경: {csConfigData?.updated_at ? formatDateTimeKst(csConfigData.updated_at) : "-"}
                                        </div>

                                        <Button
                                            type="button"
                                            className="w-full"
                                            onClick={saveCsConfig}
                                            disabled={csConfigSaving}
                                        >
                                            {csConfigSaving ? "저장 중..." : "CS 설정 저장"}
                                        </Button>
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        {/* Manual Input Form */}
                        <Card>
                            <CardHeader>
                                <ActionBar title="수동 입력" />
                            </CardHeader>
                            <CardBody>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                            종류 *
                                        </label>
                                        <Select {...form.register("role_code", { required: true })}>
                                            <option value="GOLD">금 (GOLD)</option>
                                            <option value="SILVER">은 (SILVER)</option>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                            관측시각 *
                                        </label>
                                        <Input type="datetime-local" {...form.register("observed_at", { required: true })} />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                            가격 (원/그램) *
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            {...form.register("price_krw_per_g", { required: true, valueAsNumber: true })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                            출처
                                        </label>
                                        <Input {...form.register("source")} placeholder="MANUAL" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                            메모
                                        </label>
                                        <Textarea {...form.register("note")} rows={2} />
                                    </div>

                                    <Button type="submit" className="w-full" disabled={mutation.isPending}>
                                        {mutation.isPending ? "저장 중..." : "저장"}
                                    </Button>
                                </form>
                            </CardBody>
                        </Card>
                    </div>
                }
                right={
                    <div className="space-y-4">
                        {/* Simple Chart */}
                        <Card>
                            <CardHeader>
                                <ActionBar title="일자별 추이 (종가)" />
                            </CardHeader>
                            <CardBody>
                                {chartData.length === 0 ? (
                                    <p className="text-sm text-[var(--muted)] text-center py-8">데이터 없음</p>
                                ) : (
                                    <svg className="w-full h-48" viewBox="0 0 400 200" preserveAspectRatio="none">
                                        <polyline
                                            fill="none"
                                            stroke="var(--primary)"
                                            strokeWidth="2"
                                            points={chartData
                                                .map((d, i) => {
                                                    const x = (i / (chartData.length - 1)) * 400;
                                                    const y = 200 - ((d.close_krw_per_g - chartMin) / (chartMax - chartMin)) * 180;
                                                    return `${x},${y}`;
                                                })
                                                .join(" ")}
                                        />
                                    </svg>
                                )}
                            </CardBody>
                        </Card>

                        {/* History Table */}
                        <Card>
                            <CardHeader>
                                <ActionBar title="히스토리" />
                            </CardHeader>
                            <CardBody>
                                {seriesData.length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                                ) : (
                                    <div className="overflow-auto max-h-96">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                                <tr>
                                                    <th className="text-left pb-2">시각</th>
                                                    <th className="text-left pb-2">종류</th>
                                                    <th className="text-right pb-2">가격</th>
                                                    <th className="text-left pb-2">출처</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--panel-border)]">
                                                {seriesData.map((tick) => (
                                                    <tr key={tick.tick_id} className="hover:bg-[var(--panel-hover)]">
                                                        <td className="py-2">{formatDateTimeKst(tick.observed_at)}</td>
                                                        <td className="py-2">
                                                            <span
                                                                className={cn(
                                                                    "text-xs px-1.5 py-0.5 rounded font-semibold",
                                                                    tick.symbol?.toUpperCase().includes("GOLD")
                                                                        ? "bg-yellow-100 text-yellow-700"
                                                                        : "bg-gray-100 text-gray-700"
                                                                )}
                                                            >
                                                                {tick.symbol}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-right font-mono">{formatKrw(tick.price_krw_per_g)}</td>
                                                        <td className="py-2 text-xs text-[var(--muted)]">{tick.source}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                }
            />
        </div>
    );
}
