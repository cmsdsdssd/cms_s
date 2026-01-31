import { getSchemaClient, assertSupabaseConfig } from "@/lib/supabase/client";

export type ReadFilterOp = "eq" | "ilike";

export type ReadViewOptions = {
  filter?: {
    column: string;
    op?: ReadFilterOp;
    value: string | number | boolean | null;
  };
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
};

export async function readView<T>(viewName: string, limit = 50, options?: ReadViewOptions) {
  assertSupabaseConfig();
  const schema = getSchemaClient();
  if (!schema) {
    throw new Error("Supabase env is missing");
  }

  let query = schema.from(viewName).select("*").limit(limit);

  if (options?.filter) {
    const { column, op, value } = options.filter;
    if (op === "ilike") {
      query = query.ilike(column, String(value));
    } else {
      const eqQuery = query as unknown as {
        eq: (col: string, val: string | number | boolean | null) => typeof query;
      };
      query = eqQuery.eq(column, value);
    }
  }

  if (options?.orderBy?.column) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? false,
    });
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data as T[];
}
