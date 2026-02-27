set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1007_shop_security_grants_addonly
-- Wave1: grants + optional RLS enablement + protected token columns
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- Read surface for internal app users.
    execute 'grant select on public.sales_channel to authenticated';
    execute 'grant select on public.sales_channel_product to authenticated';
    execute 'grant select on public.pricing_policy to authenticated';
    execute 'grant select on public.pricing_policy_rule to authenticated';
    execute 'grant select on public.material_factor_set to authenticated';
    execute 'grant select on public.material_factor to authenticated';
    execute 'grant select on public.pricing_adjustment to authenticated';
    execute 'grant select on public.pricing_override to authenticated';
    execute 'grant select on public.pricing_snapshot to authenticated';
    execute 'grant select on public.channel_price_snapshot to authenticated';
    execute 'grant select on public.price_sync_job to authenticated';
    execute 'grant select on public.price_sync_job_item to authenticated';
    execute 'grant select on public.bucket to authenticated';
    execute 'grant select on public.bucket_master_item to authenticated';
    execute 'grant select on public.pricing_snapshot_latest to authenticated';
    execute 'grant select on public.channel_price_snapshot_latest to authenticated';
    execute 'grant select on public.v_channel_price_dashboard to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Full DML for backend service-role only.
    execute 'grant select, insert, update, delete on public.sales_channel to service_role';
    execute 'grant select, insert, update, delete on public.sales_channel_account to service_role';
    execute 'grant select, insert, update, delete on public.sales_channel_product to service_role';
    execute 'grant select, insert, update, delete on public.pricing_policy to service_role';
    execute 'grant select, insert, update, delete on public.pricing_policy_rule to service_role';
    execute 'grant select, insert, update, delete on public.material_factor_set to service_role';
    execute 'grant select, insert, update, delete on public.material_factor to service_role';
    execute 'grant select, insert, update, delete on public.pricing_adjustment to service_role';
    execute 'grant select, insert, update, delete on public.pricing_override to service_role';
    execute 'grant select, insert, update, delete on public.pricing_snapshot to service_role';
    execute 'grant select, insert, update, delete on public.channel_price_snapshot to service_role';
    execute 'grant select, insert, update, delete on public.price_sync_job to service_role';
    execute 'grant select, insert, update, delete on public.price_sync_job_item to service_role';
    execute 'grant select, insert, update, delete on public.bucket to service_role';
    execute 'grant select, insert, update, delete on public.bucket_master_item to service_role';

    execute 'grant execute on function public.shop_fn_pick_effective_factor_set_v1(uuid) to service_role';
    execute 'grant execute on function public.shop_fn_active_adjustments_v1(uuid,uuid,uuid,timestamptz) to service_role';
    execute 'grant execute on function public.shop_fn_active_override_v1(uuid,uuid,timestamptz) to service_role';
  end if;
end $$;

-- Restrict direct token-column reads from non-service roles.
revoke all (client_id_enc) on public.sales_channel_account from public;
revoke all (client_secret_enc) on public.sales_channel_account from public;
revoke all (access_token_enc) on public.sales_channel_account from public;
revoke all (refresh_token_enc) on public.sales_channel_account from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select(client_id_enc, client_secret_enc, access_token_enc, refresh_token_enc) on public.sales_channel_account to service_role';
  end if;
end $$;
