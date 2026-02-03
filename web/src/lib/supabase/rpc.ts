import { CMS_SCHEMA } from "@/lib/contracts";
import { assertSupabaseConfig } from "@/lib/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function callRpc<T>(fn: string, params: Record<string, unknown>) {
  assertSupabaseConfig();
  const url = `${supabaseUrl}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      "Accept-Profile": CMS_SCHEMA,
      "Content-Profile": CMS_SCHEMA,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let errorPayload: unknown = null;
    try {
      errorPayload = await res.json();
    } catch {
      errorPayload = await res.text();
    }
    const details =
      typeof errorPayload === "string"
        ? errorPayload
        : JSON.stringify(errorPayload);
    throw new Error(`RPC ${fn} failed (${res.status}) | ${details}`);
  }

  return (await res.json()) as T;
}
