import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSessionAndGuard } from "@/lib/supabase/auth-middleware";

const MOBILE_PATH_REDIRECTS: Record<string, string> = {
    "/shipments_main": "/m/shipments",
    "/shipments_history": "/m/shipments/history",
    "/catalog": "/m/catalog",
    "/ar/v2": "/m/receivables/ar",
    "/ap": "/m/receivables/ap",
    "/me": "/m/settings",
    "/settings": "/m/settings/advanced",
};

function shouldBypassMobileRedirect(pathname: string) {
    if (pathname.startsWith("/m")) return true;
    if (pathname.startsWith("/api")) return true;
    if (pathname.startsWith("/_next")) return true;
    if (pathname === "/login" || pathname === "/logout") return true;
    return false;
}

function detectMobile(req: NextRequest) {
    const forceCookie = req.cookies.get("cms_mobile_ui")?.value?.toLowerCase();
    if (forceCookie === "off") return false;
    if (forceCookie === "on") return true;

    const secUaMobile = req.headers.get("sec-ch-ua-mobile")?.toLowerCase() ?? "";
    if (secUaMobile.includes("?1")) return true;

    const viewportWidth = Number(req.headers.get("viewport-width") ?? "");
    if (Number.isFinite(viewportWidth) && viewportWidth > 0 && viewportWidth <= 1024) {
        return true;
    }

    const ua = req.headers.get("user-agent")?.toLowerCase() ?? "";
    return /(android|iphone|ipad|ipod|mobile)/.test(ua);
}

function mapMobilePath(pathname: string) {
    const exact = MOBILE_PATH_REDIRECTS[pathname];
    if (exact) return exact;

    if (pathname.startsWith("/shipments_main/")) {
        return pathname.replace("/shipments_main", "/m/shipments");
    }
    if (pathname.startsWith("/shipments_history/")) {
        return pathname.replace("/shipments_history", "/m/shipments/history");
    }
    if (pathname.startsWith("/catalog/")) {
        return pathname.replace("/catalog", "/m/catalog");
    }
    if (pathname.startsWith("/ar/v2/")) {
        return pathname.replace("/ar/v2", "/m/receivables/ar");
    }
    if (pathname.startsWith("/ap/")) {
        return pathname.replace("/ap", "/m/receivables/ap");
    }
    if (pathname.startsWith("/me/")) {
        return pathname.replace("/me", "/m/settings");
    }
    if (pathname.startsWith("/settings/")) {
        return pathname.replace("/settings", "/m/settings/advanced");
    }

    return null;
}

export async function middleware(req: NextRequest) {
    const authRes = await updateSessionAndGuard(req);
    if (authRes.status >= 300 && authRes.status < 400) {
        return authRes;
    }

    const pathname = req.nextUrl.pathname;
    if (shouldBypassMobileRedirect(pathname)) {
        return authRes;
    }

    if (!detectMobile(req)) {
        return authRes;
    }

    const mapped = mapMobilePath(pathname);
    if (!mapped) {
        return authRes;
    }

    const target = req.nextUrl.clone();
    target.pathname = mapped;
    const redirectRes = NextResponse.redirect(target);
    authRes.cookies.getAll().forEach((cookie) => {
        redirectRes.cookies.set(cookie);
    });
    return redirectRes;
}

/**
 * 정적 파일 제외(무한 리다이렉트/성능 문제 방지)
 */
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
