import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const confirmParamsRaw = process.env.CMS_CONFIRM_PARAMS_JSON;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const db = supabase.schema("public");

async function testView() {
  const { data, error } = await db
    .from("cms_v_order_worklist")
    .select("*")
    .limit(1);
  if (error) throw error;
  console.log("A) view select ok", data?.length ?? 0);
}

async function testConfirm() {
  if (!confirmParamsRaw) {
    throw new Error("Missing CMS_CONFIRM_PARAMS_JSON");
  }
  const params = JSON.parse(confirmParamsRaw);
  const { data, error } = await db.rpc("cms_fn_confirm_shipment", params);
  if (error) throw error;
  console.log("B) confirm rpc ok", data);
}

await testView();
await testConfirm();
