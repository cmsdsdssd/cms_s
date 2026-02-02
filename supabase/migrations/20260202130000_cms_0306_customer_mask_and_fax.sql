-- Migration: Add fax columns to vendor_prefix_map and fix masking logic
-- Date: 2026-02-02

-- ============================================
-- 1. Add fax columns to cms_vendor_prefix_map
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_vendor_prefix_map' AND column_name = 'fax_number'
    ) THEN
        ALTER TABLE cms_vendor_prefix_map ADD COLUMN fax_number text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_vendor_prefix_map' AND column_name = 'fax_provider'
    ) THEN
        ALTER TABLE cms_vendor_prefix_map ADD COLUMN fax_provider text DEFAULT 'mock' 
            CHECK (fax_provider IN ('mock', 'twilio', 'sendpulse', 'etan', 'efax'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_vendor_prefix_map' AND column_name = 'fax_sender_name'
    ) THEN
        ALTER TABLE cms_vendor_prefix_map ADD COLUMN fax_sender_name text;
    END IF;
END $$;

-- ============================================
-- 2. Update RS and MS with fax info
-- ============================================
UPDATE cms_vendor_prefix_map 
SET 
    fax_number = '+82-2-1234-5678',
    fax_provider = 'twilio',
    fax_sender_name = '주식회사 쥬얼리'
WHERE prefix = 'RS';

UPDATE cms_vendor_prefix_map 
SET 
    fax_number = '+82-2-9876-5432', 
    fax_provider = 'twilio',
    fax_sender_name = '주식회사 쥬얼리'
WHERE prefix = 'MS';

-- ============================================
-- 3. Ensure customer_mask_code exists on order_line
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cms_order_line' AND column_name = 'customer_mask_code'
    ) THEN
        ALTER TABLE cms_order_line ADD COLUMN customer_mask_code text;
        CREATE INDEX IF NOT EXISTS idx_cms_order_line_customer_mask ON cms_order_line(customer_mask_code);
    END IF;
END $$;

-- ============================================
-- 4. Function to generate random mask code (6 chars, no confusing chars)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_generate_mask_code()
RETURNS text AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- No 0, O, 1, I
    result text := '';
    i integer;
    pos integer;
BEGIN
    -- Generate 6 character random code
    FOR i IN 1..6 LOOP
        pos := floor(random() * length(chars)) + 1;
        result := result || substr(chars, pos, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Trigger to auto-generate mask code on order_line insert
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_set_customer_mask_code()
RETURNS trigger AS $$
DECLARE
    new_code text;
    attempts integer := 0;
    max_attempts integer := 10;
BEGIN
    -- Only generate if not already set
    IF NEW.customer_mask_code IS NULL THEN
        -- Ensure uniqueness (retry if collision)
        LOOP
            new_code := cms_fn_generate_mask_code();
            attempts := attempts + 1;
            
            -- Check if code already exists
            IF NOT EXISTS (SELECT 1 FROM cms_order_line WHERE customer_mask_code = new_code) THEN
                NEW.customer_mask_code := new_code;
                EXIT;
            END IF;
            
            -- Prevent infinite loop
            IF attempts >= max_attempts THEN
                -- Fallback with timestamp
                NEW.customer_mask_code := 'TEMP' || substr(md5(random()::text), 1, 3);
                EXIT;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cms_trg_order_line_set_mask ON cms_order_line;
CREATE TRIGGER cms_trg_order_line_set_mask
    BEFORE INSERT ON cms_order_line
    FOR EACH ROW
    EXECUTE FUNCTION cms_fn_set_customer_mask_code();

-- ============================================
-- 6. Backfill existing order lines with mask codes
-- ============================================
UPDATE cms_order_line
SET customer_mask_code = cms_fn_generate_mask_code()
WHERE customer_mask_code IS NULL;

COMMIT;
