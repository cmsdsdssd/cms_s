import type { ReactNode } from "react";

import { TopNav } from "@/components/layout/top-nav";
import { MarketTicker } from "@/components/ui/market-ticker";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] overflow-x-hidden" data-app-shell="v4">
      {/* 상단 주 네비게이션 (레거시 좌측 사이드바 제거) */}
      <header className="sticky top-0 z-40 border-b border-[var(--panel-border)] bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-10">
          <div className="py-3">
            <TopNav />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-10 py-6">
        {/* 시세 티커 (기능 유지, 위치만 정리) */}
        <div className="mb-6 flex items-center justify-center">
          <MarketTicker />
        </div>
        {children}
      </main>
    </div>
  );
}
