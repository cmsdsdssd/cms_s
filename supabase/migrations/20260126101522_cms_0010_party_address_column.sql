-- cms_0010: add main address column to cms_party (Phase1 convenience)

alter table public.cms_party
  add column if not exists address text;
comment on column public.cms_party.address is
'Phase1 main address (freeform). Multi-address support can use cms_party_address later.';
