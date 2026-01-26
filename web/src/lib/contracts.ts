export const MS_SCHEMA = "ms_s";

export const CONTRACTS = {
  views: {
    shipmentsReady: "v_staff_ship_ready_customer_live",
    salesOrderList: "v_staff_sales_order_list_v1",
  },
  functions: {
    confirmShipmentLine: "fn_confirm_shipment_line",
    confirmShipmentLineLive: "fn_confirm_shipment_line_live",
    partyUpsert: process.env.NEXT_PUBLIC_MS_FN_PARTY_UPSERT ?? "",
    orderUpsert: process.env.NEXT_PUBLIC_MS_FN_ORDER_UPSERT ?? "",
    repairUpsert: process.env.NEXT_PUBLIC_MS_FN_REPAIR_UPSERT ?? "",
  },
};

export const CONFIRM_USE_LIVE = process.env.NEXT_PUBLIC_MS_CONFIRM_LIVE === "1";

export function isFnConfigured(fnName: string) {
  return Boolean(fnName);
}
