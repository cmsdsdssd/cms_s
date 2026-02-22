"use client";

import Link from "next/link";
import {
    User,
    Settings,
    LogOut,
    ChevronRight,
    Smartphone,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

/* ──────────────────────────────────────────────
   /me — 모바일 "설정" 탭 전용 경량 페이지
   사용자 정보, 로그아웃, 관리 설정 링크
   ────────────────────────────────────────────── */
export default function MePage() {
    return (
        <div className="space-y-6 max-w-lg mx-auto" id="me.root">
            {/* 페이지 타이틀 — 모바일에선 하단탭이 이미 "설정"을 표시 */}
            <div className="pt-2">
                <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                    내 정보
                </h1>
                <p className="text-xs text-[var(--muted)] mt-1">
                    계정 및 앱 설정
                </p>
            </div>

            {/* 사용자 프로필 카드 */}
            <Card>
                <CardBody className="flex items-center gap-4 p-5">
                    <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[var(--chip)] shrink-0">
                        <User className="h-7 w-7 text-[var(--muted-strong)]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-base font-bold text-[var(--foreground)] truncate">
                            CMS 관리자
                        </p>
                        <p className="text-xs text-[var(--muted)] truncate">
                            관리자 계정
                        </p>
                    </div>
                </CardBody>
            </Card>

            {/* 메뉴 리스트 */}
            <Card>
                <div className="divide-y divide-[var(--hairline)]">
                    {/* 관리 설정 */}
                    <Link
                        href="/settings"
                        className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--panel-hover)] transition-colors"
                    >
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[var(--chip)]">
                            <Settings className="h-4.5 w-4.5 text-[var(--muted-strong)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                관리 설정
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                                시세 · 마진 · 공장 팩스
                            </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[var(--muted-weak)]" />
                    </Link>

                    {/* 앱 정보 */}
                    <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[var(--chip)]">
                            <Smartphone className="h-4.5 w-4.5 text-[var(--muted-strong)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                앱 버전
                            </p>
                            <p className="text-xs text-[var(--muted)]">CMS v1.0</p>
                        </div>
                    </div>

                    {/* 로그아웃 */}
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--panel-hover)] transition-colors text-left"
                        onClick={() => {
                            // Supabase auth signOut if needed
                            window.location.href = "/";
                        }}
                    >
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-500/10">
                            <LogOut className="h-4.5 w-4.5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-500">로그아웃</p>
                        </div>
                    </button>
                </div>
            </Card>
        </div>
    );
}
