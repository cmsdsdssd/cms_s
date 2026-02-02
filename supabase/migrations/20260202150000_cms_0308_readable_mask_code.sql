-- Migration: Readable masking code format (A-001 style)
-- Date: 2026-02-02
-- Format: [A-Z]-[000-999] = 26,000 combinations

-- ============================================
-- 1. Function to generate readable mask code (A-001 format)
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_generate_readable_mask_code()
RETURNS text AS $$
DECLARE
    letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- 24 letters (no I, O to avoid confusion)
    letter_pos integer;
    letter_char text;
    number_part integer;
    result text;
    attempts integer := 0;
BEGIN
    LOOP
        -- Random letter position (1-24)
        letter_pos := floor(random() * length(letters)) + 1;
        letter_char := substr(letters, letter_pos, 1);
        
        -- Random number 0-999
        number_part := floor(random() * 1000);
        
        -- Format: A-001, B-123, etc.
        result := letter_char || '-' || lpad(number_part::text, 3, '0');
        
        -- Check uniqueness in party table
        IF NOT EXISTS (SELECT 1 FROM cms_party WHERE mask_code = result) THEN
            RETURN result;
        END IF;
        
        attempts := attempts + 1;
        IF attempts >= 50 THEN
            -- Fallback with timestamp to ensure uniqueness
            RETURN 'Z-' || lpad((floor(random() * 1000))::text, 3, '0') || substr(md5(clock_timestamp()::text), 1, 2);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Update existing parties with new readable format
-- ============================================
-- Only update if current code doesn't match new format
UPDATE cms_party
SET mask_code = cms_fn_generate_readable_mask_code()
WHERE mask_code IS NULL 
   OR mask_code NOT LIKE '_-___';  -- Not in A-001 format

-- ============================================
-- 3. Update order_lines to match party's new format
-- ============================================
UPDATE cms_order_line ol
SET customer_mask_code = p.mask_code
FROM cms_party p
WHERE ol.customer_party_id = p.party_id
  AND (ol.customer_mask_code IS NULL 
       OR ol.customer_mask_code NOT LIKE '_-___'
       OR ol.customer_mask_code != p.mask_code);

-- ============================================
-- 4. Update trigger function to use readable format
-- ============================================
CREATE OR REPLACE FUNCTION cms_fn_trigger_generate_party_mask()
RETURNS trigger AS $$
DECLARE
    letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    letter_pos integer;
    letter_char text;
    number_part integer;
    result text;
    attempts integer := 0;
BEGIN
    IF NEW.mask_code IS NULL THEN
        LOOP
            letter_pos := floor(random() * length(letters)) + 1;
            letter_char := substr(letters, letter_pos, 1);
            number_part := floor(random() * 1000);
            result := letter_char || '-' || lpad(number_part::text, 3, '0');
            
            IF NOT EXISTS (SELECT 1 FROM cms_party WHERE mask_code = result) THEN
                NEW.mask_code := result;
                EXIT;
            END IF;
            
            attempts := attempts + 1;
            IF attempts >= 50 THEN
                NEW.mask_code := 'Z-' || lpad((floor(random() * 1000))::text, 3, '0') || substr(md5(clock_timestamp()::text), 1, 2);
                EXIT;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create view for mask lookup with new format
-- ============================================
CREATE OR REPLACE VIEW cms_v_mask_lookup_readable AS
SELECT 
    p.party_id,
    p.party_type,
    p.name as party_name,
    p.mask_code,
    p.phone,
    substr(p.mask_code, 1, 1) as mask_letter,  -- A, B, C...
    substr(p.mask_code, 3, 3)::integer as mask_number,  -- 001, 123...
    COUNT(ol.order_line_id) as total_orders,
    MAX(ol.created_at) as last_order_date
FROM cms_party p
LEFT JOIN cms_order_line ol ON p.party_id = ol.customer_party_id
WHERE p.mask_code IS NOT NULL
GROUP BY p.party_id, p.party_type, p.name, p.mask_code, p.phone
ORDER BY mask_letter, mask_number;

-- ============================================
-- 6. Add helpful index for mask code ranges
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cms_party_mask_letter 
ON cms_party(substr(mask_code, 1, 1));

-- ============================================
-- 7. Sample data check
-- ============================================
-- SELECT 'Sample masking codes:' as info;
-- SELECT mask_code, name FROM cms_party WHERE mask_code LIKE '_-___' LIMIT 10;
