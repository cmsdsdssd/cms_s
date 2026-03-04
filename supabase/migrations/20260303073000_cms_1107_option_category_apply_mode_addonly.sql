set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1107_option_category_apply_mode_addonly
-- Add per-option apply mode (SYNC/MANUAL) for editor UX
-- -----------------------------------------------------------------------------

alter table public.channel_option_category_v2
  add column if not exists apply_mode text not null default 'MANUAL';

do $$
begin
  alter table public.channel_option_category_v2
    add constraint channel_option_category_v2_apply_mode_enum
    check (apply_mode in ('SYNC', 'MANUAL'));
exception when duplicate_object then
  null;
end $$;
