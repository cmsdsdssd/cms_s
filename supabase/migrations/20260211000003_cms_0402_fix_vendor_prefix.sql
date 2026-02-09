
create or replace function cms_fn_upsert_vendor_prefix(
    p_vendor_party_id uuid,
    p_prefix text,
    p_note text default null
)
returns void
language plpgsql
security definer
as $$
begin
    insert into cms_vendor_prefix_map (vendor_party_id, prefix, note)
    values (p_vendor_party_id, p_prefix, p_note)
    on conflict (prefix) 
    do update set 
        vendor_party_id = excluded.vendor_party_id,
        note = coalesce(excluded.note, cms_vendor_prefix_map.note);
end;
$$;
