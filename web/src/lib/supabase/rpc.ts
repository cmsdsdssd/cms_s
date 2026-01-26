import { getSchemaClient, assertSupabaseConfig } from "@/lib/supabase/client";

export async function callRpc<T>(fn: string, params: Record<string, unknown>) {
  assertSupabaseConfig();
  const schema = getSchemaClient();
  if (!schema) {
    throw new Error("Supabase env is missing");
  }
  const rpc = schema.rpc as unknown as (
    fn: string,
    params?: Record<string, unknown>
  ) => Promise<{ data: T | null; error: unknown }>;
  const { data, error } = await rpc(fn, params);
  if (error) {
    throw error;
  }
  return data as T;
}
