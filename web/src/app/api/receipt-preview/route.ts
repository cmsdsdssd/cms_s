import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const LEGACY_BUCKET_ALLOWLIST = new Set(["ocr_docs", "receipts", "factory-orders"]);
const LEGACY_PATH_PREFIX = /^(?:\d{8}\/|receipts\/|factory-orders\/)/;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getSupabaseSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // noop in route handlers where cookies are readonly
        }
      },
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get("receipt_id");
  const bucket = searchParams.get("bucket");
  const path = searchParams.get("path");
  const mode = (searchParams.get("mode") ?? "redirect").toLowerCase();

  const supabase = getSupabaseAdmin();
  const session = await getSupabaseSession();
  if (!supabase || !session) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  const { data: authData, error: authError } = await session.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let resolvedBucket: string | null = null;
  let resolvedPath: string | null = null;

  if (receiptId) {
    const { data: receiptMeta, error: receiptMetaError } = await supabase
      .from("cms_receipt_inbox")
      .select("file_bucket, file_path")
      .eq("receipt_id", receiptId)
      .maybeSingle();

    if (receiptMetaError) {
      return NextResponse.json({ error: "failed to resolve receipt" }, { status: 500 });
    }
    if (!receiptMeta) {
      return NextResponse.json({ error: "receipt not found" }, { status: 404 });
    }

    resolvedBucket = receiptMeta.file_bucket;
    resolvedPath = receiptMeta.file_path;
  } else {
    if (!bucket || !path) {
      return NextResponse.json({ error: "receipt_id or (bucket and path) required" }, { status: 400 });
    }

    if (!LEGACY_BUCKET_ALLOWLIST.has(bucket) || !LEGACY_PATH_PREFIX.test(path)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { data: legacyMatch, error: legacyError } = await supabase
      .from("cms_receipt_inbox")
      .select("receipt_id, file_bucket, file_path")
      .eq("file_bucket", bucket)
      .eq("file_path", path)
      .maybeSingle();

    if (legacyError || !legacyMatch) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    resolvedBucket = legacyMatch.file_bucket;
    resolvedPath = legacyMatch.file_path;
  }

  if (!resolvedBucket || !resolvedPath) {
    return NextResponse.json({ error: "invalid resolved file" }, { status: 500 });
  }

  const { data, error } = await supabase.storage
    .from(resolvedBucket)
    .createSignedUrl(resolvedPath, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "failed to create preview url" }, { status: 500 });
  }

  if (mode === "url") {
    return NextResponse.json({ signedUrl: data.signedUrl });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
