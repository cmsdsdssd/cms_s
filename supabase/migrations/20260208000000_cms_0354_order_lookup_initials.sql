create or replace function public.cms_fn_kor_initials(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(p_text, '');
  v_result text := '';
  v_len int := char_length(v_text);
  v_idx int := 1;
  v_char text;
  v_code int;
  v_initial_index int;
  v_bytes bytea;
  v_b0 int;
  v_b1 int;
  v_b2 int;
  v_initials int[] := array[
    12613, 12614, 12616, 12619, 12620, 12621, 12623, 12624, 12625, 12626,
    12627, 12628, 12629, 12630, 12631, 12632, 12633, 12634, 12635
  ];
begin
  while v_idx <= v_len loop
    v_char := substring(v_text from v_idx for 1);
    if char_length(v_char) = 0 then
      v_idx := v_idx + 1;
      continue;
    end if;
    v_bytes := convert_to(v_char, 'UTF8');
    v_b0 := get_byte(v_bytes, 0);
    v_b1 := case when length(v_bytes) > 1 then get_byte(v_bytes, 1) else 0 end;
    v_b2 := case when length(v_bytes) > 2 then get_byte(v_bytes, 2) else 0 end;
    if length(v_bytes) = 3 then
      v_code := ((v_b0 - 224) * 4096) + ((v_b1 - 128) * 64) + (v_b2 - 128);
    else
      v_code := v_b0;
    end if;
    if v_code between 44032 and 55203 then
      v_initial_index := (v_code - 44032) / 588;
      v_result := v_result || chr(v_initials[v_initial_index + 1]);
    else
      v_result := v_result || v_char;
    end if;
    v_idx := v_idx + 1;
  end loop;
  return v_result;
end $$;
create or replace view public.v_cms_order_lookup
with (security_invoker = true)
as
select
  o.order_line_id,
  o.order_line_id as order_id,
  left(o.order_line_id::text, 10) as order_no,
  o.created_at::date as order_date,
  o.customer_party_id as client_id,
  p.name as client_name,
  o.model_name as model_no,
  o.color,
  o.status,
  o.is_plated as plating_status,
  o.plating_color_code as plating_color,
  public.cms_fn_kor_initials(o.model_name) as model_no_initials,
  public.cms_fn_kor_initials(p.name) as client_name_initials
from public.cms_order_line o
join public.cms_party p on p.party_id = o.customer_party_id;
grant select on public.v_cms_order_lookup to anon, authenticated;
