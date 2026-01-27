export const CMS_SCHEMA = "public";

export const CONTRACTS = {
  views: {
    ordersWorklist: "cms_v_order_worklist",
    repairsEnriched: "cms_v_repair_line_enriched_v1",
    arBalanceByParty: "cms_v_ar_balance_by_party",
    arPositionByParty: "cms_v_ar_position_by_party",
    masterItems: "cms_master_item",
  },
  functions: {
    partyUpsert: process.env.NEXT_PUBLIC_CMS_FN_PARTY_UPSERT ?? "",
    orderUpsert: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT ?? "",
    orderUpsertV2: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT_V2 ?? "",
    orderSetStatus: process.env.NEXT_PUBLIC_CMS_FN_ORDER_SET_STATUS ?? "",
    shipmentCreateFromOrders:
      process.env.NEXT_PUBLIC_CMS_FN_CREATE_SHIPMENTS_FROM_ORDERS ?? "",
    repairUpsert: process.env.NEXT_PUBLIC_CMS_FN_REPAIR_UPSERT ?? "",
    shipmentCreateHeader: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_CREATE_HEADER ?? "",
    shipmentAddFromOrder: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_FROM_ORDER ?? "",
    shipmentAddFromRepair: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_FROM_REPAIR ?? "",
    shipmentAddAdHoc: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_ADHOC ?? "",
    shipmentUpdateLine: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_UPDATE_LINE ?? "",
    shipmentDeleteLine: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_DELETE_LINE ?? "",
    shipmentConfirm: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_CONFIRM ?? "",
    recordPayment: process.env.NEXT_PUBLIC_CMS_FN_RECORD_PAYMENT ?? "",
    recordReturn: process.env.NEXT_PUBLIC_CMS_FN_RECORD_RETURN ?? "",
    enumValues: process.env.NEXT_PUBLIC_CMS_FN_ENUM_VALUES ?? "cms_fn_enum_values_v1",
  },
};

export function isFnConfigured(fnName: string) {
  return Boolean(fnName);
}
