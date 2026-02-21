"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/ssr";

function LoginPageContent() {
    const sp = useSearchParams();
    const next = sp.get("next") || "/dashboard";

    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!supabase) {
            toast.error("Supabase env missing");
            return;
        }

        setBusy(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data?.session) {
                toast.error(error?.message ?? "Login failed");
                return;
            }

            // 쿠키 세션 인지를 위해 full reload 권장
            window.location.assign(next);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-[100vh] grid place-items-center p-6">
            <Card className="w-full max-w-[420px]">
                <CardHeader title="로그인" description="내부 업무툴 접근을 위해 로그인하세요." />
                <CardBody>
                    <form onSubmit={onSubmit} className="grid gap-3">
                        <Input
                            placeholder="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                        <Input
                            placeholder="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                        <Button type="submit" disabled={busy}>
                            {busy ? "로그인 중..." : "로그인"}
                        </Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100vh] grid place-items-center p-6 text-sm text-[var(--muted)]">로딩 중...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
