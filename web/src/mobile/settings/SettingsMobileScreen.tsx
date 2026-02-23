"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { MobileSection } from "@/mobile/shared/MobileSection";

export function SettingsMobileScreen() {
  const [mobileRoutingOn, setMobileRoutingOn] = useState(() => {
    if (typeof document === "undefined") return true;
    const raw = document.cookie
      .split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith("cms_mobile_ui="));
    if (!raw) return true;
    const value = raw.split("=")[1];
    return value !== "off";
  });

  const applyCookie = (enabled: boolean) => {
    document.cookie = `cms_mobile_ui=${enabled ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
    setMobileRoutingOn(enabled);
  };

  return (
    <MobilePage title="설정" subtitle="모바일 허브">
      <MobileSection title="프로필">
        <div className="text-sm font-semibold">CMS 관리자</div>
        <div className="mt-1 text-xs text-[var(--muted)]">모바일 업무 모드</div>
      </MobileSection>

      <MobileSection title="기본 설정">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-[var(--muted)]">모바일 전용 라우팅 사용</div>
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant={mobileRoutingOn ? "primary" : "secondary"} onClick={() => applyCookie(true)}>ON</Button>
            <Button size="sm" variant={!mobileRoutingOn ? "primary" : "secondary"} onClick={() => applyCookie(false)}>OFF</Button>
          </div>
        </div>
      </MobileSection>

      <MobileSection title="빠른 이동">
        <div className="grid grid-cols-1 gap-2">
          <Link href="/m/settings/advanced">
            <Button className="w-full">고급설정 열기</Button>
          </Link>
          <button
            type="button"
            className="h-10 rounded-[var(--radius)] border border-[var(--panel-border)] bg-[var(--panel)] text-sm"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            로그아웃
          </button>
        </div>
      </MobileSection>
    </MobilePage>
  );
}
