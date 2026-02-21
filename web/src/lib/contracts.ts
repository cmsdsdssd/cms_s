export const CMS_SCHEMA = "public";

export const CONTRACTS = {
  views: {
    ordersWorklist: "cms_v_order_worklist",

    arBalanceByParty: "cms_v_ar_balance_by_party",
    arPositionByParty: "cms_v_ar_position_by_party_v2",
    arInvoicePosition: "cms_v_ar_invoice_position_v1",
    arPaymentAllocDetail: "cms_v_ar_payment_alloc_detail_v1",
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
    inventoryLocationMaster: "cms_location",
    inventoryLocationBins: "cms_location_bin",
    inventoryMoveWorklist: "cms_v_inventory_move_worklist_v1",
    inventoryMoveLinesEnriched: "cms_v_inventory_move_lines_enriched_v1",
    inventoryCountSessions: "cms_v_inventory_count_sessions_v1",
    inventoryCountLinesEnriched: "cms_v_inventory_count_lines_enriched_v1",
    inventoryStocktakeVariance: "cms_v_inventory_stocktake_variance_v1",
    inventoryHealthSummary: "cms_v_inventory_health_summary_v1",
    inventoryHealthIssues: "cms_v_inventory_health_issues_v1",
    partMasterWithPosition: "cms_v_part_master_with_position_v1",
    partMoveLines: "cms_v_part_move_lines_v1",
    partUnlinkedWorklist: "cms_v_part_unlinked_worklist_v1",
    partUsageDaily: "cms_v_part_usage_daily_v1",
    bomRecipeWorklist: "cms_v_bom_recipe_worklist_v1",
    bomRecipeLinesEnriched: "cms_v_bom_recipe_lines_enriched_v1",

    // ✅ 원가 작업대 / 영수증 인박스
    purchaseCostWorklist: "cms_v_purchase_cost_worklist_v1",
    receiptInboxOpen: "cms_v_receipt_inbox_open_v1",
    receiptLineItemsFlat: "cms_v_receipt_line_items_flat_v1",
    receiptLineUnlinked: "cms_v_receipt_line_unlinked_v1",
    receiptLineLinkIntegrity: "cms_v_receipt_line_link_integrity_v1",
    receiptLineReconcile: "cms_v_receipt_line_reconcile_v1",
    // ✅ Repairs
    repairLineEnriched: "cms_v_repair_line_enriched_v1",
    // NOTE: allow env override to match DB object names without code changes
    repairWorkbench:
      process.env.NEXT_PUBLIC_CMS_VIEW_REPAIR_WORKBENCH || "cms_v_repair_workbench_v1",
    shipmentCostApplyCandidates: "cms_v_shipment_cost_apply_candidates_v1",

    // ✅ AP (미지급) Views
    apPositionByVendor: "cms_v_ap_position_by_vendor_v1",
    apInvoicePosition: "cms_v_ap_invoice_position_v1",
    apPaymentUnallocated: "cms_v_ap_payment_unallocated_v1",
    apPaymentAllocDetail: "cms_v_ap_payment_alloc_detail_v1",
    apReconcileOpenByVendor: "cms_v_ap_reconcile_open_by_vendor_v1",
    apReconcileIssueList: "cms_v_ap_reconcile_issue_list_v1",
    // ✅ AP Named Views (includes vendor_name, region, is_active)
    apPositionByVendorNamed: "cms_v_ap_position_by_vendor_named_v1",
    apReconcileOpenByVendorNamed: "cms_v_ap_reconcile_open_by_vendor_named_v1",
    apReconcileIssueListNamed: "cms_v_ap_reconcile_issue_list_named_v1",
    apFactoryLatestReceiptByVendor: "cms_v_ap_factory_latest_receipt_by_vendor_v1",
    apFactoryPostBalanceByVendor: "cms_v_ap_factory_post_balance_by_vendor_v1",
    apFactoryRecentPaymentByVendor: "cms_v_ap_factory_recent_payment_by_vendor_v1",
    apPaymentHistoryByVendor: "cms_v_ap_payment_history_by_vendor_v1",
    apBalanceByVendor: "cms_v_ap_balance_by_vendor_v1",

    // ✅ Factory Purchase Order (공장발주) Views
    unshippedOrderLines: "cms_v_unshipped_order_lines",
    factoryPoSummary: "cms_v_factory_po_summary",
  },
  functions: {
    partyUpsert: process.env.NEXT_PUBLIC_CMS_FN_PARTY_UPSERT ?? "",
    upsertVendorPrefix: "cms_fn_upsert_vendor_prefix",
    orderUpsert: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT ?? "",
    orderUpsertV2: process.env.NEXT_PUBLIC_CMS_FN_ORDER_UPSERT_V2 ?? "",
    orderUpsertV3: "cms_fn_upsert_order_line_v3",
    orderSetStatus: process.env.NEXT_PUBLIC_CMS_FN_ORDER_SET_STATUS ?? "",
    shipmentCreateFromOrders: process.env.NEXT_PUBLIC_CMS_FN_CREATE_SHIPMENTS_FROM_ORDERS ?? "",

    shipmentCreateHeader: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_CREATE_HEADER ?? "",
    shipmentAddFromOrder: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_FROM_ORDER ?? "",

    shipmentAddAdHoc: process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_ADD_ADHOC ?? "",
    shipmentUpdateLine:
      process.env.NEXT_PUBLIC_CMS_FN_SHIPMENT_UPDATE_LINE ?? "cms_fn_shipment_update_line_v1",

    // ✅ FIX: 실제 존재하는 RPC로 교체
    shipmentUpsertFromOrder: "cms_fn_shipment_upsert_from_order_line_v2",

    shipmentConfirm:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_CONFIRM || "cms_fn_confirm_shipment_v3_cost_v1",
    shipmentConfirmV3Cost: "cms_fn_confirm_shipment_v3_cost_v1",
    shipmentConfirmStorePickup: (() => {
      const confirm =
        process.env.NEXT_PUBLIC_RPC_SHIPMENT_CONFIRM || "cms_fn_confirm_shipment_v3_cost_v1";
      const envOverride = process.env.NEXT_PUBLIC_RPC_SHIPMENT_CONFIRM_STORE_PICKUP || "";
      if (envOverride && envOverride !== confirm) return envOverride;
      return "cms_fn_confirm_store_pickup_v1";
    })(),
    shipmentSetStorePickup:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_SET_STORE_PICKUP || "cms_fn_set_shipment_store_pickup_v1",
    shipmentSetSourceLocation:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_SET_SOURCE_LOCATION || "cms_fn_set_shipment_source_location_v1",
    shipmentClearShipDate:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_CLEAR_SHIP_DATE || "cms_fn_clear_shipment_ship_date_v1",
    shipmentUnconfirm:
      process.env.NEXT_PUBLIC_RPC_SHIPMENT_UNCONFIRM || "cms_fn_unconfirm_shipment_v1",
    applyPurchaseCost:
      process.env.NEXT_PUBLIC_RPC_APPLY_PURCHASE_COST || "cms_fn_apply_purchase_cost_to_shipment_v1",

    recordPayment:
      process.env.NEXT_PUBLIC_CMS_FN_RECORD_PAYMENT || "cms_fn_record_payment_v2",
    arApplyPaymentFifo:
      process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_PAYMENT_FIFO || "cms_fn_ar_apply_payment_fifo_v2",
    arApplyPaymentFifoAdvanced:
      process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_PAYMENT_FIFO_ADVANCED || "cms_fn_ar_apply_payment_fifo_v3",
    arInvoiceResyncFromShipment:
      process.env.NEXT_PUBLIC_RPC_AR_INVOICE_RESYNC || "cms_fn_ar_create_from_shipment_confirm_v1",
    recordReturn:
      process.env.NEXT_PUBLIC_CMS_FN_RECORD_RETURN_V2 ??
      process.env.NEXT_PUBLIC_CMS_FN_RECORD_RETURN ??
      "",
    // AR manual actions (NEW)
    arApplyOffsetFromUnallocatedCash:
      process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_OFFSET_FROM_UNALLOCATED_CASH ||
      "cms_fn_ar_apply_offset_from_unallocated_cash_v1",
    arApplyAdjustmentDownFifo:
      process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_ADJUSTMENT_DOWN_FIFO ||
      "cms_fn_ar_apply_adjustment_down_fifo_v1",
    arCreateAdjustmentUpInvoice:
      process.env.NEXT_PUBLIC_CMS_FN_AR_CREATE_ADJUSTMENT_UP_INVOICE ||
      "cms_fn_ar_create_adjustment_up_invoice_v1",
    arGetSettlementRecommendation:
      process.env.NEXT_PUBLIC_CMS_FN_AR_GET_SETTLEMENT_RECOMMENDATION ||
      "cms_fn_ar_get_settlement_recommendation_v1",
    arApplyServiceWriteoffUnderLimit:
      process.env.NEXT_PUBLIC_CMS_FN_AR_APPLY_SERVICE_WRITEOFF_UNDER_LIMIT ||
      "cms_fn_ar_apply_service_writeoff_under_limit_v1",


    enumValues: process.env.NEXT_PUBLIC_CMS_FN_ENUM_VALUES ?? "cms_fn_enum_values_v1",
    marketTickUpsertByRole:
      process.env.NEXT_PUBLIC_CMS_FN_MARKET_TICK_UPSERT_BY_ROLE ??
      "cms_fn_upsert_market_tick_by_role_v1",

    setMasterUnitPricing: "cms_fn_set_master_item_unit_pricing_v1",
    setRuleRoundingUnit: "cms_fn_set_rule_rounding_unit_v1",

    // ✅ Settings(시세 파이프라인 설정) 저장용 RPC
    marketTickConfigUpsert: "cms_fn_upsert_market_tick_config_v1",
    materialFactorConfigUpsert: "cms_fn_upsert_material_factor_config_v2",
    materialFactorConfigList: "cms_fn_list_material_factor_config_v1",
    vendorFaxConfigUpsert: "cms_fn_vendor_fax_config_upsert_v1",

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

    // ✅ Factory Purchase Order (공장발주) RPCs
    factoryPoCreate: "cms_fn_factory_po_create_from_order_lines",
    factoryPoMarkSent: "cms_fn_factory_po_mark_sent",
    factoryPoGetDetails: "cms_fn_factory_po_get_details",
    factoryPoCancel: "cms_fn_factory_po_cancel",
    receiptAttachToOrderLines: "cms_fn_receipt_attach_to_order_lines",
    markShipped: "cms_fn_mark_shipped",
    // ✅ Repairs (v2 is additive; keep v1 for backward compatibility)
    repairCreate: "cms_fn_create_repair_v1",
    repairCreateV2:
      process.env.NEXT_PUBLIC_CMS_FN_REPAIR_CREATE_V2 || "cms_fn_create_repair_v2",
    repairUpdateV2: "cms_fn_update_repair_line_v2",
    repairSetStatus: "cms_fn_set_repair_status_v1",
    repairSetStatusV2:
      process.env.NEXT_PUBLIC_CMS_FN_REPAIR_SET_STATUS_V2 || "cms_fn_set_repair_status_v2",
    repairSendToShipment: "cms_fn_send_repair_to_shipment_v1",
    repairSendToShipmentV2:
      process.env.NEXT_PUBLIC_CMS_FN_REPAIR_SEND_TO_SHIPMENT_V2 ||
      "cms_fn_send_repair_to_shipment_v2",
    vendorBillCreate: "cms_fn_create_vendor_bill_v1",
    vendorBillApply: "cms_fn_apply_vendor_bill_to_shipments_v1",
    receiptUsageUpsert: "cms_fn_upsert_receipt_usage_alloc_v1",
    ensureApFromReceipt: "cms_fn_ensure_ap_from_receipt_v1",
    receiptPricingSnapshotUpsertV2: "cms_fn_upsert_receipt_pricing_snapshot_v2",
    receiptLineMatchSuggest: "cms_fn_receipt_line_match_suggest_v1",
    receiptLineMatchConfirm:
      process.env.NEXT_PUBLIC_CMS_FN_RECEIPT_MATCH_CONFIRM ||
      process.env.NEXT_PUBLIC_CMS_FN_RECEIPT_LINE_MATCH_CONFIRM ||
      "cms_fn_receipt_line_match_confirm_v6_policy_v2",
    receiptLineDeleteV1: "cms_fn_receipt_line_delete_v1",

    // ✅ AP (미지급) RPCs
    factoryReceiptStatementUpsert:
      process.env.NEXT_PUBLIC_CMS_FN_FACTORY_RECEIPT_STATEMENT_UPSERT ||
      "cms_fn_upsert_factory_receipt_statement_v2",
    factoryReceiptSetApplyStatus:
      process.env.NEXT_PUBLIC_CMS_FN_FACTORY_RECEIPT_SET_APPLY_STATUS ||
      "cms_fn_factory_receipt_set_apply_status_v1",
    apPayAndFifo:
      process.env.NEXT_PUBLIC_CMS_FN_AP_PAY_AND_FIFO || "cms_fn_ap2_pay_and_fifo_guarded_v1",
    apManualAlloc: "cms_fn_ap2_manual_alloc_v1",
    apReconcileSetIssueStatus: "cms_fn_ap_set_reconcile_issue_status_v2",
    apReconcileCreateAdjustment: "cms_fn_ap_create_adjustment_from_issue_v1",
  },
};

export function isFnConfigured(fnName: string) {
  return Boolean(fnName);
}
