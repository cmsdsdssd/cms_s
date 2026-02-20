-- Migration: Fix Factory PO RPC permissions (SECURITY DEFINER)
-- Date: 2026-02-02
-- Issue: Factory order creation fails with "permission denied for table cms_factory_po"

-- ============================================
-- Fix RPC functions to use SECURITY DEFINER
-- This allows the functions to run with the owner's permissions
-- regardless of the caller's permissions
-- ============================================

-- Fix: Add SECURITY DEFINER to factory PO create function
CREATE OR REPLACE FUNCTION cms_fn_factory_po_create_from_order_lines(
    p_order_line_ids uuid[],
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Added: Run with function owner permissions
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
          AND ol.status IN ('ORDER_PENDING', 'SENT_TO_VENDOR')
          AND ol.factory_po_id IS NULL
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
            created_by
        ) VALUES (
            v_vendor_prefix,
            v_vendor_party_id,
            'DRAFT',
            p_actor_person_id
        )
        RETURNING po_id INTO v_po_id;

        -- Link order lines to this PO
        UPDATE cms_order_line
        SET factory_po_id = v_po_id,
            status = CASE 
                WHEN status = 'ORDER_PENDING' THEN 'SENT_TO_VENDOR'
                ELSE status
            END,
            sent_to_vendor_at = CASE 
                WHEN status = 'ORDER_PENDING' THEN NOW()
                ELSE sent_to_vendor_at
            END
        WHERE order_line_id = ANY(v_prefix_group.line_ids)
          AND factory_po_id IS NULL;

        -- Create PO lines
        INSERT INTO cms_factory_po_line (po_id, order_line_id)
        SELECT v_po_id, line_id
        FROM UNNEST(v_prefix_group.line_ids) AS line_id;

        -- Add to result
        v_po_ids := v_po_ids || jsonb_build_object(
            'po_id', v_po_id,
            'vendor_prefix', v_vendor_prefix,
            'line_count', array_length(v_prefix_group.line_ids, 1)
        );
        
        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- Check if any lines were already in a PO
    SELECT COUNT(*) INTO v_already_po_count
    FROM cms_order_line
    WHERE order_line_id = ANY(p_order_line_ids)
      AND factory_po_id IS NOT NULL;

    RETURN jsonb_build_object(
        'success', true,
        'pos', v_po_ids,
        'processed_groups', v_processed_count,
        'already_in_po_count', v_already_po_count
    );
END;
$$;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO anon;
-- Also fix other factory PO functions to use SECURITY DEFINER

-- Fix: cms_fn_factory_po_mark_sent
CREATE OR REPLACE FUNCTION cms_fn_factory_po_mark_sent(
    p_po_id uuid,
    p_fax_result jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated uuid;
BEGIN
    UPDATE cms_factory_po
    SET status = 'SENT',
        fax_sent_at = NOW(),
        fax_provider = p_fax_result->>'provider',
        fax_payload_url = p_fax_result->>'payload_url',
        updated_at = NOW()
    WHERE po_id = p_po_id
      AND status = 'DRAFT'
    RETURNING po_id INTO v_updated;

    IF v_updated IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PO not found or already sent'
        );
    END IF;

    -- Log the fax attempt
    INSERT INTO cms_fax_log (
        po_id,
        provider,
        request_meta,
        response_meta,
        success,
        error_message
    ) VALUES (
        p_po_id,
        p_fax_result->>'provider',
        p_fax_result->'request',
        p_fax_result->'response',
        (p_fax_result->>'success')::boolean,
        p_fax_result->>'error'
    );

    RETURN jsonb_build_object(
        'success', true,
        'po_id', p_po_id
    );
END;
$$;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb) TO anon;
COMMIT;
