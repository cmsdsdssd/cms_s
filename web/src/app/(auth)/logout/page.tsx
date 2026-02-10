"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/ssr";

export default function LogoutPage() {
    useEffect(() => {
        const sb = createSupabaseBrowserClient();
        (async () => {
            if (sb) await sb.auth.signOut();
            window.location.assign("/login");
        })();
    }, []);
    return null;
}
