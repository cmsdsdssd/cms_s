"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mobileTabs } from "./mobile-tabs";

/* ──────────────────────────────────────────────
   활성 탭 판정 — prefix 매칭
   ────────────────────────────────────────────── */
function isActive(pathname: string, prefixes: string[]) {
    // "/" exact match
    if (prefixes.includes("/") && pathname === "/") return true;
    return prefixes.some(
        (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
    );
}

/* ──────────────────────────────────────────────
   MobileBottomNav — KREAM-inspired minimal design
   모바일 전용: lg:hidden
   ────────────────────────────────────────────── */
export function MobileBottomNav() {
    const pathname = usePathname();

    return (
        <nav
            className={cn(
                // 기본 구조 — 모바일 전용
                "fixed bottom-0 inset-x-0 z-50 lg:hidden",
                // KREAM-style: 흰 배경, 상단 얇은 라인, safe-area
                "border-t border-[var(--hairline)]",
                "bg-[var(--panel)]/95 backdrop-blur-xl",
                // 높이 + safe-area
                "pb-[env(safe-area-inset-bottom,0px)]"
            )}
            id="mobile-bottom-nav"
        >
            <div className="grid grid-cols-5 gap-1 px-2 h-[56px] max-w-lg mx-auto">
                {mobileTabs.map((tab) => {
                    const active = isActive(pathname, tab.activePrefixes);
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            className={cn(
                                // 탭 아이템 기본 스타일
                                "flex flex-col items-center justify-center gap-0.5",
                                "text-[10px] font-medium tracking-tight",
                                "transition-all duration-200 ease-out",
                                "active:scale-90",
                                // KREAM 스타일: active = 검정(볼드), inactive = 회색
                                active
                                    ? "text-[var(--foreground)] font-semibold"
                                    : "text-[var(--muted-weak)] hover:text-[var(--muted-strong)]"
                            )}
                        >
                            {/* 아이콘 — KREAM처럼 얇은 선 스타일 */}
                            <div className="relative flex items-center justify-center h-6">
                                <Icon
                                    className={cn(
                                        "h-[22px] w-[22px] transition-all duration-200",
                                        active ? "stroke-[2.2px]" : "stroke-[1.5px]"
                                    )}
                                />
                                {/* 활성 인디케이터 — 미세한 도트 */}
                                {active && (
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-[var(--foreground)]" />
                                )}
                            </div>
                            {/* 라벨 */}
                            <span className="leading-none">{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
