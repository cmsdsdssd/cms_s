-- cms_0406
-- Receipt apply lifecycle: DRAFT/CONFIRMED + backdated guard/recalc trigger
-- and confirmed-only latest factory receipt selection for AP screens.

set search_path = public, pg_temp;
begin;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cms_factory_receipt_apply_status') then
    create type public.cms_factory_receipt_apply_status as enum ('DRAFT', 'CONFIRMED');
  end if;
end $$;
alter table if exists public.cms_factory_receipt_snapshot
  add column if not exists apply_status public.cms_factory_receipt_apply_status not null default 'DRAFT',
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid,
  add column if not exists confirm_note text,
  add column if not exists backdated_from_receipt_id uuid,
  add column if not exists backdated_detected_at timestamptz,
  add column if not exists backdated_note text;
-- rollout safety: keep current behavior for existing data
update public.cms_factory_receipt_snapshot
set apply_status = 'CONFIRMED',
    confirmed_at = coalesce(confirmed_at, now())
where is_current = true
  and apply_status = 'DRAFT';
create index if not exists cms_factory_receipt_snapshot_vendor_apply_current_idx
  on public.cms_factory_receipt_snapshot (vendor_party_id, apply_status, is_current, issued_at desc);
create or replace view public.cms_v_ap_factory_latest_receipt_by_vendor_v1
with (security_invoker = true)
as
select distinct on (s.vendor_party_id)
  s.vendor_party_id,
  s.receipt_id,
  s.snapshot_version,
  s.issued_at,
  coalesce(r.bill_no,'') as bill_no
from public.cms_factory_receipt_snapshot s
left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
where s.is_current = true
  and s.apply_status = 'CONFIRMED'
order by
  s.vendor_party_id,
  s.issued_at desc,
  coalesce(r.bill_no,'') desc,
  s.receipt_id::text desc,
  s.snapshot_version desc;
grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to authenticated;
grant select on public.cms_v_ap_factory_latest_receipt_by_vendor_v1 to anon;
create or replace function public.cms_fn_factory_receipt_set_apply_status_v1(
  p_receipt_id uuid,
  p_snapshot_version int default null,
  p_status_text text default 'CONFIRMED',
  p_force_recalc boolean default false,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.cms_factory_receipt_apply_status;
  v_snapshot_version int;
  v_vendor uuid;
  v_issued_at date;
  v_bill_no text;
  v_backdated_receipt_id uuid;
  v_backdated_issued_at date;
  v_backdated_bill_no text;
  v_affected_count int := 0;
  r_target record;
begin
  if p_receipt_id is null then
    raise exception 'receipt_id required';
  end if;

  v_status := case upper(coalesce(trim(p_status_text), 'CONFIRMED'))
    when 'DRAFT' then 'DRAFT'::public.cms_factory_receipt_apply_status
    when 'CONFIRMED' then 'CONFIRMED'::public.cms_factory_receipt_apply_status
    else null
  end;

  if v_status is null then
    raise exception 'invalid status_text: %', p_status_text;
  end if;

  if p_snapshot_version is null then
    select snapshot_version
      into v_snapshot_version
    from public.cms_factory_receipt_snapshot
    where receipt_id = p_receipt_id
      and is_current = true
    order by snapshot_version desc
    limit 1;
  else
    v_snapshot_version := p_snapshot_version;
  end if;

  if v_snapshot_version is null then
    raise exception 'snapshot not found for receipt_id=%', p_receipt_id;
  end if;

  select s.vendor_party_id, s.issued_at, coalesce(r.bill_no,'')
    into v_vendor, v_issued_at, v_bill_no
  from public.cms_factory_receipt_snapshot s
  left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
  where s.receipt_id = p_receipt_id
    and s.snapshot_version = v_snapshot_version;

  if v_vendor is null or v_issued_at is null then
    raise exception 'snapshot header invalid';
  end if;

  if v_status = 'DRAFT' then
    update public.cms_factory_receipt_snapshot
       set apply_status = 'DRAFT',
           confirmed_at = null,
           confirmed_by = null,
           confirm_note = p_note,
           backdated_from_receipt_id = null,
           backdated_detected_at = null,
           backdated_note = null,
           updated_at = now(),
           updated_by = auth.uid()
     where receipt_id = p_receipt_id
       and snapshot_version = v_snapshot_version;

    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'snapshot_version', v_snapshot_version,
      'apply_status', 'DRAFT'
    );
  end if;

  select s2.receipt_id, s2.issued_at, coalesce(r2.bill_no,'')
    into v_backdated_receipt_id, v_backdated_issued_at, v_backdated_bill_no
  from public.cms_factory_receipt_snapshot s2
  left join public.cms_receipt_inbox r2 on r2.receipt_id = s2.receipt_id
  where s2.vendor_party_id = v_vendor
    and s2.is_current = true
    and s2.apply_status = 'CONFIRMED'
    and s2.receipt_id <> p_receipt_id
    and (
      s2.issued_at > v_issued_at
      or (s2.issued_at = v_issued_at and coalesce(r2.bill_no,'') > v_bill_no)
    )
  order by s2.issued_at asc, coalesce(r2.bill_no,'') asc, s2.receipt_id::text asc
  limit 1;

  if v_backdated_receipt_id is not null and not coalesce(p_force_recalc, false) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'BACKDATED_RECEIPT_RECALC_REQUIRED: newer confirmed receipt exists (receipt_id=%s, issued_at=%s, bill_no=%s)',
        v_backdated_receipt_id,
        v_backdated_issued_at,
        v_backdated_bill_no
      );
  end if;

  update public.cms_factory_receipt_snapshot
     set apply_status = 'CONFIRMED',
         confirmed_at = now(),
         confirmed_by = auth.uid(),
         confirm_note = p_note,
         backdated_from_receipt_id = v_backdated_receipt_id,
         backdated_detected_at = case when v_backdated_receipt_id is null then null else now() end,
         backdated_note = case when v_backdated_receipt_id is null then null else 'confirmed with backdated detection' end,
         updated_at = now(),
         updated_by = auth.uid()
   where receipt_id = p_receipt_id
     and snapshot_version = v_snapshot_version;

  if coalesce(p_force_recalc, false) and v_backdated_receipt_id is not null then
    for r_target in
      with scoped as (
        select
          s.receipt_id,
          s.issued_at,
          coalesce(r.bill_no,'') as bill_no
        from public.cms_factory_receipt_snapshot s
        left join public.cms_receipt_inbox r on r.receipt_id = s.receipt_id
        where s.vendor_party_id = v_vendor
          and s.is_current = true
          and s.apply_status = 'CONFIRMED'
      )
      select receipt_id
      from scoped
      where issued_at > v_issued_at
         or (issued_at = v_issued_at and bill_no >= v_bill_no)
      order by issued_at asc, bill_no asc, receipt_id::text asc
    loop
      perform public.cms_fn_ap2_sync_from_receipt_v1(r_target.receipt_id, coalesce(p_note, 'confirm/recalc'));
      perform public.cms_fn_ap_run_reconcile_for_receipt_v2(r_target.receipt_id);
      v_affected_count := v_affected_count + 1;
    end loop;
  else
    perform public.cms_fn_ap2_sync_from_receipt_v1(p_receipt_id, coalesce(p_note, 'confirm'));
    perform public.cms_fn_ap_run_reconcile_for_receipt_v2(p_receipt_id);
    v_affected_count := 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'snapshot_version', v_snapshot_version,
    'apply_status', 'CONFIRMED',
    'backdated_receipt_id', v_backdated_receipt_id,
    'reconciled_receipt_count', v_affected_count
  );
end $$;
alter function public.cms_fn_factory_receipt_set_apply_status_v1(uuid,int,text,boolean,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_factory_receipt_set_apply_status_v1(uuid,int,text,boolean,text)
  to authenticated, service_role;
commit;
