set search_path = public, pg_temp;
-- v6: supply_source만 받는 "단일" upsert entrypoint
create or replace function public.cms_fn_upsert_order_line_v6(
  p_customer_party_id uuid,
  p_master_id uuid,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_plating_color_code text default null,
  p_requested_due_date date default null,
  p_priority_code public.cms_e_priority_code default 'NORMAL',
  p_source_channel text default null,
  p_memo text default null,
  p_order_line_id uuid default null,

  p_center_stone_source public.cms_e_stone_supply_source default null,
  p_center_stone_name text default null,
  p_center_stone_qty int default null,

  p_sub1_stone_source public.cms_e_stone_supply_source default null,
  p_sub1_stone_name text default null,
  p_sub1_stone_qty int default null,

  p_sub2_stone_source public.cms_e_stone_supply_source default null,
  p_sub2_stone_name text default null,
  p_sub2_stone_qty int default null,

  p_actor_person_id uuid default null,
  p_suffix text default null,
  p_color text default null,
  p_material_code public.cms_e_material_code default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- ✅ supply_source 시그니처 v5를 강제 선택 (오버로드 모호성 제거)
  v_id := public.cms_fn_upsert_order_line_v5(
    p_customer_party_id,
    p_master_id,
    p_qty,
    p_size,
    p_is_plated,
    p_plating_variant_id,
    p_plating_color_code,
    p_requested_due_date,
    p_priority_code,
    p_source_channel,
    p_memo,
    p_order_line_id,

    (p_center_stone_source)::public.cms_e_stone_supply_source,
    p_center_stone_name,
    p_center_stone_qty,

    (p_sub1_stone_source)::public.cms_e_stone_supply_source,
    p_sub1_stone_name,
    p_sub1_stone_qty,

    (p_sub2_stone_source)::public.cms_e_stone_supply_source,
    p_sub2_stone_name,
    p_sub2_stone_qty,

    p_actor_person_id,
    p_suffix,
    p_color,
    p_material_code
  );

  -- ✅ 레거시 호환: supply_type도 함께 맞춰줌 (SELF/PROVIDED만)
  update public.cms_order_line
  set
    center_stone_supply_type = case
      when center_stone_source::text in ('SELF','PROVIDED')
        then (center_stone_source::text)::public.cms_e_stone_supply_type
      else center_stone_supply_type
    end,
    sub1_stone_supply_type = case
      when sub1_stone_source::text in ('SELF','PROVIDED')
        then (sub1_stone_source::text)::public.cms_e_stone_supply_type
      else sub1_stone_supply_type
    end,
    sub2_stone_supply_type = case
      when sub2_stone_source::text in ('SELF','PROVIDED')
        then (sub2_stone_source::text)::public.cms_e_stone_supply_type
      else sub2_stone_supply_type
    end
  where order_line_id = v_id;

  return v_id;
end $$;
-- safe grants
do $$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v6(
      uuid, uuid, int, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      uuid, text, text, public.cms_e_material_code
    ) to anon$g$;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v6(
      uuid, uuid, int, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      uuid, text, text, public.cms_e_material_code
    ) to authenticated$g$;
  end if;

  if exists (select 1 from pg_roles where rolname='service_role') then
    execute $g$grant execute on function public.cms_fn_upsert_order_line_v6(
      uuid, uuid, int, text, boolean, uuid, text, date, public.cms_e_priority_code,
      text, text, uuid,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      public.cms_e_stone_supply_source, text, int,
      uuid, text, text, public.cms_e_material_code
    ) to service_role$g$;
  end if;
end $$;
