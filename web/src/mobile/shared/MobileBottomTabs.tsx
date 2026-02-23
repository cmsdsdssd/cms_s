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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-500/40 bg-black/98 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
                active ? "bg-amber-500/20 text-amber-300" : "text-amber-500"
              )}
            >
              <Icon
                className={cn(
                  isHome ? "h-[18px] w-[18px]" : "h-4 w-4",
                  active ? "text-amber-300" : "text-amber-500"
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
