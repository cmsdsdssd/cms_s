import type { ElementType } from "react";
import {
    PackageCheck,
    Boxes,
    LayoutDashboard,
    CreditCard,
    User,
} from "lucide-react";

/* ──────────────────────────────────────────────
   모바일 하단 5탭 정의
   PRD §4.2  탭-라우트 매핑
   PRD §4.3  활성 탭 판정 (prefix 기반)
   ────────────────────────────────────────────── */

export type MobileTabItem = {
    key: string;
    label: string;
    href: string;
    icon: ElementType;
    /** 이 prefix 중 하나로 시작하면 해당 탭이 active */
    activePrefixes: string[];
};

export const mobileTabs: MobileTabItem[] = [
    {
        key: "shipments",
        label: "출고",
        href: "/shipments_main",
        icon: PackageCheck,
        activePrefixes: [
            "/shipments_main",
            "/shipments_history",
            "/shipments",
            "/shipments_print",
            "/shipments_analysis",
        ],
    },
    {
        key: "catalog",
        label: "카탈로그",
        href: "/catalog",
        icon: Boxes,
        activePrefixes: ["/catalog"],
    },
    {
        key: "home",
        label: "홈",
        href: "/dashboard",
        icon: LayoutDashboard,
        activePrefixes: ["/dashboard", "/", "/analysis"],
    },
    {
        key: "ar",
        label: "미수",
        href: "/ar/v2",
        icon: CreditCard,
        activePrefixes: ["/ar", "/ap"],
    },
    {
        key: "me",
        label: "설정",
        href: "/me",
        icon: User,
        activePrefixes: ["/me", "/settings"],
    },
];
