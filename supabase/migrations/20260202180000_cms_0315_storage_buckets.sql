-- ============================================
-- Storage Buckets for Factory Orders & Receipts
-- Date: 2026-02-02
-- ============================================

-- Create factory-orders bucket for mock fax storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'factory-orders', 
    'factory-orders', 
    true,  -- public access
    10485760,  -- 10MB limit
    ARRAY['text/html', 'application/pdf', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['text/html', 'application/pdf', 'image/png', 'image/jpeg']::text[];

-- Create receipts bucket if not exists (alternative storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts', 
    'receipts', 
    true,
    10485760,
    ARRAY['text/html', 'application/pdf', 'image/png', 'image/jpeg', 'application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Set bucket policies for authenticated users
CREATE POLICY "Allow authenticated uploads to factory-orders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'factory-orders');

CREATE POLICY "Allow authenticated read from factory-orders"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'factory-orders');

CREATE POLICY "Allow service_role full access to factory-orders"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'factory-orders');

CREATE POLICY "Allow authenticated uploads to receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow authenticated read from receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Allow service_role full access to receipts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts');
