"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Search,
  Menu,
  ClipboardList,
  PackageCheck,
  CreditCard,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { findNavMatch } from "@/components/layout/nav-items";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MarketTicker } from "@/components/ui/market-ticker";

interface GlobalTopBarProps {
  onMobileMenuOpen: () => void;
  onWorkbenchOpen?: () => void;
}

export function GlobalTopBar({ onMobileMenuOpen, onWorkbenchOpen }: GlobalTopBarProps) {
  const pathname = usePathname();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navMatch = findNavMatch(pathname);
  const breadcrumbs = navMatch
    ? [
      { label: navMatch.groupLabel },
      { label: navMatch.item.label, href: navMatch.item.href },
    ]
    : [{ label: "홈", href: "/" }];

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center gap-4 border-b border-[var(--hairline)] bg-[var(--background)]/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile Menu Button */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden -ml-2 p-2 text-[var(--muted-strong)] hover:text-[var(--foreground)]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <nav className="hidden md:flex items-center text-sm font-medium text-[var(--muted)]">
        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb.label}-${index}`} className="flex items-center">
            {index > 0 && <span className="mx-2 text-[var(--muted-weak)]">/</span>}
            {crumb.href ? (
              crumb.href === "/workbench" ? (
                <button
                  type="button"
                  onClick={() => onWorkbenchOpen?.()}
                  className={cn(
                    "transition-colors hover:text-[var(--foreground)]",
                    index === breadcrumbs.length - 1 ? "text-[var(--foreground)] font-semibold" : ""
                  )}
                >
                  {crumb.label}
                </button>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    "transition-colors hover:text-[var(--foreground)]",
                    index === breadcrumbs.length - 1 ? "text-[var(--foreground)] font-semibold" : ""
                  )}
                >
                  {crumb.label}
                </Link>
              )
            ) : (
              <span className={index === breadcrumbs.length - 1 ? "text-[var(--foreground)] font-semibold" : ""}>
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Left Search */}
      <div className="hidden sm:block w-full max-w-xs">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
          <Input
            type="search"
            placeholder="검색 (Ctrl+K)"
            className="h-9 w-full bg-[var(--input-bg)] pl-9 pr-4 text-sm shadow-none focus-visible:ring-1 cursor-pointer"
            readOnly
            onClick={() => setIsCommandPaletteOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
              }
            }}
          />
        </div>
      </div>

      {/* Center Market Ticker - Moved to Left as requested */}
      <div className="flex-1 flex justify-start pl-4 border-l border-[var(--hairline)] h-8 items-center ml-2">

        <div className="min-w-0 max-w-[52vw] sm:max-w-[60vw] lg:max-w-none">
          <MarketTicker variant="compact" />
        </div>
      </div>

      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenWorkbench={onWorkbenchOpen}
      />

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {/* Quick Actions ... */}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Placeholder */}
        <div className="flex items-center gap-2">
          {/* Quick Actions */}
          <div className="hidden sm:flex items-center gap-1 border-r border-[var(--hairline)] pr-4 mr-1">
            <Link href="/orders">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--muted-strong)]" title="주문 입력">
                <ClipboardList className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/shipments">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--muted-strong)]" title="출고 관리">
                <PackageCheck className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/ar/v2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--muted-strong)]" title="미수금">
                <CreditCard className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* User Placeholder Icon */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[var(--chip)] flex items-center justify-center border border-[var(--hairline)] text-[var(--muted-strong)]">
              <User className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div> {/* <--- 이 닫는 태그가 빠져 있었습니다 (110번 줄 div 닫기) */}
    </header>
  );
}
