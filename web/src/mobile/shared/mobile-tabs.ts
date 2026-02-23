import type { ElementType } from "react";
import { PackageCheck, Boxes, LayoutDashboard, CreditCard, User } from "lucide-react";

export type MobileOnlyTabItem = {
  key: string;
  label: string;
  href: string;
  icon: ElementType;
  activePrefixes: string[];
};

export const mobileOnlyTabs: MobileOnlyTabItem[] = [
  {
    key: "shipments",
    label: "출고",
    href: "/m/shipments",
    icon: PackageCheck,
    activePrefixes: ["/m/shipments"],
  },
  {
    key: "catalog",
    label: "카탈로그",
    href: "/m/catalog",
    icon: Boxes,
    activePrefixes: ["/m/catalog"],
  },
  {
    key: "home",
    label: "홈",
    href: "/dashboard",
    icon: LayoutDashboard,
    activePrefixes: ["/dashboard", "/", "/analysis"],
  },
  {
    key: "receivables",
    label: "미수",
    href: "/m/receivables/ar",
    icon: CreditCard,
    activePrefixes: ["/m/receivables"],
  },
  {
    key: "settings",
    label: "설정",
    href: "/m/settings",
    icon: User,
    activePrefixes: ["/m/settings"],
  },
];
