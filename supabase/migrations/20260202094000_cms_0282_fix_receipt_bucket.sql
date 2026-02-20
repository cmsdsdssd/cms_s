-- 🔥 영수증 버킷 불일치 문제 확인 및 해결 SQL
-- 문제: cms_receipt_inbox.file_bucket 값이 실제 버킷과 다름

-- 1. 현재 영수증 레코드의 버킷 분포 확인
SELECT 
  file_bucket,
  COUNT(*) as count,
  MIN(received_at) as earliest,
  MAX(received_at) as latest
FROM cms_receipt_inbox
GROUP BY file_bucket
ORDER BY count DESC;
-- 2. 잘못된 버킷명을 가진 레코드 확인 (ocr_docs가 아닌 경우)
SELECT 
  receipt_id,
  file_bucket,
  file_path,
  status,
  received_at
FROM cms_receipt_inbox
WHERE file_bucket != 'ocr_docs'
ORDER BY received_at DESC
LIMIT 20;
-- 3. 버킷명 업데이트 (ocr_docs가 실제 버킷인 경우)
-- ⚠️ 주의: 실제 버킷 확인 후 실행하세요
/*
UPDATE cms_receipt_inbox
SET file_bucket = 'ocr_docs'
WHERE file_bucket != 'ocr_docs'
  AND file_bucket IS NOT NULL;
*/

-- 4. Storage 버킷 생성 (없는 경우)
-- Supabase Dashboard에서 Storage > Buckets > New bucket
-- 또는 SQL:
/*
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('ocr_docs', 'ocr_docs', true, false, 20971520, '{"application/pdf", "image/jpeg", "image/png", "image/webp"}')
ON CONFLICT (id) DO NOTHING;
*/

-- 5. RLS 정책 추가 (필요한 경우)
/*
-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload to ocr_docs" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'ocr_docs');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read from ocr_docs" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'ocr_docs');

-- Service role can do everything
CREATE POLICY "Service role full access to ocr_docs" 
ON storage.objects 
FOR ALL TO service_role 
USING (bucket_id = 'ocr_docs');
*/;
