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

const navItems = [
    { href: "/dashboard", label: "대시보드", icon: Gauge },
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
        <div className="flex items-center gap-4 min-w-0" id="topnav.root">
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[var(--panel-border)] bg-white shadow-[var(--shadow-sm)]">
                        <span className="text-sm font-extrabold tracking-tight">J</span>
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold">Jewel Ops</div>
                        <div className="text-xs text-[var(--muted)]">{currentLabel || "Phase 1"}</div>
                    </div>
                </Link>
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
                                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
                                    active
                                        ? "bg-[var(--chip)] text-[var(--foreground)]"
                                        : "text-[var(--muted)] hover:bg-white hover:shadow-[var(--shadow-sm)] hover:text-[var(--foreground)]"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="whitespace-nowrap">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Mobile menu */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-[12px] border border-[var(--panel-border)] bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-sm)]"
                aria-label="메뉴 열기"
            >
                <Menu className="h-4 w-4" />
                메뉴
            </button>

            <Modal open={open} onClose={() => setOpen(false)} title="메뉴" className="max-w-md">
                <div className="space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-[14px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm font-semibold",
                                    active ? "ring-2 ring-[var(--primary)]" : "hover:bg-[var(--panel-hover)]"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
}
