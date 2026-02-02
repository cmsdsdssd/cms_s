-- Migration: Factory Purchase Order RPC Functions
-- Date: 2026-02-02

-- ============================================
-- RPC #1: Create Factory PO from Order Lines (with grouping)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_factory_po_create_from_order_lines(
    p_order_line_ids uuid[],
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_po_ids jsonb := '[]'::jsonb;
    v_order_line record;
    v_vendor_prefix text;
    v_vendor_party_id uuid;
    v_po_id uuid;
    v_prefix_group record;
    v_already_po_count int := 0;
    v_processed_count int := 0;
BEGIN
    -- Validate input
    IF p_order_line_ids IS NULL OR array_length(p_order_line_ids, 1) = 0 THEN
        raise exception 'No order line IDs provided';
    END IF;

    -- Group order lines by vendor_prefix
    FOR v_prefix_group IN 
        SELECT 
            ol.vendor_prefix,
            vp.vendor_party_id,
            array_agg(ol.order_line_id) as line_ids
        FROM cms_order_line ol
        LEFT JOIN cms_vendor_prefix_map vp ON ol.vendor_prefix = vp.prefix
        WHERE ol.order_line_id = ANY(p_order_line_ids)
          AND ol.status IN ('ORDER_PENDING', 'SENT_TO_VENDOR')  -- Only allow lines not yet fully shipped
          AND ol.factory_po_id IS NULL  -- Not already in a PO
          AND ol.vendor_prefix IS NOT NULL
        GROUP BY ol.vendor_prefix, vp.vendor_party_id
    LOOP
        v_vendor_prefix := v_prefix_group.vendor_prefix;
        v_vendor_party_id := v_prefix_group.vendor_party_id;

        -- Create PO for this prefix group
        INSERT INTO cms_factory_po (
            vendor_prefix,
            vendor_party_id,
            status,
            fax_number, -- Will be populated from vendor config later
            created_by
        )
        SELECT 
            v_vendor_prefix,
            v_vendor_party_id,
            'DRAFT',
            vc.fax_number,
            p_actor_person_id
        FROM cms_vendor_fax_config vc
        WHERE vc.vendor_party_id = v_vendor_party_id
          AND vc.is_active = true
        ON CONFLICT DO NOTHING
        RETURNING po_id INTO v_po_id;

        -- If no vendor config, create without fax number
        IF v_po_id IS NULL THEN
            INSERT INTO cms_factory_po (
                vendor_prefix,
                vendor_party_id,
                status,
                created_by
            )
            VALUES (
                v_vendor_prefix,
                v_vendor_party_id,
                'DRAFT',
                p_actor_person_id
            )
            RETURNING po_id INTO v_po_id;
        END IF;

        -- Link order lines to this PO
        INSERT INTO cms_factory_po_line (po_id, order_line_id)
        SELECT v_po_id, unnest(v_prefix_group.line_ids)
        ON CONFLICT DO NOTHING;

        -- Update order lines with factory_po_id reference
        UPDATE cms_order_line
        SET factory_po_id = v_po_id
        WHERE order_line_id = ANY(v_prefix_group.line_ids);

        -- Add to result
        v_po_ids := v_po_ids || jsonb_build_object(
            'po_id', v_po_id,
            'vendor_prefix', v_vendor_prefix,
            'vendor_party_id', v_vendor_party_id,
            'line_count', array_length(v_prefix_group.line_ids, 1)
        );

        v_processed_count := v_processed_count + array_length(v_prefix_group.line_ids, 1);
    END LOOP;

    -- Count order lines already in POs
    SELECT count(*) INTO v_already_po_count
    FROM cms_order_line
    WHERE order_line_id = ANY(p_order_line_ids)
      AND factory_po_id IS NOT NULL;

    RETURN jsonb_build_object(
        'ok', true,
        'po_count', jsonb_array_length(v_po_ids),
        'processed_lines', v_processed_count,
        'already_in_po_lines', v_already_po_count,
        'pos', v_po_ids
    );
END;
$$;

-- ============================================
-- RPC #2: Mark PO as Sent (after fax transmission)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_factory_po_mark_sent(
    p_po_id uuid,
    p_fax_result jsonb DEFAULT '{}'::jsonb,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_po record;
    v_fax_payload_url text;
    v_provider_message_id text;
    v_provider text;
    v_affected_lines int := 0;
    v_now timestamptz := now();
BEGIN
    -- Lock and get PO
    SELECT * INTO v_po
    FROM cms_factory_po
    WHERE po_id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        raise exception 'Factory PO not found: %', p_po_id;
    END IF;

    -- Check if already sent
    IF v_po.status = 'SENT_TO_VENDOR' THEN
        RETURN jsonb_build_object(
            'ok', true,
            'already_sent', true,
            'po_id', p_po_id,
            'sent_at', v_po.fax_sent_at
        );
    END IF;

    -- Extract fax result data
    v_fax_payload_url := p_fax_result->>'payload_url';
    v_provider_message_id := p_fax_result->>'provider_message_id';
    v_provider := COALESCE(p_fax_result->>'provider', v_po.fax_provider, 'mock');

    -- Update PO status
    UPDATE cms_factory_po
    SET 
        status = 'SENT_TO_VENDOR',
        fax_sent_at = v_now,
        fax_payload_url = COALESCE(v_fax_payload_url, fax_payload_url),
        fax_provider_message_id = v_provider_message_id,
        fax_provider = v_provider,
        updated_at = v_now
    WHERE po_id = p_po_id;

    -- Log fax transmission
    INSERT INTO cms_fax_log (
        po_id,
        provider,
        request_meta,
        response_meta,
        success,
        provider_message_id,
        created_by
    )
    VALUES (
        p_po_id,
        v_provider,
        p_fax_result->'request' ?? '{}'::jsonb,
        p_fax_result->'response' ?? '{}'::jsonb,
        COALESCE((p_fax_result->>'success')::boolean, true),
        v_provider_message_id,
        p_actor_person_id
    );

    -- Update linked order lines
    UPDATE cms_order_line ol
    SET 
        status = 'SENT_TO_VENDOR',
        sent_to_vendor_at = v_now,
        updated_at = v_now
    FROM cms_factory_po_line pol
    WHERE pol.po_id = p_po_id
      AND pol.order_line_id = ol.order_line_id
      AND ol.status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED');

    GET DIAGNOSTICS v_affected_lines = ROW_COUNT;

    -- Log decision
    INSERT INTO cms_decision_log (
        entity_type,
        entity_id,
        decision_kind,
        before,
        after,
        actor_person_id,
        note
    )
    VALUES (
        'FACTORY_PO',
        p_po_id,
        'MARK_SENT',
        jsonb_build_object('status', v_po.status),
        jsonb_build_object('status', 'SENT_TO_VENDOR', 'sent_at', v_now, 'provider', v_provider),
        p_actor_person_id,
        'Factory order sent via fax'
    );

    RETURN jsonb_build_object(
        'ok', true,
        'po_id', p_po_id,
        'sent_at', v_now,
        'affected_lines', v_affected_lines,
        'provider', v_provider
    );
END;
$$;

-- ============================================
-- RPC #3: Record Receipt and Update Order Line Status
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_receipt_attach_to_order_lines(
    p_receipt_id uuid,
    p_order_line_ids uuid[],
    p_receipt_created_at timestamptz DEFAULT now(),
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected_lines int := 0;
    v_already_shipped_count int := 0;
    v_now timestamptz := now();
BEGIN
    -- Count already shipped lines (these won't be updated)
    SELECT count(*) INTO v_already_shipped_count
    FROM cms_order_line
    WHERE order_line_id = ANY(p_order_line_ids)
      AND status = 'SHIPPED';

    -- Update order lines that are not yet shipped
    UPDATE cms_order_line
    SET 
        inbound_at = p_receipt_created_at,
        status = CASE 
            WHEN status IN ('SENT_TO_VENDOR', 'WAITING_INBOUND') THEN 'READY_TO_SHIP'
            ELSE status  -- Keep existing status if already READY_TO_SHIP or beyond
        END,
        updated_at = v_now
    WHERE order_line_id = ANY(p_order_line_ids)
      AND status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED');

    GET DIAGNOSTICS v_affected_lines = ROW_COUNT;

    -- Log status changes
    INSERT INTO cms_decision_log (
        entity_type,
        entity_id,
        decision_kind,
        before,
        after,
        actor_person_id,
        note
    )
    SELECT 
        'ORDER_LINE',
        order_line_id,
        'RECEIPT_ATTACH',
        jsonb_build_object('status', status, 'inbound_at', inbound_at),
        jsonb_build_object('status', 'READY_TO_SHIP', 'inbound_at', p_receipt_created_at, 'receipt_id', p_receipt_id),
        p_actor_person_id,
        'Receipt attached, inbound timestamp recorded'
    FROM cms_order_line
    WHERE order_line_id = ANY(p_order_line_ids)
      AND status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED');

    RETURN jsonb_build_object(
        'ok', true,
        'receipt_id', p_receipt_id,
        'affected_lines', v_affected_lines,
        'already_shipped_skipped', v_already_shipped_count,
        'inbound_at', p_receipt_created_at
    );
END;
$$;

-- ============================================
-- RPC #4: Mark Order Lines as Shipped
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_mark_shipped(
    p_order_line_ids uuid[],
    p_shipped_at timestamptz DEFAULT now(),
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected_lines int := 0;
BEGIN
    UPDATE cms_order_line
    SET 
        status = 'SHIPPED',
        shipped_at = p_shipped_at,
        updated_at = now()
    WHERE order_line_id = ANY(p_order_line_ids)
      AND status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED');

    GET DIAGNOSTICS v_affected_lines = ROW_COUNT;

    -- Log status changes
    INSERT INTO cms_decision_log (
        entity_type,
        entity_id,
        decision_kind,
        before,
        after,
        actor_person_id,
        note
    )
    SELECT 
        'ORDER_LINE',
        order_line_id,
        'MARK_SHIPPED',
        jsonb_build_object('status', status),
        jsonb_build_object('status', 'SHIPPED', 'shipped_at', p_shipped_at),
        p_actor_person_id,
        'Order line marked as shipped'
    FROM cms_order_line
    WHERE order_line_id = ANY(p_order_line_ids);

    RETURN jsonb_build_object(
        'ok', true,
        'shipped_at', p_shipped_at,
        'affected_lines', v_affected_lines
    );
END;
$$;

-- ============================================
-- RPC #5: Get PO Details for Preview
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_factory_po_get_details(
    p_po_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_po record;
    v_lines jsonb;
    v_vendor_config record;
BEGIN
    -- Get PO header
    SELECT * INTO v_po
    FROM cms_factory_po
    WHERE po_id = p_po_id;

    IF NOT FOUND THEN
        raise exception 'Factory PO not found: %', p_po_id;
    END IF;

    -- Get vendor config
    SELECT * INTO v_vendor_config
    FROM cms_vendor_fax_config
    WHERE vendor_party_id = v_po.vendor_party_id;

    -- Get order lines
    SELECT jsonb_agg(
        jsonb_build_object(
            'order_line_id', ol.order_line_id,
            'customer_party_id', ol.customer_party_id,
            'customer_name', p.name,
            'model_name', ol.model_name,
            'suffix', ol.suffix,
            'color', ol.color,
            'size', ol.size,
            'qty', ol.qty,
            'memo', ol.memo,
            'is_plated', ol.is_plated,
            'plating_color_code', ol.plating_color_code,
            'center_stone_name', ol.center_stone_name,
            'center_stone_qty', ol.center_stone_qty,
            'sub1_stone_name', ol.sub1_stone_name,
            'sub1_stone_qty', ol.sub1_stone_qty,
            'sub2_stone_name', ol.sub2_stone_name,
            'sub2_stone_qty', ol.sub2_stone_qty
        ) ORDER BY ol.created_at
    )
    INTO v_lines
    FROM cms_factory_po_line pol
    JOIN cms_order_line ol ON pol.order_line_id = ol.order_line_id
    LEFT JOIN cms_party p ON ol.customer_party_id = p.party_id
    WHERE pol.po_id = p_po_id;

    RETURN jsonb_build_object(
        'ok', true,
        'po_id', v_po.po_id,
        'vendor_prefix', v_po.vendor_prefix,
        'vendor_party_id', v_po.vendor_party_id,
        'status', v_po.status,
        'fax_number', COALESCE(v_vendor_config.fax_number, v_po.fax_number),
        'fax_provider', COALESCE(v_vendor_config.fax_provider, v_po.fax_provider),
        'sender_name', v_vendor_config.sender_name,
        'sender_phone', v_vendor_config.sender_phone,
        'sender_fax', v_vendor_config.sender_fax,
        'created_at', v_po.created_at,
        'sent_at', v_po.fax_sent_at,
        'lines', COALESCE(v_lines, '[]'::jsonb),
        'line_count', jsonb_array_length(COALESCE(v_lines, '[]'::jsonb)),
        'has_vendor_config', v_vendor_config IS NOT NULL,
        'can_send', COALESCE(v_vendor_config.fax_number, v_po.fax_number) IS NOT NULL
    );
END;
$$;

-- ============================================
-- RPC #6: Cancel Factory PO (revert order lines)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_factory_po_cancel(
    p_po_id uuid,
    p_reason text DEFAULT NULL,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_po record;
    v_affected_lines int := 0;
    v_now timestamptz := now();
BEGIN
    -- Lock and get PO
    SELECT * INTO v_po
    FROM cms_factory_po
    WHERE po_id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        raise exception 'Factory PO not found: %', p_po_id;
    END IF;

    -- Can only cancel if not already sent
    IF v_po.status = 'SENT_TO_VENDOR' THEN
        raise exception 'Cannot cancel PO that has already been sent to vendor';
    END IF;

    -- Revert linked order lines to ORDER_PENDING
    UPDATE cms_order_line ol
    SET 
        status = 'ORDER_PENDING',
        factory_po_id = NULL,
        sent_to_vendor_at = NULL,
        updated_at = v_now
    FROM cms_factory_po_line pol
    WHERE pol.po_id = p_po_id
      AND pol.order_line_id = ol.order_line_id
      AND ol.status NOT IN ('SHIPPED', 'CLOSED', 'CANCELLED');

    GET DIAGNOSTICS v_affected_lines = ROW_COUNT;

    -- Delete PO lines
    DELETE FROM cms_factory_po_line
    WHERE po_id = p_po_id;

    -- Update PO status
    UPDATE cms_factory_po
    SET 
        status = 'CANCELLED',
        updated_at = v_now,
        memo = COALESCE(memo || E'\n', '') || 'Cancelled: ' || COALESCE(p_reason, 'No reason provided')
    WHERE po_id = p_po_id;

    -- Log decision
    INSERT INTO cms_decision_log (
        entity_type,
        entity_id,
        decision_kind,
        before,
        after,
        actor_person_id,
        note
    )
    VALUES (
        'FACTORY_PO',
        p_po_id,
        'CANCEL',
        jsonb_build_object('status', v_po.status),
        jsonb_build_object('status', 'CANCELLED', 'reason', p_reason),
        p_actor_person_id,
        p_reason
    );

    RETURN jsonb_build_object(
        'ok', true,
        'po_id', p_po_id,
        'reverted_lines', v_affected_lines,
        'reason', p_reason
    );
END;
$$;

-- ============================================
-- Grants
-- ============================================
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_receipt_attach_to_order_lines(uuid, uuid[], timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_mark_shipped(uuid[], timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_get_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_cancel(uuid, text, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_receipt_attach_to_order_lines(uuid, uuid[], timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_mark_shipped(uuid[], timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_get_details(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_cancel(uuid, text, uuid) TO service_role;
