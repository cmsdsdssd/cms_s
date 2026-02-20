-- Migration: Make vendor fax config RPC security definer
-- Date: 2026-02-03

CREATE OR REPLACE FUNCTION cms_fn_vendor_fax_config_upsert_v1(
    p_vendor_party_id uuid,
    p_fax_number text,
    p_fax_provider text,
    p_is_active boolean,
    p_actor_person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
GRANT EXECUTE ON FUNCTION cms_fn_vendor_fax_config_upsert_v1(uuid, text, text, boolean, uuid) TO anon;
