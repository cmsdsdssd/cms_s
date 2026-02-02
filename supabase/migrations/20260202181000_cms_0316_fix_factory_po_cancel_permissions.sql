-- ============================================
-- Fix: cms_fn_factory_po_cancel permissions
-- Date: 2026-02-02
-- Issue: Function not updating order lines due to RLS
-- ============================================

-- Drop existing function (all signatures)
DROP FUNCTION IF EXISTS cms_fn_factory_po_cancel(uuid, text, uuid);
DROP FUNCTION IF EXISTS cms_fn_factory_po_cancel(uuid);

-- Recreate with SECURITY DEFINER
CREATE OR REPLACE FUNCTION cms_fn_factory_po_cancel(
    p_po_id uuid,
    p_reason text DEFAULT NULL,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- <-- KEY FIX: bypass RLS
SET search_path = public
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
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Factory PO not found: ' || p_po_id
        );
    END IF;

    -- Can only cancel if not already sent
    IF v_po.status = 'SENT_TO_VENDOR' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Cannot cancel PO that has already been sent to vendor'
        );
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

    -- If no lines updated, return error (helps debugging)
    IF v_affected_lines = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'No order lines were updated - PO may already be processed or RLS issue',
            'po_id', p_po_id,
            'po_status', v_po.status
        );
    END IF;

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
        jsonb_build_object('status', 'CANCELLED', 'reason', p_reason, 'reverted_lines', v_affected_lines),
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

-- Grants
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_cancel(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_cancel(uuid, text, uuid) TO service_role;
