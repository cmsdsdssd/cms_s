import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { rebuildAffectedSizeGridsForSourceChange } from "@/lib/shop/persisted-size-grid-rebuild.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseMaterialCodes = (value: unknown): string[] | null | Response => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return jsonError("material_codes must be an array", 400);
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => ({}));
  const body = parseJsonObject(raw) ?? {};
  const materialCodes = parseMaterialCodes(body.material_codes);
  if (materialCodes instanceof Response) return materialCodes;

  try {
    const result = await rebuildAffectedSizeGridsForSourceChange({
      sb,
      materialCodes,
    });

    return NextResponse.json(
      {
        ok: true,
        scope_count: result.scopes.length,
        rebuilt_count: result.rebuiltCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "size grid rebuild failed", 500);
  }
}
