import type { ElementType } from "react";
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
    label: "Operations",
    items: [
      { label: "Orders", href: "/orders", icon: ClipboardList },
      { label: "Orders Worklist", href: "/orders_main", icon: ClipboardList },
      { label: "Shipments", href: "/shipments", icon: PackageCheck },
      { label: "AR", href: "/ar", icon: CreditCard },
    ],
  },
  {
    label: "Cost & Receipts",
    items: [
      { label: "Cost Worklist", href: "/purchase_cost_worklist", icon: Calculator },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Catalog", href: "/catalog", icon: Boxes },
      { label: "Party", href: "/party", icon: Store },
      { label: "BOM", href: "/bom", icon: Settings },
    ],
  },
  {
    label: "Stock",
    items: [
      { label: "Inventory", href: "/inventory", icon: Package },
    ],
  },
  {
    label: "Market",
    items: [
      { label: "Market", href: "/market", icon: TrendingUp },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Repairs", href: "/repairs", icon: Wrench },
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
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
