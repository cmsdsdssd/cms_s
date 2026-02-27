"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
    Gauge,
    Boxes,
    ClipboardList,
    Store,
    PackageCheck,
    CreditCard,
    TrendingUp,
    Package,
    Wrench,
    Settings,
    Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { MarketTicker } from "@/components/ui/market-ticker";
import { BrandMark } from "@/components/layout/brand-mark";

const navItems = [
    { href: "/dashboard", label: "대시보드", icon: Gauge },
    { href: "/workbench", label: "통합작업대", icon: Boxes },
    { href: "/catalog", label: "카탈로그", icon: Boxes },
    { href: "/orders_main", label: "주문", icon: ClipboardList },
    { href: "/party", label: "거래처", icon: Store },
    { href: "/shipments_main", label: "출고", icon: PackageCheck },
    { href: "/ar", label: "미수", icon: CreditCard },
    { href: "/market", label: "시세", icon: TrendingUp },
    { href: "/inventory", label: "재고", icon: Package },
    { href: "/bom", label: "조합(BOM)", icon: Settings },
    { href: "/purchase_cost_worklist", label: "원가마감", icon: ClipboardList },
    { href: "/repairs", label: "수리", icon: Wrench },
];

function isActive(pathname: string, href: string) {
    if (href === "/orders_main") return pathname.startsWith("/orders");
    if (href === "/shipments_main") return pathname.startsWith("/shipments");
    if (href === "/workbench") return pathname.startsWith("/workbench");
    return pathname === href;
}

export function TopNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const currentLabel = useMemo(() => {
        const match = navItems.find((item) => isActive(pathname, item.href));
        return match?.label ?? "";
    }, [pathname]);

    return (
        <div className="flex min-w-0 items-center gap-4" id="topnav.root">
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--hairline)] bg-gradient-to-br from-[var(--panel)] to-[var(--surface)] shadow-[var(--shadow-sm)] text-[#b68a2e] transition-transform duration-200 group-hover:scale-105">
                        <BrandMark className="h-5 w-5" />
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-bold tracking-tight text-[var(--foreground)]">MS</div>
                        <div className="text-[11px] font-medium text-[var(--muted)]">{currentLabel || "Phase 1"}</div>
                    </div>
                </Link>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-4" id="topnav.content">
                <div className="min-w-0 max-w-[52vw] sm:max-w-[60vw] lg:max-w-none" id="topnav.ticker">
                    <MarketTicker variant="compact" />
                </div>

                {/* Desktop nav (✅ 공간이 부족하면 가로 스크롤로 안전하게) */}
                <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-end" id="topnav.desktop">
                    <div className="flex min-w-max items-center gap-1 overflow-x-auto whitespace-nowrap pr-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(pathname, item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]",
                                        active
                                            ? "bg-[var(--foreground)] text-white shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--hairline)]"
                                            : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)]"
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4", active ? "text-white" : "text-[var(--muted)]")} />
                                    <span className="whitespace-nowrap">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </div>

            {/* Mobile menu */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-[var(--panel)] px-3 py-2 text-sm font-medium shadow-[var(--shadow-sm)] transition-all duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow)] active:translate-y-0 active:scale-95"
                aria-label="메뉴 열기"
            >
                <Menu className="h-4 w-4" />
                메뉴
            </button>

            <Modal open={open} onClose={() => setOpen(false)} title="메뉴" className="max-w-md">
                <div className="space-y-3 p-1">
                    <div className="rounded-[var(--radius-md)] border border-[color:var(--hairline)] bg-[color:var(--panel)]/80 px-3 py-2 shadow-[var(--shadow-subtle)]">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-strong)]">
                            시세
                        </div>
                        <div className="min-w-0">
                            <MarketTicker variant="compact" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(pathname, item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium transition-all duration-200 ease-[var(--ease-out)]",
                                        active
                                            ? "bg-[var(--chip)] text-[var(--foreground)] shadow-[var(--shadow-subtle)]"
                                            : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)]"
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4", active ? "text-[var(--primary)]" : "text-[var(--muted)]")} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
