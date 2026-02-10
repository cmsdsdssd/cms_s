import type { NextRequest } from "next/server";
import { updateSessionAndGuard } from "@/lib/supabase/auth-middleware";

export async function middleware(req: NextRequest) {
    return updateSessionAndGuard(req);
}

/**
 * 정적 파일 제외(무한 리다이렉트/성능 문제 방지)
 */
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
