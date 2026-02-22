"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────
   출고 탭 내부 세그먼트: 출고대기 | 출고완료
   PRD §6.1  출고 탭 화면 구성
   ────────────────────────────────────────────── */
const SEGMENTS = [
    { label: "출고대기", href: "/shipments_main", prefix: "/shipments_main" },
    { label: "출고완료", href: "/shipments_history", prefix: "/shipments_history" },
];

export function ShipmentsMobileTabs() {
    const pathname = usePathname();

    return (
        <div className="lg:hidden sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 border-b border-[var(--hairline)] bg-[var(--background)]/90 backdrop-blur-md">
            <div className="grid grid-cols-2 rounded-lg bg-[var(--chip)] p-1">
                {SEGMENTS.map((seg) => {
                    const active = pathname.startsWith(seg.prefix);
                    return (
                        <Link
                            key={seg.href}
                            href={seg.href}
                            className={cn(
                                "text-center text-sm font-medium py-2 rounded-md transition-all duration-200",
                                active
                                    ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm font-semibold"
                                    : "text-[var(--muted-strong)]"
                            )}
                        >
                            {seg.label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
