-- Migration: Add permissions for cms_vendor_fax_config (Settings page fix)
-- Date: 2026-02-02
-- Issue: Settings page couldn't load vendor list due to 401 Unauthorized

-- ============================================
-- 1. Grant anonymous SELECT access to vendor fax config
-- ============================================

-- Vendor Fax Config - 익명 접근 허용 (Settings 페이지용)
GRANT SELECT ON cms_vendor_fax_config TO anon;

-- 기존 authenticated 권한이 없으면 추가
DO $$
BEGIN
    -- Check if grant exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_privileges 
        WHERE grantee = 'authenticated' 
        AND table_name = 'cms_vendor_fax_config'
        AND privilege_type = 'INSERT'
    ) THEN
        GRANT SELECT, INSERT, UPDATE ON cms_vendor_fax_config TO authenticated;
    END IF;
END $$;

-- ============================================
-- 2. Enable RLS and create policies
-- ============================================

ALTER TABLE cms_vendor_fax_config ENABLE ROW LEVEL SECURITY;

-- Anon SELECT policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_vendor_fax_config' 
        AND policyname = 'allow_anon_select_fax_config'
    ) THEN
        CREATE POLICY allow_anon_select_fax_config ON cms_vendor_fax_config
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Authenticated ALL policy (upsert)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_vendor_fax_config' 
        AND policyname = 'allow_auth_upsert_fax_config'
    ) THEN
        CREATE POLICY allow_auth_upsert_fax_config ON cms_vendor_fax_config
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

COMMIT;
