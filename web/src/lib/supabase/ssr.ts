import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

function getSbUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}
function getSbKey() {
    return (
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        ""
    );
}

/**
 * Middleware 전용: request/response cookies 브릿지 포함
 */
export function createSupabaseServerClientForMiddleware(req: NextRequest, res: NextResponse) {
    const url = getSbUrl();
    const key = getSbKey();
    if (!url || !key) return null;

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
                cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
            },
        },
    });
}

/**
 * Client(브라우저)에서 로그인/로그아웃에만 사용할 용도
 * - 이번 단계에서는 기존 getSchemaClient는 건드리지 않음
 */
export function createSupabaseBrowserClient() {
    const { createBrowserClient } = require("@supabase/ssr");
    const url = getSbUrl();
    const key = getSbKey();
    if (!url || !key) return null;
    return createBrowserClient(url, key);
}
