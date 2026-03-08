import { default as recomputeRoute } from "../src/app/api/pricing/recompute/route.ts";
import { default as pushRoute } from "../src/app/api/channel-prices/push/route.ts";

const CHANNEL_ID = "9d7c22c7-8cf5-46e7-950b-59eced8b316e";
const MASTER_ITEM_ID = "4551f046-607f-4bf0-85db-9eafab542cd0";
const CHANNEL_PRODUCT_IDS = [
  "17eb8e02-1a72-4b91-8549-79d3d75a2ad5",
  "4bea5aff-3d26-40ad-8517-388dd59ae867",
  "79be3563-9a44-4693-8828-a9078f6aa81b",
  "005c1623-f0b7-46bc-8574-8ff44fbd232f",
  "7f1060c8-d0c4-4fc4-a62c-a46984beb991",
  "f9bfdc4f-87ee-4e55-96b5-48e2684367c1",
  "0083af63-a207-47d1-b408-fa4b7440804a",
] as const;

async function main() {
  const recomputeRequest = new Request("http://local/api/pricing/recompute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel_id: CHANNEL_ID,
      master_item_ids: [MASTER_ITEM_ID],
    }),
  });

  const recomputeResponse = await recomputeRoute.POST(recomputeRequest);
  const recomputeBody = await recomputeResponse.json();

  const computeRequestId = String(recomputeBody.compute_request_id ?? "").trim();

  const pushRequest = new Request("http://local/api/channel-prices/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel_id: CHANNEL_ID,
      channel_product_ids: CHANNEL_PRODUCT_IDS,
      compute_request_id: computeRequestId,
      run_type: "MANUAL",
      dry_run: true,
      sync_option_labels: true,
    }),
  });

  const pushResponse = await pushRoute.POST(pushRequest);
  const pushBody = await pushResponse.json();

  console.log(JSON.stringify({
    recompute_status: recomputeResponse.status,
    recompute: recomputeBody,
    push_status: pushResponse.status,
    push: pushBody,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
