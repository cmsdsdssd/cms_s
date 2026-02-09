"use client";

import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";

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

const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return "-";
    return Math.round(value).toLocaleString();
};

const formatDateTimeKst = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "2-digit",
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

// ===================== COMPACT CHART COMPONENT =====================
function CompactChart({
    data,
    stats,
    color,
    monthFilter,
    secondaryData,
    secondaryColor = "#3b82f6", // Default Blue for secondary
}: {
    data: DailyOhlc[];
    stats: { min: number; max: number; last: number | null };
    color: string;
    monthFilter: number;
    secondaryData?: DailyOhlc[];
    secondaryColor?: string;
}) {
    const chartConfig = useMemo(() => ({
        width: 280,
        height: 120,
        paddingLeft: 36,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 16,
    }), []);

    const { width, height, paddingLeft, paddingRight, paddingTop, paddingBottom } = chartConfig;

    // Calculate combined stats for Y-axis scaling if secondary data exists
    const combinedMin = Math.min(stats.min, ...(secondaryData?.map(d => d.low_krw_per_g) || []));
    const combinedMax = Math.max(stats.max, ...(secondaryData?.map(d => d.high_krw_per_g) || []));
    // Use stats if no secondary, or combine
    const chartMin = secondaryData ? combinedMin : stats.min;
    const chartMax = secondaryData ? combinedMax : stats.max;
    const range = chartMax - chartMin || 1;

    const buildPoints = (chartData: DailyOhlc[]) => {
        if (chartData.length === 0) return "";
        return chartData
            .map((d, i) => {
                const x = paddingLeft + (i / Math.max(1, chartData.length - 1)) * (width - paddingLeft - paddingRight);
                const y = height - paddingBottom - ((d.close_krw_per_g - chartMin) / range) * (height - paddingTop - paddingBottom);
                return `${x},${y}`;
            })
            .join(" ");
    };

    const ticks = useMemo(() => {
        const tickCount = 3;
        return Array.from({ length: tickCount }).map((_, index) => {
            const value = chartMax - (range / (tickCount - 1)) * index;
            const y = paddingTop + ((chartMax - value) / range) * (height - paddingTop - paddingBottom);
            return { value, y };
        });
    }, [chartMax, range, height, paddingTop, paddingBottom]);

    const points = useMemo(() => buildPoints(data), [data, chartMin, range]);
    const secondaryPoints = useMemo(() => secondaryData ? buildPoints(secondaryData) : "", [secondaryData, chartMin, range]);

    return (
        <svg
            className="w-full"
            style={{ height: '140px' }}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
        >
            <defs>
                <linearGradient id={`fill-${color}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {ticks.map((tick, index) => (
                <line
                    key={index}
                    x1={paddingLeft}
                    x2={width - paddingRight}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="var(--panel-border)"
                    strokeWidth="0.5"
                    opacity="0.3"
                />
            ))}

            {/* Area fill */}
            {data.length > 0 && (
                <polygon
                    fill={`url(#fill-${color})`}
                    points={`${paddingLeft},${height - paddingBottom} ${points} ${width - paddingRight},${height - paddingBottom}`}
                />
            )}

            {/* Secondary line */}
            {secondaryData && secondaryData.length > 0 && (
                <polyline
                    fill="none"
                    stroke={secondaryColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                    points={secondaryPoints}
                />
            )}

            {/* Main line */}
            {data.length > 0 && (
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    points={points}
                />
            )}
        </svg>
    );
}

// ===================== COMPACT PRICE CARD =====================
function CompactPriceCard({
    title,
    price,
    observedAt,
    source,
    isStale,
    staleMinutes,
    color,
}: {
    title: string;
    price: number | undefined;
    observedAt: string | undefined;
    source: string | undefined;
    isStale: boolean;
    staleMinutes: number | null;
    color: string;
}) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--panel)] border border-[var(--panel-border)]">
            <div className="flex items-center gap-3">
                <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                />
                <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
                    <div className="text-xs text-[var(--muted)]">
                        {formatDateTimeKst(observedAt)} · {source}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-2xl font-bold" style={{ color }}>
                    {formatKrw(price)}
                </div>
                <div className="text-xs text-[var(--muted)]">원/그램</div>
                {isStale && (
                    <div className="text-xs text-orange-500 mt-1">지연 {staleMinutes}분</div>
                )}
            </div>
        </div>
    );
}

// ===================== MAIN COMPONENT =====================
export default function MarketPage() {
    const queryClient = useQueryClient();
    const [monthFilter, setMonthFilter] = useState<number>(1);

    const form = useForm<TickForm>({
        defaultValues: {
            role_code: "GOLD",
            observed_at: getKstNow(),
            source: "MANUAL",
            note: "",
        },
    });

    const [csFxMarkup, setCsFxMarkup] = useState<string>("1.030000");
    const [csCorrectionFactor, setCsCorrectionFactor] = useState<string>("1.000000");
    const [csConfigSaving, setCsConfigSaving] = useState(false);

    const { data: latestData } = useQuery({
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

    const { data: seriesData = [] } = useQuery({
        queryKey: ["market", "series", monthFilter],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - monthFilter);

            const query = client
                .from(CONTRACTS.views.marketSeries)
                .select("*")
                .gte("observed_at", cutoff.toISOString())
                .order("observed_at", { ascending: false })
                .limit(50);

            const { data, error } = await query;
            if (error) throw error;
            return (data as SeriesTick[]) ?? [];
        },
    });

    const { data: ohlcData = [] } = useQuery({
        queryKey: ["market", "ohlc", monthFilter],
        queryFn: async () => {
            const client = getSchemaClient();
            if (!client) throw new Error("Supabase client not initialized");
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - monthFilter);

            const { data, error } = await client
                .from(CONTRACTS.views.marketDailyOhlc)
                .select("*")
                .gte("day", cutoff.toISOString().split("T")[0])
                .order("day", { ascending: true });

            if (error) throw error;
            return (data as DailyOhlc[]) ?? [];
        },
    });

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

    const saveCsConfig = async () => {
        const fx = Number(csFxMarkup);
        const corr = Number(csCorrectionFactor);
        if (!Number.isFinite(fx) || fx <= 0) {
            toast.error("fx_markup 값이 올바르지 않습니다.");
            return;
        }
        if (!Number.isFinite(corr) || corr <= 0) {
            toast.error("보정계수 값이 올바르지 않습니다.");
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
            toast.success("CS 설정 저장 완료");
            queryClient.invalidateQueries({ queryKey: ["market", "csConfig"] });
        } catch (e) {
            const msg = e instanceof Error ? e.message : "저장 실패";
            toast.error("CS 설정 저장 실패", { description: msg });
        } finally {
            setCsConfigSaving(false);
        }
    };

    const goldMinutes = getStaleMinutes(latestData?.gold_observed_at);
    const silverMinutes = getStaleMinutes(latestData?.silver_observed_at);
    const isGoldStale = goldMinutes !== null && goldMinutes > 60;
    const isSilverStale = silverMinutes !== null && silverMinutes > 60;

    const filteredOhlcData = useMemo(() => {
        return ohlcData
            .filter((d) => {
                if (!d.day) return false;
                const parsed = new Date(d.day);
                if (Number.isNaN(parsed.getTime())) return false;
                const cutoff = new Date();
                cutoff.setMonth(cutoff.getMonth() - monthFilter);
                return parsed >= cutoff;
            })
            .sort((a, b) => String(a.day ?? "").localeCompare(String(b.day ?? "")));
    }, [ohlcData, monthFilter]);

    const goldChartData = useMemo(() => {
        return filteredOhlcData.filter((d) => d.symbol?.toUpperCase().includes("GOLD"));
    }, [filteredOhlcData]);

    const silverCnyChartData = useMemo(() => {
        return filteredOhlcData
            .filter((d) => d.symbol?.toUpperCase().includes("SILVER_CN"))
            .map(d => ({
                ...d,
                // Remove 1.2 multiplier for China Silver
                close_krw_per_g: d.close_krw_per_g / 1.2,
                high_krw_per_g: d.high_krw_per_g / 1.2,
                low_krw_per_g: d.low_krw_per_g / 1.2,
                open_krw_per_g: d.open_krw_per_g / 1.2,
            }));
    }, [filteredOhlcData]);

    const silverChartData = useMemo(() => {
        const koreaData = filteredOhlcData.filter((d) =>
            d.symbol?.toUpperCase().includes("SILVER") &&
            !d.symbol?.toUpperCase().includes("SILVER_CN")
        );
        // Divide by 1.2 for comparison consistency
        return koreaData.map(d => ({
            ...d,
            close_krw_per_g: d.close_krw_per_g / 1.2,
            high_krw_per_g: d.high_krw_per_g / 1.2,
            low_krw_per_g: d.low_krw_per_g / 1.2,
            open_krw_per_g: d.open_krw_per_g / 1.2,
        }));
    }, [filteredOhlcData]);


    const getChartStats = (data: DailyOhlc[]) => {
        if (data.length === 0) {
            return { max: 1, min: 0, last: null as number | null };
        }
        const highs = data.map((d) => d.high_krw_per_g || 0);
        const lows = data.map((d) => d.low_krw_per_g || 0);
        const last = data[data.length - 1]?.close_krw_per_g ?? null;
        return { max: Math.max(...highs), min: Math.min(...lows), last };
    };

    const goldStats = useMemo(() => getChartStats(goldChartData), [goldChartData]);
    const silverStats = useMemo(() => getChartStats(silverChartData), [silverChartData]);

    const rangeLabel = useMemo(() => `최근 ${monthFilter}개월`, [monthFilter]);

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]">
                <ActionBar title="시세관리" subtitle="금/은 원/그램" />
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
                <div className="max-w-7xl mx-auto space-y-4">
                    {/* Period Selector */}
                    <div className="flex gap-1">
                        {[1, 3, 6, 12].map((months) => (
                            <button
                                key={months}
                                onClick={() => setMonthFilter(months)}
                                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${monthFilter === months
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--panel)] hover:bg-[var(--panel-hover)]'
                                    }`}
                            >
                                {months}개월
                            </button>
                        ))}
                    </div>

                    {/* Current Prices */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <CompactPriceCard
                            title="금 (GOLD)"
                            price={latestData?.gold_price_krw_per_g}
                            observedAt={latestData?.gold_observed_at}
                            source={latestData?.gold_source}
                            isStale={isGoldStale}
                            staleMinutes={goldMinutes}
                            color="#f5b942"
                        />
                        <CompactPriceCard
                            title="은 (SILVER)"
                            price={latestData?.silver_price_krw_per_g}
                            observedAt={latestData?.silver_observed_at}
                            source={latestData?.silver_source}
                            isStale={isSilverStale}
                            staleMinutes={silverMinutes}
                            color="#9aa7b4"
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-3 border-b border-[var(--panel-border)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: '#f5b942' }} />
                                        <span className="font-semibold text-sm">Gold Trend</span>
                                        <span className="text-xs text-[var(--muted)]">{rangeLabel}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold" style={{ color: '#f5b942' }}>
                                            {formatKrw(goldStats.last)}
                                        </div>
                                        <div className="text-xs text-[var(--muted)]">
                                            H:{formatNumber(goldStats.max)} L:{formatNumber(goldStats.min)}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody className="py-2">
                                <CompactChart
                                    data={goldChartData}
                                    stats={goldStats}
                                    color="#f5b942"
                                    monthFilter={monthFilter}
                                />
                            </CardBody>
                        </Card>

                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-3 border-b border-[var(--panel-border)]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: '#9aa7b4' }} />
                                        <span className="font-semibold text-sm">Silver Trend</span>
                                        <span className="text-xs text-[var(--muted)]">{rangeLabel}</span>
                                        {/* Legend for China Silver */}
                                        <div className="flex items-center gap-1 ml-2">
                                            <div className="w-3 h-0.5 bg-blue-500" />
                                            <span className="text-xs text-[var(--muted)]">CNY (Raw)</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold" style={{ color: '#9aa7b4' }}>
                                            {formatKrw(silverStats.last)}
                                        </div>
                                        <div className="text-xs text-[var(--muted)]">
                                            H:{formatNumber(silverStats.max)} L:{formatNumber(silverStats.min)}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody className="py-2">
                                <CompactChart
                                    data={silverChartData}
                                    stats={silverStats}
                                    color="#9aa7b4"
                                    monthFilter={monthFilter}
                                    secondaryData={silverCnyChartData}
                                    secondaryColor="#3b82f6" // Explicit Blue
                                />
                            </CardBody>
                        </Card>
                    </div>

                    {/* History Tables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-2 border-b border-[var(--panel-border)]">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: '#f5b942' }} />
                                    <span className="font-semibold text-sm">Gold History</span>
                                </div>
                            </CardHeader>
                            <CardBody className="p-0">
                                <div className="overflow-auto max-h-40">
                                    <table className="w-full text-sm">
                                        <thead className="bg-[var(--panel)] sticky top-0">
                                            <tr className="text-xs text-[var(--muted)]">
                                                <th className="text-left px-3 py-2">시각</th>
                                                <th className="text-right px-3 py-2">가격</th>
                                                <th className="text-left px-3 py-2">출처</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--panel-border)]">
                                            {seriesData
                                                .filter((tick) => tick.symbol?.toUpperCase().includes("GOLD"))
                                                .slice(0, 10)
                                                .map((tick) => (
                                                    <tr key={tick.tick_id} className="hover:bg-[var(--panel-hover)]">
                                                        <td className="px-3 py-2 text-xs">{formatDateTimeKst(tick.observed_at)}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-xs">
                                                            {formatKrw(tick.price_krw_per_g)}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-[var(--muted)]">한국</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-2 border-b border-[var(--panel-border)]">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: '#9aa7b4' }} />
                                    <span className="font-semibold text-sm">Silver History</span>
                                </div>
                            </CardHeader>
                            <CardBody className="p-0">
                                <div className="overflow-auto max-h-40">
                                    <table className="w-full text-sm">
                                        <thead className="bg-[var(--panel)] sticky top-0">
                                            <tr className="text-xs text-[var(--muted)]">
                                                <th className="text-left px-3 py-2">시각</th>
                                                <th className="text-right px-3 py-2">가격</th>
                                                <th className="text-left px-3 py-2">출처</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--panel-border)]">
                                            {seriesData
                                                .filter((tick) => tick.symbol?.toUpperCase().includes("SILVER"))
                                                .slice(0, 10)
                                                .map((tick) => (
                                                    <tr key={tick.tick_id} className="hover:bg-[var(--panel-hover)]">
                                                        <td className="px-3 py-2 text-xs">{formatDateTimeKst(tick.observed_at)}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-xs">
                                                            {formatKrw(tick.price_krw_per_g / 1.2)}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-[var(--muted)]">
                                                            {tick.symbol?.toUpperCase().includes("SILVER_CN") ? "중국" : "한국"}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* Settings & Input */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-3 border-b border-[var(--panel-border)]">
                                <span className="font-semibold text-sm">CS 설정</span>
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--muted)] block mb-1">fx_markup</label>
                                        <Input
                                            type="number"
                                            step="0.000001"
                                            value={csFxMarkup}
                                            onChange={(e) => setCsFxMarkup(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--muted)] block mb-1">보정계수</label>
                                        <Input
                                            type="number"
                                            step="0.000001"
                                            value={csCorrectionFactor}
                                            onChange={(e) => setCsCorrectionFactor(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    className="w-full h-8 text-sm"
                                    onClick={saveCsConfig}
                                    disabled={csConfigSaving}
                                >
                                    {csConfigSaving ? "저장 중..." : "저장"}
                                </Button>
                            </CardBody>
                        </Card>

                        <Card className="border-[var(--panel-border)]">
                            <CardHeader className="py-3 border-b border-[var(--panel-border)]">
                                <span className="font-semibold text-sm">수동 입력</span>
                            </CardHeader>
                            <CardBody>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <Select {...form.register("role_code")} className="h-8 text-sm">
                                            <option value="GOLD">금</option>
                                            <option value="SILVER">은</option>
                                        </Select>
                                        <Input type="datetime-local" {...form.register("observed_at")} className="h-8 text-sm" />
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="가격"
                                            {...form.register("price_krw_per_g", { valueAsNumber: true })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-8 text-sm" disabled={mutation.isPending}>
                                        {mutation.isPending ? "저장 중..." : "저장"}
                                    </Button>
                                </form>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
