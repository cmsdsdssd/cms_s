import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function isSuccessPayload(payload: Record<string, unknown>): boolean {
  if (typeof payload.success === "boolean") return payload.success;
  const status = String(payload.sendStatus ?? payload.result ?? "").toLowerCase();
  return ["success", "succeeded", "ok", "complete", "completed", "done"].includes(status);
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ code: "500", desc: "Supabase env missing" }, { status: 500 });
  }

  const secret = process.env.API_PLEX_WEBHOOK_SECRET ?? "";
  if (secret) {
    const headerSecret = request.headers.get("x-apiplex-secret") ?? request.headers.get("x-webhook-secret");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");
    if (headerSecret !== secret && querySecret !== secret) {
      return NextResponse.json({ code: "401", desc: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const jobId = String(payload.jobId ?? "");
  if (!jobId) {
    return NextResponse.json({ code: "400", desc: "Missing jobId" }, { status: 400 });
  }

  const success = isSuccessPayload(payload);
  const errorMessage = success ? null : String(payload.result ?? payload.sendStatus ?? "failed");

  await supabase.rpc("cms_fn_fax_log_update_by_provider_message_id_v1", {
    p_provider_message_id: jobId,
    p_response_meta: payload,
    p_success: success,
    p_error_message: errorMessage,
    p_provider: "apiplex",
    p_actor_person_id: null,
  });

  return NextResponse.json({ code: "100", desc: "Success" });
}
