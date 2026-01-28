"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  Gauge,
  Package,
  PackageCheck,
  Settings,
  Store,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: Gauge },
  { href: "/catalog", label: "카탈로그", icon: Boxes },
  { href: "/orders_main", label: "주문", icon: ClipboardList },
  { href: "/party", label: "거래처", icon: Store },
  { href: "/repairs", label: "수리", icon: Wrench },
  { href: "/shipments_main", label: "출고", icon: PackageCheck },
  { href: "/ar", label: "미수", icon: CreditCard },
  { href: "/market", label: "시세", icon: TrendingUp },
  { href: "/inventory", label: "재고", icon: Package },
  { href: "/parts", label: "부속", icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] flex-col border-r border-[var(--panel-border)] bg-[var(--panel)] px-4 py-6 shadow-[var(--shadow-sm)] z-10">
      <div className="mb-8 flex items-center gap-3 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] text-white shadow-md">
          <span className="font-bold">CS</span>
        </div>
        <div>
          <p className="font-bold text-[var(--foreground)] tracking-tight">MS_S System</p>
          <p className="text-xs font-medium text-[var(--muted)]">Production v1</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = item.href === "/orders_main"
            ? pathname.startsWith("/orders") || pathname.startsWith("/orders_main")
            : item.href === "/shipments_main"
              ? pathname.startsWith("/shipments") || pathname.startsWith("/shipments_main")
              : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[var(--chip)] text-[var(--primary-strong)] shadow-sm"
                  : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon
                size={18}
                className={cn(
                  "transition-colors",
                  active ? "text-[var(--primary)]" : "text-[var(--muted-weak)] group-hover:text-[var(--foreground)]"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-[var(--panel-border)] pt-4">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all",
            pathname === "/settings"
              ? "bg-[var(--chip)] text-[var(--primary-strong)]"
              : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)]"
          )}
        >
          <Settings
            size={18}
            className={cn(
              "transition-colors",
              pathname === "/settings"
                ? "text-[var(--primary)]"
                : "text-[var(--muted-weak)] group-hover:text-[var(--foreground)]"
            )}
          />
          설정
        </Link>
      </div>
    </aside>
  );
}
