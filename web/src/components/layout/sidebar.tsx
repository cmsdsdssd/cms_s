"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  Gauge,
  PackageCheck,
  Settings,
  Store,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/catalog", label: "Catalog", icon: Boxes },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/party", label: "Party", icon: Store },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/shipments", label: "Shipments", icon: PackageCheck },
  { href: "/ar", label: "AR", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-[var(--panel-border)] bg-white px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--primary)] text-white">
          CS
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">CMS_S</p>
          <p className="text-xs text-[var(--muted)]">Phase1 Ops</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-medium",
                active
                  ? "bg-[#eef2f6] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[#f6f7f9]"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-medium",
            pathname === "/settings"
              ? "bg-[#eef2f6] text-[var(--foreground)]"
              : "text-[var(--muted)] hover:bg-[#f6f7f9]"
          )}
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
