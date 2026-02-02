-- Migration: Fix RPC return values for factory PO functions
-- Date: 2026-02-02
-- Issue: Previous migration didn't apply because it was modified after push
-- NOTE: This is an ADD-ONLY migration - do not modify after push

-- ============================================
-- Fix #1: Factory PO Create Function - Add proper return structure
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_factory_po_create_from_order_lines(
    p_order_line_ids uuid[],
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po_ids jsonb := '[]'::jsonb;
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
            fax_number,
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

    -- Return with 'ok' field for frontend compatibility
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
-- Grants for the function
-- ============================================
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_create_from_order_lines(uuid[], uuid) TO anon;

COMMIT;
