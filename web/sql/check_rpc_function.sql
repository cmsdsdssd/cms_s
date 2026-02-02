-- Supabase RPC 함수 파라미터 확인 쿼리
-- 이 쿼리로 cms_fn_shipment_update_line_v1의 실제 파라미터를 확인할 수 있습니다

-- 방법 1: 함수 정의 확인
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%shipment%line%'
ORDER BY p.proname;

-- 방법 2: 모든 파라미터 상세 확인
SELECT 
  p.proname as function_name,
  proargnames as param_names,
  proargtypes::regtype[] as param_types,
  proallargtypes::regtype[] as all_param_types,
  proargmodes as param_modes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'cms_fn_shipment_update_line_v1';

-- 방법 3: 함수 소스 코드 확인 (가능한 경우)
SELECT 
  proname,
  prosrc
FROM pg_proc
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE pg_namespace.nspname = 'public'
AND proname = 'cms_fn_shipment_update_line_v1';
