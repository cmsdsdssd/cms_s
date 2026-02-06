import { CMS_SCHEMA } from "@/lib/contracts";
import { assertSupabaseConfig, getSchemaClient } from "@/lib/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function callRpc<T>(fn: string, params: Record<string, unknown>) {
  assertSupabaseConfig();

  // 1) ✅ 우선 supabase-js로 호출 (로그인 후 access_token 자동 반영)
  const schemaClient = getSchemaClient();
  if (schemaClient) {
    const { data, error } = await schemaClient.rpc(fn as never, params as never);
    if (error) throw error;
    return data as T;
  }

  // 2) ✅ fallback: 기존과 완전히 동일한 anon fetch 방식
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
    const details = typeof errorPayload === "string" ? errorPayload : JSON.stringify(errorPayload);
    throw new Error(`RPC ${fn} failed (${res.status}) | ${details}`);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
