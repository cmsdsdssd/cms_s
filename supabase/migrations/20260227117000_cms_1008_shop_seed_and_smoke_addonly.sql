set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1008_shop_seed_and_smoke_addonly
-- Wave1: minimal seed + smoke helpers
-- -----------------------------------------------------------------------------

insert into public.sales_channel (
  channel_id,
  channel_type,
  channel_code,
  channel_name,
  is_active
)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'CAFE24'::public.shop_e_channel_type,
  'CAFE24_MAIN',
  '자사몰(카페24)',
  true
)
on conflict (channel_id) do update
set channel_type = excluded.channel_type,
    channel_code = excluded.channel_code,
    channel_name = excluded.channel_name,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.material_factor_set (
  factor_set_id,
  scope,
  channel_id,
  name,
  description,
  is_active,
  is_global_default
)
values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'GLOBAL'::public.shop_e_factor_scope,
  null,
  'GLOBAL_DEFAULT_V1',
  'Wave1 seed default factor set',
  true,
  true
)
on conflict (factor_set_id) do update
set scope = excluded.scope,
    channel_id = excluded.channel_id,
    name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active,
    is_global_default = excluded.is_global_default,
    updated_at = now();

insert into public.material_factor (
  factor_id,
  factor_set_id,
  material_code,
  multiplier,
  note
)
values
  ('33333333-3333-3333-3333-333333333331'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '14', 1.00, 'seed'),
  ('33333333-3333-3333-3333-333333333332'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '18', 1.00, 'seed'),
  ('33333333-3333-3333-3333-333333333333'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '925', 1.00, 'seed')
on conflict (factor_id) do update
set factor_set_id = excluded.factor_set_id,
    material_code = excluded.material_code,
    multiplier = excluded.multiplier,
    note = excluded.note,
    updated_at = now();

do $$
declare
  v_has_code boolean;
  v_has_name boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pricing_policy' and column_name = 'code'
  ) into v_has_code;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pricing_policy' and column_name = 'name'
  ) into v_has_name;

  if v_has_code and v_has_name then
    insert into public.pricing_policy (
      policy_id,
      channel_id,
      policy_name,
      margin_multiplier,
      rounding_unit,
      rounding_mode,
      material_factor_set_id,
      is_active,
      code,
      name
    )
    values (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'CAFE24_DEFAULT_POLICY',
      1.0,
      1000,
      'CEIL'::public.shop_e_rounding_mode,
      '22222222-2222-2222-2222-222222222222'::uuid,
      true,
      'CAFE24_DEFAULT_POLICY',
      'CAFE24_DEFAULT_POLICY'
    )
    on conflict (policy_id) do update
    set channel_id = excluded.channel_id,
        policy_name = excluded.policy_name,
        margin_multiplier = excluded.margin_multiplier,
        rounding_unit = excluded.rounding_unit,
        rounding_mode = excluded.rounding_mode,
        material_factor_set_id = excluded.material_factor_set_id,
        is_active = excluded.is_active,
        code = excluded.code,
        name = excluded.name,
        updated_at = now();
  elsif v_has_code then
    insert into public.pricing_policy (
      policy_id,
      channel_id,
      policy_name,
      margin_multiplier,
      rounding_unit,
      rounding_mode,
      material_factor_set_id,
      is_active,
      code
    )
    values (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'CAFE24_DEFAULT_POLICY',
      1.0,
      1000,
      'CEIL'::public.shop_e_rounding_mode,
      '22222222-2222-2222-2222-222222222222'::uuid,
      true,
      'CAFE24_DEFAULT_POLICY'
    )
    on conflict (policy_id) do update
    set channel_id = excluded.channel_id,
        policy_name = excluded.policy_name,
        margin_multiplier = excluded.margin_multiplier,
        rounding_unit = excluded.rounding_unit,
        rounding_mode = excluded.rounding_mode,
        material_factor_set_id = excluded.material_factor_set_id,
        is_active = excluded.is_active,
        code = excluded.code,
        updated_at = now();
  elsif v_has_name then
    insert into public.pricing_policy (
      policy_id,
      channel_id,
      policy_name,
      margin_multiplier,
      rounding_unit,
      rounding_mode,
      material_factor_set_id,
      is_active,
      name
    )
    values (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'CAFE24_DEFAULT_POLICY',
      1.0,
      1000,
      'CEIL'::public.shop_e_rounding_mode,
      '22222222-2222-2222-2222-222222222222'::uuid,
      true,
      'CAFE24_DEFAULT_POLICY'
    )
    on conflict (policy_id) do update
    set channel_id = excluded.channel_id,
        policy_name = excluded.policy_name,
        margin_multiplier = excluded.margin_multiplier,
        rounding_unit = excluded.rounding_unit,
        rounding_mode = excluded.rounding_mode,
        material_factor_set_id = excluded.material_factor_set_id,
        is_active = excluded.is_active,
        name = excluded.name,
        updated_at = now();
  else
    insert into public.pricing_policy (
      policy_id,
      channel_id,
      policy_name,
      margin_multiplier,
      rounding_unit,
      rounding_mode,
      material_factor_set_id,
      is_active
    )
    values (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '11111111-1111-1111-1111-111111111111'::uuid,
      'CAFE24_DEFAULT_POLICY',
      1.0,
      1000,
      'CEIL'::public.shop_e_rounding_mode,
      '22222222-2222-2222-2222-222222222222'::uuid,
      true
    )
    on conflict (policy_id) do update
    set channel_id = excluded.channel_id,
        policy_name = excluded.policy_name,
        margin_multiplier = excluded.margin_multiplier,
        rounding_unit = excluded.rounding_unit,
        rounding_mode = excluded.rounding_mode,
        material_factor_set_id = excluded.material_factor_set_id,
        is_active = excluded.is_active,
        updated_at = now();
  end if;
end $$;

update public.pricing_policy
set is_active = false,
    updated_at = now()
where channel_id = '11111111-1111-1111-1111-111111111111'::uuid
  and policy_id <> '44444444-4444-4444-4444-444444444444'::uuid
  and is_active = true;

-- ensure seeded policy remains active after deactivating others
update public.pricing_policy
set is_active = true,
    updated_at = now()
where policy_id = '44444444-4444-4444-4444-444444444444'::uuid;

-- -----------------------------------------------------------------------------
-- Smoke query references (manual execution)
-- -----------------------------------------------------------------------------
-- select * from public.sales_channel where channel_code = 'CAFE24_MAIN';
-- select * from public.material_factor_set where is_global_default = true;
-- select * from public.pricing_policy where channel_id = '11111111-1111-1111-1111-111111111111'::uuid;
-- select count(*) from public.v_channel_price_dashboard;
