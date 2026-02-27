import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClientForMiddleware } from "@/lib/supabase/ssr";

const PUBLIC_PATHS = ["/login"]; // 로그인 페이지는 항상 통과
const PUBLIC_API_PREFIXES = [
    "/api/fax-webhook", // 외부 콜백(팩스) - 기존 secret 검증 유지
    "/api/shop-oauth/cafe24/callback", // Cafe24 OAuth redirect callback
    "/api/cron/shop-sync", // Cloud Scheduler secured endpoint (x-shop-sync-secret)
];

function isPublicPath(pathname: string) {
    return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublicApi(pathname: string) {
    return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function updateSessionAndGuard(req: NextRequest) {
    // 정적 리소스는 matcher에서 제외되지만, 2중 방어
    const pathname = req.nextUrl.pathname;

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }
    if (pathname.startsWith("/api") && isPublicApi(pathname)) {
        return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createSupabaseServerClientForMiddleware(req, res);

    // Supabase env 없으면 "잠금"이 목적이므로 안전하게 로그인으로 보낸다
    if (!supabase) {
        if (pathname.startsWith("/api")) {
            return NextResponse.json({ error: "UNAUTHORIZED", message: "Supabase env missing" }, { status: 401 });
        }
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("next", pathname + (req.nextUrl.search || ""));
        return NextResponse.redirect(loginUrl);
    }

    // 쿠키 세션 확인 (가벼운 claims 기반)
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    // 로그인 안 됨 → 페이지는 /login, API는 401
    if (!user || error) {
        if (pathname.startsWith("/api")) {
            return NextResponse.json({ error: "UNAUTHORIZED", message: "Login required" }, { status: 401 });
        }
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("next", pathname + (req.nextUrl.search || ""));
        return NextResponse.redirect(loginUrl);
    }

    // 로그인 OK
    return res;
}
