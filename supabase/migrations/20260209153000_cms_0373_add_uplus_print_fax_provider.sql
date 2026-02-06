-- Migration: Add U+ WebFax print provider (uplus_print)
-- Date: 2026-02-09
-- Goal: Allow 'uplus_print' in fax_provider for cms_factory_po / cms_vendor_fax_config
-- NOTE: ADD-ONLY style, but uses safe DDL updates (DROP/ADD constraint) consistent with existing migrations.

-- ============================================
-- 1) cms_factory_po.fax_provider CHECK constraint update
-- ============================================
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'cms_factory_po'
    AND c.conname = 'cms_factory_po_fax_provider_check';

  -- Only update if missing or does not include 'uplus_print'
  IF v_def IS NULL OR position('uplus_print' in v_def) = 0 THEN
    EXECUTE 'ALTER TABLE public.cms_factory_po DROP CONSTRAINT IF EXISTS cms_factory_po_fax_provider_check';
    EXECUTE $ddl$
      ALTER TABLE public.cms_factory_po
      ADD CONSTRAINT cms_factory_po_fax_provider_check
      CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom', 'apiplex', 'uplus_print'))
    $ddl$;
  END IF;
END $$;

-- ============================================
-- 2) cms_vendor_fax_config.fax_provider CHECK constraint update
-- ============================================
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'cms_vendor_fax_config'
    AND c.conname = 'cms_vendor_fax_config_fax_provider_check';

  -- Only update if missing or does not include 'uplus_print'
  IF v_def IS NULL OR position('uplus_print' in v_def) = 0 THEN
    EXECUTE 'ALTER TABLE public.cms_vendor_fax_config DROP CONSTRAINT IF EXISTS cms_vendor_fax_config_fax_provider_check';
    EXECUTE $ddl$
      ALTER TABLE public.cms_vendor_fax_config
      ADD CONSTRAINT cms_vendor_fax_config_fax_provider_check
      CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom', 'apiplex', 'uplus_print'))
    $ddl$;
  END IF;
END $$;
