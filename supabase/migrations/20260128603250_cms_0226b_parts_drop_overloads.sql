set search_path = public, pg_temp;

-- guard: newer overloads (with p_note) can cause 42725 ambiguity during 0227 regression
drop function if exists public.cms_fn_record_part_receipt_v1(
  jsonb, timestamptz, text, uuid, text, text, text, uuid, uuid, text
);

drop function if exists public.cms_fn_record_part_usage_v1(
  jsonb, timestamptz, text, text, text, uuid, text, text, text, uuid, uuid, text
);
