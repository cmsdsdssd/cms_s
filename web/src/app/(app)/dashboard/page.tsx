"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Coins,
  TrendingUp,
  Wrench,
  ClipboardList,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LayoutDashboard,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Formatters ────────────────────────────────────────────────
function fmtKrw(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "₩0";
  const abs = Math.abs(v);
  if (abs >= 1_0000_0000) return `₩${(v / 1_0000_0000).toFixed(1)}억`;
  if (abs >= 1_0000) return `₩${Math.round(v / 10000).toLocaleString()}만`;
  return `₩${Math.round(v).toLocaleString()}`;
}

function fmtG(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "0g";
  return `${v.toFixed(1)}g`;
}

function fmtNum(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString();
}

function fmtKrwPerG(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "₩0/g";
  return `₩${Math.round(v).toLocaleString()}/g`;
}

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ─── Accent palettes (index-safe class maps for each process) ──
const ACCENT = {
  shipment: {
    bg: "bg-blue-500/10",
    text: "text-blue-600",
    darkText: "dark:text-blue-400",
    border: "border-blue-500/20",
    icon: "text-blue-500",
  },
  ar: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    darkText: "dark:text-amber-400",
    border: "border-amber-500/20",
    icon: "text-amber-500",
  },
  market: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    darkText: "dark:text-emerald-400",
    border: "border-emerald-500/20",
    icon: "text-emerald-500",
  },
  repair: {
    bg: "bg-violet-500/10",
    text: "text-violet-600",
    darkText: "dark:text-violet-400",
    border: "border-violet-500/20",
    icon: "text-violet-500",
  },
  order: {
    bg: "bg-slate-500/10",
    text: "text-slate-600",
    darkText: "dark:text-slate-400",
    border: "border-slate-500/20",
    icon: "text-slate-500",
  },
};

// ─── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-[var(--chip)]",
        className
      )}
    />
  );
}

function KpiSkeleton() {
  return (
    <Card className="min-h-[120px]">
      <CardBody className="flex h-full flex-col justify-between gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-20" />
      </CardBody>
    </Card>
  );
}

function SectionSkeleton() {
  return (
    <Card>
      <div className="px-5 py-4">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
    </Card>
  );
}

// ─── Hero KPI Card ─────────────────────────────────────────────
type HeroKpiProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  accentBg: string;
};

function HeroKpiCard({ icon, label, value, sub, trend, accentBg }: HeroKpiProps) {
  return (
    <Card className="min-h-[130px] relative overflow-hidden">
      <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40", accentBg)} />
      <CardBody className="flex h-full flex-col justify-between relative z-10">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            {label}
          </p>
        </div>
        <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{value}</p>
        {(sub || trend) && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-[var(--success)]" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3 text-[var(--danger)]" />}
            {trend === "flat" && <Minus className="h-3 w-3 text-[var(--muted)]" />}
            {sub && (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend === "up"
                    ? "text-[var(--success)]"
                    : trend === "down"
                      ? "text-[var(--danger)]"
                      : "text-[var(--muted)]"
                )}
              >
                {sub}
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Process Section Card ──────────────────────────────────────
type MiniKpi = { label: string; value: string };
type MiniListItem = { label: string; value: string; badge?: { text: string; tone: "neutral" | "active" | "warning" | "danger" } };

type ProcessSectionProps = {
  icon: React.ReactNode;
  title: string;
  href: string;
  accent: typeof ACCENT.shipment;
  kpis: MiniKpi[];
  list?: MiniListItem[];
  emptyText?: string;
};

function ProcessSection({ icon, title, href, accent, kpis, list, emptyText }: ProcessSectionProps) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all duration-200 hover:shadow-[var(--shadow)] hover:-translate-y-0.5 cursor-pointer">
        {/* Header */}
        <div className={cn("flex items-center gap-2 px-5 py-3 border-b border-[var(--hairline)]")}>
          <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", accent.bg)}>
            {icon}
          </div>
          <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight">{title}</h3>
          <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[var(--muted-weak)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Mini KPIs */}
        <div className="px-5 py-3">
          <div className={cn("grid gap-3", kpis.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
            {kpis.map((k) => (
              <div key={k.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-weak)] mb-0.5">
                  {k.label}
                </p>
                <p className="text-base font-bold text-[var(--foreground)] tracking-tight">{k.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mini List */}
        {list && list.length > 0 ? (
          <div className="border-t border-[var(--hairline)] px-5 py-2">
            {list.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <span className="text-[var(--muted-strong)] truncate max-w-[55%]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{item.value}</span>
                  {item.badge && (
                    <Badge tone={item.badge.tone} className="text-[10px] px-1.5 py-0">
                      {item.badge.text}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : emptyText ? (
          <div className="border-t border-[var(--hairline)] px-5 py-4">
            <p className="text-xs text-[var(--muted-weak)] text-center">{emptyText}</p>
          </div>
        ) : null}
      </Card>
    </Link>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────
export default function DashboardPage() {
  const sb = useMemo(() => getSchemaClient(), []);
  const qc = useQueryClient();
  const today = todayDateStr();

  // ── 1. Shipments (today) ─────────────────────────────────────
  const shipmentsQ = useQuery({
    queryKey: ["dashboard_shipments", today],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env missing");
      // Get today's shipments
      const { data: headers, error: hErr } = await sb
        .from("cms_shipment_header")
        .select("shipment_id, status, confirmed_at, customer_party_id, ship_date, cms_party!cms_shipment_header_customer_party_id_fkey(name)")
        .gte("ship_date", today)
        .lte("ship_date", today)
        .order("created_at", { ascending: false })
        .limit(100);
      if (hErr) throw hErr;
      const rows = (headers ?? []) as Array<{
        shipment_id: string;
        status: string | null;
        confirmed_at: string | null;
        customer_party_id: string | null;
        ship_date: string | null;
        cms_party: { name: string } | null;
      }>;

      const confirmedIds = rows
        .filter((r) => r.confirmed_at)
        .map((r) => r.shipment_id);

      let totalSell = 0;
      let totalWeightG = 0;
      if (confirmedIds.length > 0) {
        const { data: lines, error: lErr } = await sb
          .from("cms_shipment_line")
          .select("total_amount_sell_krw, net_weight_g")
          .in("shipment_id", confirmedIds);
        if (!lErr && lines) {
          for (const l of lines as { total_amount_sell_krw: number | null; net_weight_g: number | null }[]) {
            totalSell += l.total_amount_sell_krw ?? 0;
            totalWeightG += l.net_weight_g ?? 0;
          }
        }
      }

      return {
        count: rows.length,
        confirmedCount: confirmedIds.length,
        totalSell,
        totalWeightG,
        recent: rows.slice(0, 5).map((r) => ({
          name: (r.cms_party as { name: string } | null)?.name ?? "—",
          status: r.status ?? "DRAFT",
          confirmed: !!r.confirmed_at,
        })),
      };
    },
    refetchInterval: 60_000,
  });

  // ── 2. AR positions ──────────────────────────────────────────
  const arQ = useQuery({
    queryKey: ["dashboard_ar"],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env missing");
      const { data, error } = await sb
        .from(CONTRACTS.views.arPositionByParty)
        .select("party_id, name, total_cash_outstanding_krw, gold_outstanding_g, silver_outstanding_g")
        .order("total_cash_outstanding_krw", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        party_id: string;
        name: string;
        total_cash_outstanding_krw: number | null;
        gold_outstanding_g: number | null;
        silver_outstanding_g: number | null;
      }>;
      const withBalance = rows.filter((r) => Math.abs(r.total_cash_outstanding_krw ?? 0) > 100);
      const totalOutstanding = rows.reduce((s, r) => s + (r.total_cash_outstanding_krw ?? 0), 0);
      const totalGold = rows.reduce((s, r) => s + (r.gold_outstanding_g ?? 0), 0);
      const totalSilver = rows.reduce((s, r) => s + (r.silver_outstanding_g ?? 0), 0);
      return {
        totalOutstanding,
        totalGold,
        totalSilver,
        customerCount: withBalance.length,
        top5: withBalance.slice(0, 5).map((r) => ({
          name: r.name,
          amount: r.total_cash_outstanding_krw ?? 0,
        })),
      };
    },
    refetchInterval: 120_000,
  });

  // ── 3. Repairs ───────────────────────────────────────────────
  const repairsQ = useQuery({
    queryKey: ["dashboard_repairs"],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env missing");
      const { data, error } = await sb
        .from(CONTRACTS.views.repairLineEnriched)
        .select("repair_line_id, status, customer_name, repair_fee_krw")
        .in("status", ["RECEIVED", "IN_PROGRESS", "READY"])
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        repair_line_id: string;
        status: string;
        customer_name: string | null;
        repair_fee_krw: number | null;
      }>;
      const received = rows.filter((r) => r.status === "RECEIVED").length;
      const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
      const ready = rows.filter((r) => r.status === "READY").length;
      return { total: rows.length, received, inProgress, ready };
    },
    refetchInterval: 120_000,
  });

  // ── 4. Orders (unshipped) ────────────────────────────────────
  const ordersQ = useQuery({
    queryKey: ["dashboard_orders"],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env missing");
      const { data, error } = await sb
        .from(CONTRACTS.views.ordersWorklist)
        .select("order_line_id, display_status, order_date, client_name")
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        order_line_id: string;
        display_status: string | null;
        order_date: string | null;
        client_name: string | null;
      }>;
      const unshipped = rows.filter(
        (r) => r.display_status && !["SHIPPED", "CANCELLED", "COMPLETED"].includes(r.display_status)
      );
      const todayOrders = rows.filter((r) => r.order_date === today);
      return {
        total: rows.length,
        unshipped: unshipped.length,
        todayNew: todayOrders.length,
      };
    },
    refetchInterval: 120_000,
  });

  // ── 5. Market ────────────────────────────────────────────────
  const marketQ = useQuery({
    queryKey: ["dashboard_market"],
    queryFn: async () => {
      if (!sb) throw new Error("Supabase env missing");
      const { data, error } = await sb
        .from(CONTRACTS.views.marketLatestGoldSilverOps)
        .select("*")
        .limit(10);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        symbol?: string;
        role?: string;
        price?: number;
        prev_close_price?: number | null;
        change_pct?: number | null;
        recorded_at?: string | null;
      }>;
      const gold = rows.find((r) => (r.role ?? "").includes("GOLD") || (r.symbol ?? "").includes("GOLD"));
      const silver = rows.find((r) => (r.role ?? "").includes("SILVER") || (r.symbol ?? "").includes("SILVER"));
      return {
        goldPrice: gold?.price ?? null,
        goldPrevClose: gold?.prev_close_price ?? null,
        goldChangePct: gold?.change_pct ?? null,
        silverPrice: silver?.price ?? null,
        silverPrevClose: silver?.prev_close_price ?? null,
        silverChangePct: silver?.change_pct ?? null,
        goldRecordedAt: gold?.recorded_at ?? null,
      };
    },
    refetchInterval: 300_000,
  });

  const isLoading =
    shipmentsQ.isLoading || arQ.isLoading || repairsQ.isLoading || ordersQ.isLoading || marketQ.isLoading;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard_shipments"] });
    qc.invalidateQueries({ queryKey: ["dashboard_ar"] });
    qc.invalidateQueries({ queryKey: ["dashboard_repairs"] });
    qc.invalidateQueries({ queryKey: ["dashboard_orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard_market"] });
  };

  // ── Derived values ───────────────────────────────────────────
  const ship = shipmentsQ.data;
  const ar = arQ.data;
  const rep = repairsQ.data;
  const ord = ordersQ.data;
  const mkt = marketQ.data;

  const goldTrend: "up" | "down" | "flat" =
    mkt?.goldChangePct != null ? (mkt.goldChangePct > 0 ? "up" : mkt.goldChangePct < 0 ? "down" : "flat") : "flat";

  return (
    <div className="space-y-6 pb-10" id="dashboard.root">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-[var(--primary-soft)]">
            <LayoutDashboard className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">대시보드</h1>
            <p className="text-xs text-[var(--muted)]">
              운영 현황 요약 · {today}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          새로고침
        </Button>
      </div>

      {/* ── Hero KPI Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <HeroKpiCard
              icon={<Package className="h-4 w-4 text-blue-500" />}
              label="오늘 매출"
              value={fmtKrw(ship?.totalSell)}
              sub={`${ship?.confirmedCount ?? 0}건 확정`}
              accentBg="bg-blue-500"
            />
            <HeroKpiCard
              icon={<Coins className="h-4 w-4 text-amber-500" />}
              label="미수 잔액"
              value={fmtKrw(ar?.totalOutstanding)}
              sub={`${ar?.customerCount ?? 0}개 거래처`}
              accentBg="bg-amber-500"
            />
            <HeroKpiCard
              icon={<Wrench className="h-4 w-4 text-violet-500" />}
              label="수리 진행"
              value={`${rep?.total ?? 0}건`}
              sub={rep ? `대기 ${rep.received} · 작업 ${rep.inProgress} · 완료 ${rep.ready}` : undefined}
              accentBg="bg-violet-500"
            />
            <HeroKpiCard
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              label="금 시세"
              value={mkt?.goldPrice ? fmtKrwPerG(mkt.goldPrice) : "—"}
              sub={
                mkt?.goldChangePct != null
                  ? `${mkt.goldChangePct > 0 ? "+" : ""}${mkt.goldChangePct.toFixed(2)}%`
                  : undefined
              }
              trend={goldTrend}
              accentBg="bg-emerald-500"
            />
          </>
        )}
      </div>

      {/* ── Process Sections ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </>
        ) : (
          <>
            {/* Shipments */}
            <ProcessSection
              icon={<Package className={cn("h-4 w-4", ACCENT.shipment.icon)} />}
              title="출고 (Shipments)"
              href="/shipments"
              accent={ACCENT.shipment}
              kpis={[
                { label: "오늘 건수", value: `${ship?.count ?? 0}건` },
                { label: "확정", value: `${ship?.confirmedCount ?? 0}건` },
                { label: "총 중량", value: fmtG(ship?.totalWeightG) },
              ]}
              list={ship?.recent?.map((r) => ({
                label: r.name,
                value: "",
                badge: {
                  text: r.confirmed ? "확정" : r.status === "DRAFT" ? "준비" : r.status,
                  tone: r.confirmed
                    ? ("active" as const)
                    : r.status === "DRAFT"
                      ? ("warning" as const)
                      : ("neutral" as const),
                },
              }))}
              emptyText="오늘 출고 내역이 없습니다"
            />

            {/* AR */}
            <ProcessSection
              icon={<Coins className={cn("h-4 w-4", ACCENT.ar.icon)} />}
              title="미수금 (AR)"
              href="/ar/v2"
              accent={ACCENT.ar}
              kpis={[
                { label: "총 미수", value: fmtKrw(ar?.totalOutstanding) },
                { label: "금 미수", value: fmtG(ar?.totalGold) },
                { label: "은 미수", value: fmtG(ar?.totalSilver) },
              ]}
              list={ar?.top5?.map((r) => ({
                label: r.name,
                value: fmtKrw(r.amount),
              }))}
              emptyText="미수 잔액이 없습니다"
            />

            {/* Market */}
            <ProcessSection
              icon={<TrendingUp className={cn("h-4 w-4", ACCENT.market.icon)} />}
              title="시세 (Market)"
              href="/market"
              accent={ACCENT.market}
              kpis={[
                { label: "금", value: mkt?.goldPrice ? fmtKrwPerG(mkt.goldPrice) : "—" },
                { label: "은", value: mkt?.silverPrice ? fmtKrwPerG(mkt.silverPrice) : "—" },
              ]}
              list={[
                ...(mkt?.goldChangePct != null
                  ? [
                    {
                      label: "금 등락",
                      value: `${mkt.goldChangePct > 0 ? "+" : ""}${mkt.goldChangePct.toFixed(2)}%`,
                      badge: {
                        text: mkt.goldChangePct > 0 ? "상승" : mkt.goldChangePct < 0 ? "하락" : "보합",
                        tone: (mkt.goldChangePct > 0
                          ? "active"
                          : mkt.goldChangePct < 0
                            ? "danger"
                            : "neutral") as "active" | "danger" | "neutral",
                      },
                    },
                  ]
                  : []),
                ...(mkt?.silverChangePct != null
                  ? [
                    {
                      label: "은 등락",
                      value: `${mkt.silverChangePct > 0 ? "+" : ""}${mkt.silverChangePct.toFixed(2)}%`,
                      badge: {
                        text: mkt.silverChangePct > 0 ? "상승" : mkt.silverChangePct < 0 ? "하락" : "보합",
                        tone: (mkt.silverChangePct > 0
                          ? "active"
                          : mkt.silverChangePct < 0
                            ? "danger"
                            : "neutral") as "active" | "danger" | "neutral",
                      },
                    },
                  ]
                  : []),
              ]}
              emptyText="시세 데이터 없음"
            />

            {/* Repairs */}
            <ProcessSection
              icon={<Wrench className={cn("h-4 w-4", ACCENT.repair.icon)} />}
              title="수리 (Repairs)"
              href="/repairs"
              accent={ACCENT.repair}
              kpis={[
                { label: "총 진행", value: `${rep?.total ?? 0}건` },
                { label: "대기", value: `${rep?.received ?? 0}` },
                { label: "작업중", value: `${rep?.inProgress ?? 0}` },
              ]}
              list={
                rep?.ready
                  ? [
                    {
                      label: "출고 준비 완료",
                      value: `${rep.ready}건`,
                      badge: { text: "완료", tone: "active" as const },
                    },
                  ]
                  : []
              }
              emptyText="진행중인 수리건이 없습니다"
            />

            {/* Orders */}
            <ProcessSection
              icon={<ClipboardList className={cn("h-4 w-4", ACCENT.order.icon)} />}
              title="주문 (Orders)"
              href="/orders"
              accent={ACCENT.order}
              kpis={[
                { label: "미출고", value: `${ord?.unshipped ?? 0}건` },
                { label: "오늘 수주", value: `${ord?.todayNew ?? 0}건` },
                { label: "전체", value: `${ord?.total ?? 0}건` },
              ]}
              emptyText="주문 내역이 없습니다"
            />
          </>
        )}
      </div>
    </div>
  );
}
