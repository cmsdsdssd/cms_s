drop view if exists public.v_cms_order_lookup;

create view public.v_cms_order_lookup
with (security_invoker = true)
as
select
  o.order_line_id,
  o.order_line_id as order_id,
  left(o.order_line_id::text, 10) as order_no,
  o.created_at::date as order_date,
  o.customer_party_id as client_id,
  p.name as client_name,
  p.mask_code as client_code,
  o.model_name as model_no,
  o.color,
  o.status,
  o.is_plated as plating_status,
  o.plating_color_code as plating_color,
  public.cms_fn_kor_initials(o.model_name) as model_no_initials,
  public.cms_fn_kor_initials(p.name) as client_name_initials,
  public.cms_fn_kor_initials(p.mask_code) as client_code_initials
from public.cms_order_line o
join public.cms_party p on p.party_id = o.customer_party_id;

grant select on public.v_cms_order_lookup to anon, authenticated;
