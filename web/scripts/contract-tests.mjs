import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const confirmParamsRaw = process.env.MS_CONFIRM_PARAMS_JSON;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const db = supabase.schema("ms_s");

async function testView() {
  const { data, error } = await db
    .from("v_staff_ship_ready_customer_live")
    .select("*")
    .limit(1);
  if (error) throw error;
  console.log("A) view select ok", data?.length ?? 0);
}

async function testConfirm() {
  if (!confirmParamsRaw) {
    throw new Error("Missing MS_CONFIRM_PARAMS_JSON");
  }
  const params = JSON.parse(confirmParamsRaw);
  const { data, error } = await db.rpc("fn_confirm_shipment_line", params);
  if (error) throw error;
  console.log("B) confirm rpc ok", data);
}

await testView();
await testConfirm();
