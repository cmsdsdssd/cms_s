-- Migration: Allow anonymous access to views for development
-- Date: 2026-02-02
-- NOTE: Production에서는 authenticated로 변경 필요

-- ============================================
-- 1. Grant anonymous access to views (개발용)
-- ============================================

-- unshipped_order_lines 뷰 익명 접근 허용
GRANT SELECT ON cms_v_unshipped_order_lines TO anon;
GRANT SELECT ON cms_v_unshipped_order_lines TO authenticated;
-- factory_po_summary 뷰 익명 접근 허용  
GRANT SELECT ON cms_v_factory_po_summary TO anon;
GRANT SELECT ON cms_v_factory_po_summary TO authenticated;
-- mask_lookup 뷰 익명 접근 허용
GRANT SELECT ON cms_v_mask_lookup TO anon;
GRANT SELECT ON cms_v_mask_lookup TO authenticated;
GRANT SELECT ON cms_v_mask_lookup_readable TO anon;
GRANT SELECT ON cms_v_mask_lookup_readable TO authenticated;
-- ap_balance 뷰는 나중에 필요시 생성 (현재는 주석 처리)
-- GRANT SELECT ON cms_v_ap_balance_by_vendor TO anon;
-- GRANT SELECT ON cms_v_ap_balance_by_vendor TO authenticated;

-- ============================================
-- 2. Grant anonymous access to base tables (read-only)
-- ============================================

-- Order lines - 읽기만 허용
GRANT SELECT ON cms_order_line TO anon;
-- Party - 읽기만 허용
GRANT SELECT ON cms_party TO anon;
-- Factory PO - 읽기만 허용
GRANT SELECT ON cms_factory_po TO anon;
GRANT SELECT ON cms_factory_po_line TO anon;
-- Vendor prefix map - 읽기만 허용
GRANT SELECT ON cms_vendor_prefix_map TO anon;
-- Receipt inbox - 읽기만 허용
GRANT SELECT ON cms_receipt_inbox TO anon;
-- ============================================
-- 3. Row Level Security (RLS) 정책 - 개발용 전체 허용
-- ============================================

-- Order Line RLS 정책
ALTER TABLE cms_order_line ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_order_line' AND policyname = 'allow_anon_select'
    ) THEN
        CREATE POLICY allow_anon_select ON cms_order_line
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
-- Party RLS 정책
ALTER TABLE cms_party ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_party' AND policyname = 'allow_anon_select_party'
    ) THEN
        CREATE POLICY allow_anon_select_party ON cms_party
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
-- Factory PO RLS 정책
ALTER TABLE cms_factory_po ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_factory_po' AND policyname = 'allow_anon_select_po'
    ) THEN
        CREATE POLICY allow_anon_select_po ON cms_factory_po
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
-- Vendor Prefix Map RLS 정책
ALTER TABLE cms_vendor_prefix_map ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_vendor_prefix_map' AND policyname = 'allow_anon_select_prefix'
    ) THEN
        CREATE POLICY allow_anon_select_prefix ON cms_vendor_prefix_map
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
-- Receipt Inbox RLS 정책
ALTER TABLE cms_receipt_inbox ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cms_receipt_inbox' AND policyname = 'allow_anon_select_receipt'
    ) THEN
        CREATE POLICY allow_anon_select_receipt ON cms_receipt_inbox
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
COMMIT;
