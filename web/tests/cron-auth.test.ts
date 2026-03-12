import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

type CronSecretInputs = import("../src/lib/shop/cron-auth").CronSecretInputs;

const require = createRequire(import.meta.url);
const {
  isAuthorizedCronRequest,
} = require("../src/lib/shop/cron-auth.ts") as typeof import("../src/lib/shop/cron-auth");

test("isAuthorizedCronRequest accepts legacy x-shop-sync-secret header", () => {
  const request = new Request("https://example.com/api/cron/shop-sync-v2", {
    headers: {
      "x-shop-sync-secret": "legacy-secret",
    },
  });

  const result = isAuthorizedCronRequest(request, {}, {
    shopSyncCronSecret: "legacy-secret",
  });

  assert.equal(result, true);
});

test("isAuthorizedCronRequest accepts Vercel Authorization bearer secret", () => {
  const request = new Request("https://example.com/api/cron/shop-sync-v2", {
    headers: {
      authorization: "Bearer vercel-secret",
    },
  });

  const result = isAuthorizedCronRequest(request, {}, {
    cronSecret: "vercel-secret",
  } satisfies CronSecretInputs);

  assert.equal(result, true);
});

test("isAuthorizedCronRequest rejects mismatched secret", () => {
  const request = new Request("https://example.com/api/cron/shop-sync-v2?secret=wrong-secret");

  const result = isAuthorizedCronRequest(request, {}, {
    shopSyncCronSecret: "expected-secret",
  });

  assert.equal(result, false);
});
