-- Migration: Factory Purchase Order System + RyanSilver (RS) Seed
-- Date: 2026-02-02
-- For: npx supabase db reset
-- CLEAN: 원가/AP 관련 제거, 공장발주 + 시드만

-- ============================================
-- 1. Create Factory Purchase Order (PO) table FIRST
-- ============================================
CREATE TABLE IF NOT EXISTS cms_factory_po (
    po_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_prefix text NOT NULL,
    vendor_party_id uuid REFERENCES cms_party(party_id),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT_TO_VENDOR', 'CANCELLED')),
    fax_number text,
    fax_provider text DEFAULT 'mock' CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom')),
    fax_sent_at timestamptz,
    fax_payload_url text,
    fax_provider_message_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES cms_person(person_id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    memo text
);
CREATE INDEX IF NOT EXISTS idx_cms_factory_po_vendor_prefix ON cms_factory_po(vendor_prefix);
CREATE INDEX IF NOT EXISTS idx_cms_factory_po_status ON cms_factory_po(status);
CREATE INDEX IF NOT EXISTS idx_cms_factory_po_created_at ON cms_factory_po(created_at);
-- ============================================
-- 2. Create PO Line Items table
-- ============================================
CREATE TABLE IF NOT EXISTS cms_factory_po_line (
    po_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id uuid NOT NULL REFERENCES cms_factory_po(po_id) ON DELETE CASCADE,
    order_line_id uuid NOT NULL REFERENCES cms_order_line(order_line_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(po_id, order_line_id)
);
CREATE INDEX IF NOT EXISTS idx_cms_factory_po_line_po_id ON cms_factory_po_line(po_id);
CREATE INDEX IF NOT EXISTS idx_cms_factory_po_line_order_line_id ON cms_factory_po_line(order_line_id);
-- ============================================
-- 3. Create Fax Transmission Log table
-- ============================================
CREATE TABLE IF NOT EXISTS cms_fax_log (
    fax_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id uuid NOT NULL REFERENCES cms_factory_po(po_id) ON DELETE CASCADE,
    provider text NOT NULL,
    request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    success boolean NOT NULL DEFAULT false,
    error_message text,
    provider_message_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES cms_person(person_id)
);
CREATE INDEX IF NOT EXISTS idx_cms_fax_log_po_id ON cms_fax_log(po_id);
CREATE INDEX IF NOT EXISTS idx_cms_fax_log_created_at ON cms_fax_log(created_at);
-- ============================================
-- 4. Create Vendor Settings table for fax configuration
-- ============================================
CREATE TABLE IF NOT EXISTS cms_vendor_fax_config (
    config_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_party_id uuid NOT NULL UNIQUE REFERENCES cms_party(party_id),
    fax_number text,
    fax_provider text DEFAULT 'mock' CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'custom')),
    sender_name text,
    sender_phone text,
    sender_fax text,
    cover_page_template text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cms_vendor_fax_config_vendor_party_id ON cms_vendor_fax_config(vendor_party_id);
-- ============================================
-- 5. Add columns to cms_order_line
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cms_order_line' AND column_name = 'factory_po_id') THEN
        ALTER TABLE cms_order_line ADD COLUMN factory_po_id uuid REFERENCES cms_factory_po(po_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cms_order_line' AND column_name = 'sent_to_vendor_at') THEN
        ALTER TABLE cms_order_line ADD COLUMN sent_to_vendor_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cms_order_line' AND column_name = 'inbound_at') THEN
        ALTER TABLE cms_order_line ADD COLUMN inbound_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cms_order_line' AND column_name = 'shipped_at') THEN
        ALTER TABLE cms_order_line ADD COLUMN shipped_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cms_order_line' AND column_name = 'vendor_prefix') THEN
        ALTER TABLE cms_order_line ADD COLUMN vendor_prefix text;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cms_order_line_vendor_prefix ON cms_order_line(vendor_prefix);
CREATE INDEX IF NOT EXISTS idx_cms_order_line_factory_po_id ON cms_order_line(factory_po_id);
CREATE INDEX IF NOT EXISTS idx_cms_order_line_status_sent_at ON cms_order_line(status, sent_to_vendor_at);
-- ============================================
-- 6. Create View for Unshipped Order Lines
-- ============================================
CREATE OR REPLACE VIEW cms_v_unshipped_order_lines AS
SELECT 
    ol.order_line_id,
    ol.customer_party_id,
    ol.model_name,
    ol.suffix,
    ol.color,
    ol.size,
    ol.qty,
    ol.status,
    ol.vendor_prefix,
    ol.factory_po_id,
    ol.sent_to_vendor_at,
    ol.inbound_at,
    ol.shipped_at,
    ol.memo,
    ol.created_at,
    ol.updated_at,
    ol.is_plated,
    ol.plating_variant_id,
    ol.plating_color_code,
    ol.center_stone_name,
    ol.center_stone_qty,
    ol.sub1_stone_name,
    ol.sub1_stone_qty,
    ol.sub2_stone_name,
    ol.sub2_stone_qty,
    p.name AS customer_name,
    vp.vendor_party_id,
    v.name AS vendor_name,
    CASE 
        WHEN ol.status = 'SENT_TO_VENDOR' THEN '공장발주완료(입고대기)'
        WHEN ol.status IN ('WAITING_INBOUND', 'READY_TO_SHIP') THEN '출고대기'
        ELSE ol.status::text
    END AS display_status,
    CASE 
        WHEN ol.status = 'SENT_TO_VENDOR' THEN 1
        WHEN ol.status = 'WAITING_INBOUND' THEN 2
        WHEN ol.status = 'READY_TO_SHIP' THEN 3
        ELSE 4
    END AS status_sort_order,
    CASE WHEN ol.inbound_at IS NOT NULL THEN true ELSE false END AS has_inbound_receipt,
    COALESCE(ol.inbound_at, ol.sent_to_vendor_at, ol.created_at) AS queue_sort_date
FROM cms_order_line ol
LEFT JOIN cms_party p ON ol.customer_party_id = p.party_id
LEFT JOIN cms_vendor_prefix_map vp ON ol.vendor_prefix = vp.prefix
LEFT JOIN cms_party v ON vp.vendor_party_id = v.party_id
WHERE ol.status IN ('SENT_TO_VENDOR', 'WAITING_INBOUND', 'READY_TO_SHIP')
  AND ol.status <> 'CANCELLED';
-- ============================================
-- 7. Create View for Factory PO Summary
-- ============================================
CREATE OR REPLACE VIEW cms_v_factory_po_summary AS
SELECT 
    po.po_id,
    po.vendor_prefix,
    po.vendor_party_id,
    v.name AS vendor_name,
    po.status,
    po.fax_number,
    po.fax_provider,
    po.fax_sent_at,
    po.fax_payload_url,
    po.created_at,
    po.created_by,
    po.memo,
    COUNT(pol.order_line_id) AS line_count,
    SUM(ol.qty) AS total_qty,
    STRING_AGG(DISTINCT ol.model_name, ', ' ORDER BY ol.model_name) AS model_names,
    COALESCE(vc.fax_number, po.fax_number) AS effective_fax_number,
    vc.is_active AS vendor_config_active
FROM cms_factory_po po
LEFT JOIN cms_factory_po_line pol ON po.po_id = pol.po_id
LEFT JOIN cms_order_line ol ON pol.order_line_id = ol.order_line_id
LEFT JOIN cms_party v ON po.vendor_party_id = v.party_id
LEFT JOIN cms_vendor_fax_config vc ON po.vendor_party_id = vc.vendor_party_id
GROUP BY po.po_id, po.vendor_prefix, po.vendor_party_id, v.name, po.status,
    po.fax_number, po.fax_provider, po.fax_sent_at, po.fax_payload_url,
    po.created_at, po.created_by, po.memo, vc.fax_number, vc.is_active;
-- ============================================
-- 8. Create trigger for vendor_prefix extraction
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_extract_vendor_prefix()
RETURNS trigger AS $$
DECLARE
    v_prefix text;
BEGIN
    IF NEW.model_name IS NOT NULL THEN
        v_prefix := split_part(NEW.model_name, '-', 1);
        IF v_prefix ~ '^[A-Za-z0-9]+$' THEN
            NEW.vendor_prefix := upper(v_prefix);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS cms_trg_order_line_extract_prefix ON cms_order_line;
CREATE TRIGGER cms_trg_order_line_extract_prefix
    BEFORE INSERT OR UPDATE OF model_name ON cms_order_line
    FOR EACH ROW
    EXECUTE FUNCTION cms_fn_extract_vendor_prefix();
-- ============================================
-- 9. Backfill vendor_prefix
-- ============================================
UPDATE cms_order_line
SET vendor_prefix = upper(split_part(model_name, '-', 1))
WHERE model_name IS NOT NULL 
  AND vendor_prefix IS NULL
  AND split_part(model_name, '-', 1) ~ '^[A-Za-z0-9]+$';
-- ============================================
-- 10. SEED DATA: RyanSilver (RS) & MS Factory
-- ============================================

-- RyanSilver vendor party 등록
INSERT INTO cms_party (party_id, name, party_type, is_active, created_at)
VALUES (gen_random_uuid(), 'RyanSilver', 'vendor', true, now())
ON CONFLICT DO NOTHING;
-- MS vendor party 등록  
INSERT INTO cms_party (party_id, name, party_type, is_active, created_at)
VALUES (gen_random_uuid(), 'MS공장', 'vendor', true, now())
ON CONFLICT DO NOTHING;
-- RS prefix 매핑
INSERT INTO cms_vendor_prefix_map (prefix, vendor_party_id, note)
SELECT 'RS', party_id, 'RyanSilver 공장'
FROM cms_party WHERE name = 'RyanSilver' AND party_type = 'vendor'
ON CONFLICT (prefix) DO NOTHING;
-- MS prefix 매핑
INSERT INTO cms_vendor_prefix_map (prefix, vendor_party_id, note)
SELECT 'MS', party_id, 'MS 공장'
FROM cms_party WHERE name = 'MS공장' AND party_type = 'vendor'
ON CONFLICT (prefix) DO NOTHING;
-- ============================================
-- 11. Grants
-- ============================================
GRANT SELECT, INSERT, UPDATE ON cms_factory_po TO authenticated;
GRANT SELECT, INSERT, DELETE ON cms_factory_po_line TO authenticated;
GRANT SELECT, INSERT ON cms_fax_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cms_vendor_fax_config TO authenticated;
GRANT SELECT ON cms_v_unshipped_order_lines TO authenticated;
GRANT SELECT ON cms_v_factory_po_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cms_factory_po TO service_role;
GRANT SELECT, INSERT, DELETE ON cms_factory_po_line TO service_role;
GRANT SELECT, INSERT ON cms_fax_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON cms_vendor_fax_config TO service_role;
GRANT SELECT ON cms_v_unshipped_order_lines TO service_role;
GRANT SELECT ON cms_v_factory_po_summary TO service_role;
COMMIT;
