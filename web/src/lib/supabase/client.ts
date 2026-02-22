import { createBrowserClient } from "@supabase/ssr";
import { CMS_SCHEMA } from "@/lib/contracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if (typeof window !== "undefined") console.log("SUPABASE anonKey len:", (supabaseAnonKey ?? "").length);

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey);
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
