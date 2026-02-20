alter table public.cms_receipt_line_event enable row level security;
drop policy if exists cms_select_authenticated on public.cms_receipt_line_event;
create policy cms_select_authenticated
  on public.cms_receipt_line_event
  for select to authenticated
  using (true);
create or replace view public.cms_v_receipt_line_event_v1
with (security_invoker = true)
as
select
  e.event_id,
  e.created_at,
  e.created_by,
  e.receipt_id,
  e.line_uuid,
  e.event_type,
  e.reason,
  e.note,
  e.correlation_id,
  e.line_item_before
from public.cms_receipt_line_event e;
grant select on public.cms_v_receipt_line_event_v1 to authenticated, service_role;
