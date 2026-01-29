"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: Gauge },
  { href: "/catalog", label: "카탈로그", icon: Boxes },
  { href: "/orders_main", label: "주문", icon: ClipboardList },
  { href: "/party", label: "거래처", icon: Store },
  { href: "/shipments_main", label: "출고", icon: PackageCheck },
  { href: "/ar", label: "미수", icon: CreditCard },
  { href: "/market", label: "시세", icon: TrendingUp },
  { href: "/inventory", label: "재고", icon: Package },
  { href: "/purchase_cost_worklist", label: "원가마감", icon: ClipboardList },
  { href: "/repairs", label: "수리", icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r bg-background" id="sidebar.root">
      <div className="mb-8 flex items-center gap-3 px-3 pt-6" id="sidebar.brand">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] text-[var(--primary-foreground)]">
          J
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Jewel Ops</div>
          <div className="text-xs text-muted-foreground">Phase 1</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2" id="sidebar.nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/orders_main"
              ? pathname.startsWith("/orders")
              : item.href === "/shipments_main"
                ? pathname.startsWith("/shipments")
                : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2" id="sidebar.footer">
        <Link
          href="/settings"
          className="group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>설정</span>
        </Link>
      </div>
    </aside>
  );
}
