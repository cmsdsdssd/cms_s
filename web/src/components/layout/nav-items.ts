import type { ElementType } from "react";
import {
  Boxes,
  ClipboardList,
  Store,
  PackageCheck,
  CreditCard,
  TrendingUp,
  Package,
  Wrench,
  Settings,
  Calculator
} from "lucide-react";

export type NavItem = {
  label: string;
  href?: string;
  icon?: ElementType;
  items?: NavItem[];
};

export const navItems: NavItem[] = [
  {
    label: "통합 작업대",
    items: [
      { label: "거래처별 작업", href: "/workbench", icon: Store },
    ],
  },
  {
    label: "카탈로그",
    items: [
      { label: "제품 카탈로그", href: "/catalog", icon: Boxes },
    ],
  },
  {
    label: "업무 흐름",
    items: [
      { label: "주문", href: "/orders_main", icon: ClipboardList },
      { label: "공장영수증/매칭", href: "/new_receipt_line_workbench", icon: ClipboardList },
      { label: "출고", href: "/shipments_main", icon: PackageCheck },
      { label: "출고확인", href: "/shipments_history", icon: PackageCheck },
    ],
  },
  {
    label: "수리",
    items: [
      { label: "수리 관리", href: "/repairs", icon: Wrench },
    ],
  },
  {
    label: "미수",
    items: [
      { label: "손님미수", href: "/ar/v2", icon: CreditCard },
      { label: "공장미수", href: "/ap", icon: Calculator },
      { label: "공장정합", href: "/ap/reconcile", icon: Calculator },
    ],
  },
  {
    label: "현황 및 조회",
    items: [
      { label: "공장발주 전송내역", href: "/factory_po_history", icon: Package },
      { label: "재고 관리", href: "/inventory", icon: Package },
    ],
  },
  {
    label: "기준 정보",
    items: [
      { label: "거래처 관리", href: "/party", icon: Store },
      { label: "시세 관리", href: "/market", icon: TrendingUp },
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { label: "설정", href: "/settings", icon: Settings },
];

export type NavMatch = {
  groupLabel: string;
  item: NavItem;
};

const isExactOrChild = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const isNavItemActive = (pathname: string, href: string) => {
  if (href === "/orders_main") return pathname.startsWith("/orders_main");
  if (href === "/orders") return isExactOrChild(pathname, "/orders");
  if (href === "/shipments") return pathname.startsWith("/shipments");
  return isExactOrChild(pathname, href);
};

export const findNavMatch = (pathname: string): NavMatch | null => {
  for (const group of navItems) {
    for (const item of group.items ?? []) {
      if (!item.href) continue;
      if (isNavItemActive(pathname, item.href)) {
        return { groupLabel: group.label, item };
      }
    }
  }

  for (const item of bottomNavItems) {
    if (!item.href) continue;
    if (isNavItemActive(pathname, item.href)) {
      return { groupLabel: "Settings", item };
    }
  }

  return null;
};
