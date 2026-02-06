"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalTopBar } from "@/components/layout/global-top-bar";
import { WorkbenchPartySearchModal } from "@/components/party/workbench-party-search-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workbenchSearchOpen, setWorkbenchSearchOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--background)]" data-app-shell="v5">
      {/* Sidebar Navigation */}
      <SidebarNav 
        mobileOpen={mobileMenuOpen} 
        onMobileClose={() => setMobileMenuOpen(false)}
        onWorkbenchOpen={() => setWorkbenchSearchOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 transition-[margin] duration-300 ease-in-out">
        <GlobalTopBar
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onWorkbenchOpen={() => setWorkbenchSearchOpen(true)}
        />
        
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {children}
        </main>
      </div>

      <WorkbenchPartySearchModal
        open={workbenchSearchOpen}
        onClose={() => setWorkbenchSearchOpen(false)}
      />
    </div>
  );
}
