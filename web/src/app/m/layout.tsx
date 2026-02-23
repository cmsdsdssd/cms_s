import type { ReactNode } from "react";
import { MobileBottomTabs } from "@/mobile/shared/MobileBottomTabs";

type MobileRouteLayoutProps = {
  children: ReactNode;
};

export default function MobileRouteLayout({ children }: MobileRouteLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] pb-[calc(56px+env(safe-area-inset-bottom))] lg:hidden">
      {children}
      <MobileBottomTabs />
    </div>
  );
}
