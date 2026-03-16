import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "lib", "supabase", "auth-middleware.ts"), "utf8");

test("auth middleware treats storefront breakdown script route as public", () => {
  assert.equal(source.includes('/api/public/storefront-option-breakdown-script'), true);
});
