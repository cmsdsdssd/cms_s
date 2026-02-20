-- Migration: Add API PLEX provider + fax RPCs
-- Date: 2026-02-03

-- ============================================
-- 1. Update fax_provider CHECK constraints
-- ============================================
ALTER TABLE cms_factory_po
    DROP CONSTRAINT IF EXISTS cms_factory_po_fax_provider_check;
ALTER TABLE cms_factory_po
    ADD CONSTRAINT cms_factory_po_fax_provider_check
    CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom', 'apiplex'));
ALTER TABLE cms_vendor_fax_config
    DROP CONSTRAINT IF EXISTS cms_vendor_fax_config_fax_provider_check;
ALTER TABLE cms_vendor_fax_config
    ADD CONSTRAINT cms_vendor_fax_config_fax_provider_check
    CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom', 'apiplex'));
-- ============================================
-- 2. Vendor fax config upsert RPC
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_vendor_fax_config_upsert_v1(
    p_vendor_party_id uuid,
    p_fax_number text,
    p_fax_provider text,
    p_is_active boolean,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_now timestamptz := now();
BEGIN
    INSERT INTO cms_vendor_fax_config (
        vendor_party_id,
        fax_number,
        fax_provider,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        p_vendor_party_id,
        p_fax_number,
        p_fax_provider,
        COALESCE(p_is_active, true),
        v_now,
        v_now
    )
    ON CONFLICT (vendor_party_id)
    DO UPDATE SET
        fax_number = EXCLUDED.fax_number,
        fax_provider = EXCLUDED.fax_provider,
        is_active = EXCLUDED.is_active,
        updated_at = v_now;

    RETURN jsonb_build_object(
        'ok', true,
        'vendor_party_id', p_vendor_party_id,
        'fax_number', p_fax_number,
        'fax_provider', p_fax_provider,
        'is_active', COALESCE(p_is_active, true)
    );
END;
$$;
-- ============================================
-- 3. Fax log record RPC
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_fax_log_record_v1(
    p_po_id uuid,
    p_provider text,
    p_request_meta jsonb DEFAULT '{}'::jsonb,
    p_response_meta jsonb DEFAULT '{}'::jsonb,
    p_success boolean DEFAULT false,
    p_error_message text DEFAULT NULL,
    p_provider_message_id text DEFAULT NULL,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_fax_log_id uuid;
BEGIN
    INSERT INTO cms_fax_log (
        po_id,
        provider,
        request_meta,
        response_meta,
        success,
        error_message,
        provider_message_id,
        created_by
    )
    VALUES (
        p_po_id,
        p_provider,
        COALESCE(p_request_meta, '{}'::jsonb),
        COALESCE(p_response_meta, '{}'::jsonb),
        COALESCE(p_success, false),
        p_error_message,
        p_provider_message_id,
        p_actor_person_id
    )
    RETURNING fax_log_id INTO v_fax_log_id;

    RETURN jsonb_build_object(
        'ok', true,
        'fax_log_id', v_fax_log_id,
        'po_id', p_po_id
    );
END;
$$;
-- ============================================
-- 4. Webhook update RPC (by provider_message_id)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_fax_log_update_by_provider_message_id_v1(
    p_provider_message_id text,
    p_response_meta jsonb DEFAULT '{}'::jsonb,
    p_success boolean DEFAULT false,
    p_error_message text DEFAULT NULL,
    p_provider text DEFAULT NULL,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_fax_log_id uuid;
    v_po_id uuid;
BEGIN
    SELECT fax_log_id, po_id
    INTO v_fax_log_id, v_po_id
    FROM cms_fax_log
    WHERE provider_message_id = p_provider_message_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_fax_log_id IS NULL THEN
        SELECT po_id
        INTO v_po_id
        FROM cms_factory_po
        WHERE fax_provider_message_id = p_provider_message_id
        LIMIT 1;

        IF v_po_id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'po_not_found');
        END IF;

        INSERT INTO cms_fax_log (
            po_id,
            provider,
            request_meta,
            response_meta,
            success,
            error_message,
            provider_message_id,
            created_by
        )
        VALUES (
            v_po_id,
            COALESCE(p_provider, 'apiplex'),
            '{}'::jsonb,
            COALESCE(p_response_meta, '{}'::jsonb),
            COALESCE(p_success, false),
            p_error_message,
            p_provider_message_id,
            p_actor_person_id
        )
        RETURNING fax_log_id INTO v_fax_log_id;
    ELSE
        UPDATE cms_fax_log
        SET
            response_meta = COALESCE(p_response_meta, '{}'::jsonb),
            success = COALESCE(p_success, false),
            error_message = p_error_message
        WHERE fax_log_id = v_fax_log_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'fax_log_id', v_fax_log_id,
        'po_id', v_po_id
    );
END;
$$;
-- ============================================
-- 5. Grants
-- ============================================
GRANT EXECUTE ON FUNCTION cms_fn_vendor_fax_config_upsert_v1(uuid, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_fax_log_record_v1(uuid, text, jsonb, jsonb, boolean, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_fax_log_update_by_provider_message_id_v1(text, jsonb, boolean, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cms_fn_vendor_fax_config_upsert_v1(uuid, text, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_fax_log_record_v1(uuid, text, jsonb, jsonb, boolean, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION cms_fn_fax_log_update_by_provider_message_id_v1(text, jsonb, boolean, text, text, uuid) TO service_role;
