"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mobileOnlyTabs } from "@/mobile/shared/mobile-tabs";

function isActive(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function MobileBottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--panel-border)] bg-[var(--panel)]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid h-[56px] max-w-xl grid-cols-5 gap-1 px-2">
        {mobileOnlyTabs.map((tab) => {
          const active = isActive(pathname, tab.activePrefixes);
          const Icon = tab.icon;
          const isHome = tab.key === "home";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-[10px] text-[10px] font-medium transition",
                isHome && "font-semibold",
                active ? "bg-[var(--active-bg)] text-[var(--foreground)]" : "text-[var(--muted)]"
              )}
            >
              <Icon
                className={cn(
                  isHome ? "h-[18px] w-[18px]" : "h-4 w-4",
                  active ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
