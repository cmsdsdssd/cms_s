import { createClient } from "@supabase/supabase-js";
import { CMS_SCHEMA } from "@/lib/contracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (typeof window !== "undefined") console.log("SUPABASE anonKey len:", (supabaseAnonKey ?? "").length);

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    // ✅ supabase-js 기본 동작에 맡김:
    // - 로그인 전: anon으로 호출 (기존과 동일)
    // - 로그인 후: session access_token으로 호출 (의도한 동작)
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function getSchemaClient() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const schemaClient = (supabase as typeof supabase & { schema?: (schema: string) => typeof supabase }).schema;
  if (typeof schemaClient !== "function") {
    return supabase;
  }
  return schemaClient.call(supabase, CMS_SCHEMA);
}

export function assertSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env is missing");
  }
}
