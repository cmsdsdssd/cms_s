-- Migration: Party-level masking code (ADD-ONLY) - FIXED v2
-- Date: 2026-02-02
-- FIXED: 트리거 함수와 일반 함수 분리

-- ============================================
-- 1. Add mask_code to cms_party
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_party' AND column_name = 'mask_code'
    ) THEN
        ALTER TABLE cms_party ADD COLUMN mask_code text;
        CREATE UNIQUE INDEX idx_cms_party_mask_code ON cms_party(mask_code);
    END IF;
END $$;

-- ============================================
-- 2. Add customer_mask_code to order_line
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_order_line' AND column_name = 'customer_mask_code'
    ) THEN
        ALTER TABLE cms_order_line ADD COLUMN customer_mask_code text;
        CREATE INDEX idx_cms_order_line_mask_lookup ON cms_order_line(customer_mask_code, customer_party_id);
    END IF;
END $$;

-- ============================================
-- 3. Drop existing functions (clean slate for mask functions)
-- ============================================
DROP FUNCTION IF EXISTS cms_fn_generate_party_mask_code();
DROP FUNCTION IF EXISTS cms_fn_copy_mask_from_party();
DROP FUNCTION IF EXISTS cms_fn_trigger_generate_party_mask();
DROP FUNCTION IF EXISTS cms_fn_trigger_copy_mask_to_order();

-- ============================================
-- 4. Create function: Generate random mask code
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_generate_party_mask_code()
RETURNS text AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result text := '';
    i integer;
    pos integer;
    attempts integer := 0;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..8 LOOP
            pos := floor(random() * length(chars)) + 1;
            result := result || substr(chars, pos, 1);
        END LOOP;
        
        IF NOT EXISTS (SELECT 1 FROM cms_party WHERE mask_code = result) THEN
            RETURN result;
        END IF;
        
        attempts := attempts + 1;
        IF attempts >= 20 THEN
            RETURN 'P' || substr(md5(random()::text || clock_timestamp()::text), 1, 7);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create TRIGGER function: Auto-generate mask on party insert
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_trigger_generate_party_mask()
RETURNS trigger AS $$
BEGIN
    IF NEW.mask_code IS NULL THEN
        NEW.mask_code := cms_fn_generate_party_mask_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create TRIGGER function: Copy mask from party to order
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_trigger_copy_mask_to_order()
RETURNS trigger AS $$
DECLARE
    party_mask text;
BEGIN
    SELECT mask_code INTO party_mask
    FROM cms_party
    WHERE party_id = NEW.customer_party_id;
    
    IF party_mask IS NOT NULL THEN
        NEW.customer_mask_code := party_mask;
    ELSE
        NEW.customer_mask_code := 'TEMP' || substr(md5(random()::text), 1, 4);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Create trigger: Auto-generate mask on party insert
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'cms_trg_party_auto_mask'
    ) THEN
        CREATE TRIGGER cms_trg_party_auto_mask
            BEFORE INSERT ON cms_party
            FOR EACH ROW
            EXECUTE FUNCTION cms_fn_trigger_generate_party_mask();
    END IF;
END $$;

-- ============================================
-- 8. Create trigger: Copy mask from party to order_line
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'cms_trg_order_copy_party_mask'
    ) THEN
        CREATE TRIGGER cms_trg_order_copy_party_mask
            BEFORE INSERT ON cms_order_line
            FOR EACH ROW
            EXECUTE FUNCTION cms_fn_trigger_copy_mask_to_order();
    END IF;
END $$;

-- ============================================
-- 9. Backfill parties with mask codes
-- ============================================
UPDATE cms_party
SET mask_code = cms_fn_generate_party_mask_code()
WHERE mask_code IS NULL;

-- ============================================
-- 10. Backfill order_lines
-- ============================================
UPDATE cms_order_line ol
SET customer_mask_code = p.mask_code
FROM cms_party p
WHERE ol.customer_party_id = p.party_id
  AND (ol.customer_mask_code IS NULL OR ol.customer_mask_code LIKE 'TEMP%');

-- ============================================
-- 11. Create view for mask lookup
-- ============================================
CREATE OR REPLACE VIEW cms_v_mask_lookup AS
SELECT 
    p.party_id,
    p.party_type,
    p.name as party_name,
    p.mask_code,
    p.phone,
    COUNT(ol.order_line_id) as total_orders,
    MAX(ol.created_at) as last_order_date
FROM cms_party p
LEFT JOIN cms_order_line ol ON p.party_id = ol.customer_party_id
WHERE p.mask_code IS NOT NULL
GROUP BY p.party_id, p.party_type, p.name, p.mask_code, p.phone;
