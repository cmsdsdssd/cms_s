import { getSchemaClient, assertSupabaseConfig } from "@/lib/supabase/client";

export async function readView<T>(viewName: string, limit = 50) {
  assertSupabaseConfig();
  const schema = getSchemaClient();
  if (!schema) {
    throw new Error("Supabase env is missing");
  }
  const { data, error } = await schema.from(viewName).select("*").limit(limit);
  if (error) {
    throw error;
  }
  return data as T[];
}
