import { jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const message = "Deprecated legacy shopping runtime surface. Use the Rule-only SOT mappings/publish flow instead.";
const detail = {
  code: "RULE_ONLY_SOT_DEPRECATED_SURFACE",
  contract: "web/docs/plans/2026-03-14-shopping-rule-only-sot-final-contract.md",
};

export async function GET() {
  return jsonError(message, 410, detail);
}

export async function POST() {
  return jsonError(message, 410, detail);
}
