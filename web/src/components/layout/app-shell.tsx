import type { ReactNode } from "react";

import Sidebar from "@/components/layout/sidebar";
import { MarketTicker } from "@/components/ui/market-ticker";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)] overflow-x-hidden" data-app-shell="v2">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="min-h-screen px-4 md:px-8 py-8">
          <div className="mb-4 flex items-center justify-center">
            <MarketTicker />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
