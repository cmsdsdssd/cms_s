-- cms_0011: fix cms_fn_upsert_party_v1 to write into cms_party.note (not memo)

create or replace function public.cms_fn_upsert_party_v1(
  p_party_type cms_e_party_type,
  p_name text,
  p_phone text default null,
  p_region text default null,
  p_address text default null,
  p_memo text default null,
  p_party_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_party_type is null then
    raise exception 'party_type required';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;

  v_id := coalesce(p_party_id, gen_random_uuid());

  insert into public.cms_party(
    party_id, party_type, name, phone, region, address, note
  )
  values (
    v_id,
    p_party_type,
    trim(p_name),
    nullif(trim(coalesce(p_phone,'')), ''),
    nullif(trim(coalesce(p_region,'')), ''),
    nullif(trim(coalesce(p_address,'')), ''),
    nullif(trim(coalesce(p_memo,'')), '')
  )
  on conflict (party_id) do update set
    party_type = excluded.party_type,
    name       = excluded.name,
    phone      = excluded.phone,
    region     = excluded.region,
    address    = excluded.address,
    note       = excluded.note;

  return v_id;
end $$;

-- (선택) 권한: 기존 0008_security.sql에서 EXECUTE를 주고 있다면 생략 가능
-- grant execute on function public.cms_fn_upsert_party_v1(
--   cms_e_party_type, text, text, text, text, text, uuid
-- ) to authenticated;
