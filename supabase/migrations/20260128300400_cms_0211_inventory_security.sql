-- 20260128300400_cms_0211_inventory_security.sql
set search_path = public, pg_temp;

revoke all on public.cms_inventory_move_header from anon, authenticated;
revoke all on public.cms_inventory_move_line from anon, authenticated;

grant select on public.cms_inventory_move_header to authenticated;
grant select on public.cms_inventory_move_line to authenticated;

alter table public.cms_inventory_move_header enable row level security;
alter table public.cms_inventory_move_line enable row level security;

drop policy if exists cms_select_authenticated on public.cms_inventory_move_header;
create policy cms_select_authenticated on public.cms_inventory_move_header
for select to authenticated using (true);

drop policy if exists cms_select_authenticated on public.cms_inventory_move_line;
create policy cms_select_authenticated on public.cms_inventory_move_line
for select to authenticated using (true);

grant select on public.cms_v_inventory_move_worklist_v1 to authenticated;
grant select on public.cms_v_inventory_move_lines_enriched_v1 to authenticated;
grant select on public.cms_v_inventory_position_by_item_label_v1 to authenticated;
grant select on public.cms_v_inventory_position_by_master_item_v1 to authenticated;
grant select on public.cms_v_inventory_exceptions_v1 to authenticated;

-- RPC execute grants (Write는 RPC만)
grant execute on function public.cms_fn_upsert_inventory_move_header_v1(
  public.cms_e_inventory_move_type, timestamptz, uuid, text, text, uuid, text, text, jsonb, uuid, text, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_upsert_inventory_move_line_v1(
  uuid, int, public.cms_e_inventory_direction, numeric, text, text, public.cms_e_inventory_item_ref_type,
  uuid, uuid, text, text, jsonb, text, uuid, uuid, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_add_inventory_move_line_v1(
  uuid, public.cms_e_inventory_direction, numeric, text, text, public.cms_e_inventory_item_ref_type,
  uuid, uuid, text, text, jsonb, text, uuid, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_void_inventory_move_line_v1(
  uuid, text, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_post_inventory_move_v1(
  uuid, uuid, text, text, uuid
) to authenticated;

grant execute on function public.cms_fn_void_inventory_move_v1(
  uuid, text, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_quick_inventory_move_v1(
  public.cms_e_inventory_move_type, text, numeric, timestamptz, uuid, text, text, text, text, jsonb, text, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v1(
  uuid, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_emit_inventory_receipt_from_return_line_v1(
  uuid, uuid, text, uuid
) to authenticated;

grant execute on function public.cms_fn_seed_inventory_demo_v1(
  boolean, uuid, text, uuid
) to authenticated;
