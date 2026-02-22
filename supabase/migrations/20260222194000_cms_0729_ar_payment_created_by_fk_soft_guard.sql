-- cms_0729: prevent cms_ar_payment.created_by FK failures from auth user ids
-- Strategy: keep FK to cms_person, but coerce unknown created_by to NULL at write time.

begin;

create or replace function public.cms_fn_ar_payment_created_by_soft_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null
     and not exists (
       select 1
       from public.cms_person p
       where p.person_id = new.created_by
     )
  then
    new.created_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists cms_trg_ar_payment_created_by_soft_guard_v1 on public.cms_ar_payment;

create trigger cms_trg_ar_payment_created_by_soft_guard_v1
before insert or update on public.cms_ar_payment
for each row
execute function public.cms_fn_ar_payment_created_by_soft_guard_v1();

commit;
