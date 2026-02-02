-- ============================================
-- Fix: cms_fn_factory_po_mark_sent JSON operator
-- Date: 2026-02-02
-- Issue: ?? operator not supported in some PostgreSQL versions
-- ============================================

-- Recreate function with COALESCE instead of ?? operator
CREATE OR REPLACE FUNCTION cms_fn_factory_po_mark_sent(
    p_po_id uuid,
    p_fax_result jsonb DEFAULT '{}'::jsonb,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        COALESCE(p_fax_result->'request', '{}'::jsonb),
        COALESCE(p_fax_result->'response', '{}'::jsonb),
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

-- Grants
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_factory_po_mark_sent(uuid, jsonb, uuid) TO service_role;
