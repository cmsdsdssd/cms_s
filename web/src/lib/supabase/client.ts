import { createClient } from "@supabase/supabase-js";
import { MS_SCHEMA } from "@/lib/contracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function getSchemaClient() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const schemaFn = supabase.schema as unknown as (schema: string) => typeof supabase;
  return schemaFn(MS_SCHEMA);
}

export function assertSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env is missing");
  }
}
