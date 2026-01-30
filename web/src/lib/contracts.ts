export const CMS_SCHEMA = "public";

export const CONTRACTS = {
  views: {
    ordersWorklist: "cms_v_order_worklist",

    arBalanceByParty: "cms_v_ar_balance_by_party",
    arPositionByParty: "cms_v_ar_position_by_party",
    masterItems: "cms_master_item",
    arClientSummary: "v_cms_ar_client_summary",
    masterItemLookup: "v_cms_master_item_lookup",
    stoneCatalog: "v_cms_stone_catalog",
    platingColor: "v_cms_plating_color",
    orderLookup: "v_cms_order_lookup",
    shipmentPrefill: "v_cms_shipment_prefill",
    marketLatestGoldSilverOps: "cms_v_market_tick_latest_gold_silver_ops_v1",
    marketSeries: "cms_v_market_tick_series_v1",
    marketDailyOhlc: "cms_v_market_tick_daily_ohlc_v1",
    marketHealth: "cms_v_market_tick_health_v1",
    marketRoleActive: "cms_v_market_symbol_role_v1",
    inventoryPositionByItemLabel: "cms_v_inventory_position_by_item_label_v1",
    inventoryPositionByMaster: "cms_v_inventory_position_by_master_item_v1",
    inventoryPositionByMasterLocation: "cms_v_inventory_position_by_master_item_location_v1",
    inventoryLocationSummary: "cms_v_inventory_location_summary_v1",
    inventoryMoveWorklist: "cms_v_inventory_move_worklist_v1",
    inventoryMoveLinesEnriched: "cms_v_inventory_move_lines_enriched_v1",
    inventoryCountSessions: "cms_v_inventory_count_sessions_v1",
    inventoryCountLinesEnriched: "cms_v_inventory_count_lines_enriched_v1",
    inventoryStocktakeVariance: "cms_v_inventory_stocktake_variance_v1",
    partMasterWithPosition: "cms_v_part_master_with_position_v1",
    partMoveLines: "cms_v_part_move_lines_v1",
    partUnlinkedWorklist: "cms_v_part_unlinked_worklist_v1",
    partUsageDaily: "cms_v_part_usage_daily_v1",
    bomRecipeWorklist: "cms_v_bom_recipe_worklist_v1",
    bomRecipeLinesEnriched: "cms_v_bom_recipe_lines_enriched_v1",
  },
  functions: {
    partyUpsert: process.env.NEXT_PUBLIC_CMS_FN_PARTY_UPSERT ?? "",
    orderUpsert: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT ?? "",
    orderUpsertV2: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT_V2 ?? "",
    orderUpsertV3: "cms_fn_upsert_order_line_v3",
    orderSetStatus: process.env.NEXT_PUBLIC_CMS_FN_ORDER_SET_STATUS ?? "",
    shipmentCreateFromOrders: process.env.NEXT_PUBLIC_CMS_FN_CREATE_SHIPMENTS_FROM_ORDERS ?? "",

    shipmentCreateHeader: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_CREATE_HEADER ?? "",
    shipmentAddFromOrder: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_FROM_ORDER ?? "",

    shipmentAddAdHoc: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_ADHOC ?? "",
    shipmentUpdateLine: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_UPDATE_LINE ?? "",

    // ✅ FIX: 실제 존재하는 RPC로 교체
    shipmentUpsertFromOrder:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_UPSERT_FROM_ORDER ||
      "cms_fn_shipment_upsert_from_order_line",

    shipmentConfirm:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_CONFIRM || "cms_fn_confirm_shipment_v3_cost_v1",
    applyPurchaseCost:
      process.env.NEXT_PUBLIC_RPC_APPLY_PURCHASE_COST || "cms_fn_apply_purchase_cost_to_shipment_v1",

    recordPayment: process.env.NEXT_PUBLIC_CMS_FN_RECORD_PAYMENT ?? "",
    recordReturn:
      process.env.NEXT_PUBLIC_CMS_FN_RECORD_RETURN_V2 ??
      process.env.NEXT_PUBLIC_CMS_FN_RECORD_RETURN ??
      "",
    enumValues: process.env.NEXT_PUBLIC_CMS_FN_ENUM_VALUES ?? "cms_fn_enum_values_v1",
    marketTickUpsertByRole:
      process.env.NEXT_PUBLIC_CMS_FN_MARKET_TICK_UPSERT_BY_ROLE ??
      "cms_fn_upsert_market_tick_by_role_v1",

    // ✅ Settings(시세 파이프라인 설정) 저장용 RPC
    marketTickConfigUpsert: "cms_fn_upsert_market_tick_config_v1",

    quickInventoryMove: "cms_fn_quick_inventory_move_v2",

    inventoryTransfer: "cms_fn_transfer_inventory_v1",
    inventoryMoveHeaderUpsert: "cms_fn_upsert_inventory_move_header_v1",
    inventoryMoveLineUpsert: "cms_fn_upsert_inventory_move_line_v1",
    inventoryMoveLineAdd: "cms_fn_add_inventory_move_line_v1",
    inventoryMovePost: "cms_fn_post_inventory_move_v1",
    inventoryMoveVoid: "cms_fn_void_inventory_move_v1",
    inventoryCountSessionCreate: "cms_fn_create_inventory_count_session_v1",
    inventoryCountLineAdd: "cms_fn_add_inventory_count_line_v1",
    inventoryCountLineUpsert: "cms_fn_upsert_inventory_count_line_v1",
    inventoryCountLineVoid: "cms_fn_void_inventory_count_line_v1",
    inventoryCountSessionFinalize: "cms_fn_finalize_inventory_count_session_v1",
    inventoryCountSessionVoid: "cms_fn_void_inventory_count_session_v1",
    partItemUpsert: "cms_fn_upsert_part_item_v1",
    partAliasAdd: "cms_fn_add_part_alias_v1",
    partReceiptRecord: "cms_fn_record_part_receipt_v1",
    partUsageRecord: "cms_fn_record_part_usage_v1",
    bomRecipeUpsert: "cms_fn_upsert_bom_recipe_v1",
    bomRecipeLineAdd: "cms_fn_add_bom_recipe_line_v1",
    bomRecipeLineVoid: "cms_fn_void_bom_recipe_line_v1",
  },
};

export function isFnConfigured(fnName: string) {
  return Boolean(fnName);
}
