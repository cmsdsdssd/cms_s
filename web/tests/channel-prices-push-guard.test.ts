import test from "node:test";
import assert from "node:assert/strict";

test("channel-prices/push rejects direct external requests", async () => {
  const { POST } = await import("../src/app/api/channel-prices/push/route.ts");
  const response = await POST(new Request("https://example.com/api/channel-prices/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_id: "channel", publish_version: "pub" }),
  }));

  assert.equal(response.status, 403);
  const json = await response.json();
  assert.equal(json.error, "channel-prices/push is internal-only; use price-sync-runs-v2 execute flow");
});

test("channel-prices/push allows execute-route internal requests past the guard", async () => {
  const { POST } = await import("../src/app/api/channel-prices/push/route.ts");
  const response = await POST(new Request("https://internal.local/api/channel-prices/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }));

  assert.notEqual(response.status, 403);
});
