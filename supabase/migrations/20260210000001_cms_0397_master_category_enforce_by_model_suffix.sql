set search_path = public, pg_temp;
-- ---------------------------------------------------------------------
-- Enforce master.category_code from the LAST '-<LETTER>' suffix in model_name
-- Policy (strict):
--   - Parse final segment after last '-'
--   - If final segment is a single alphabet letter, map to category
--   - Otherwise default to ETC
-- This migration also backfills all existing cms_master_item rows.
-- ---------------------------------------------------------------------

create or replace function public.cms_fn_master_category_from_model_name_v1(
  p_model_name text
)
returns public.cms_e_category_code
language plpgsql
immutable
as $$
declare
  v_raw text := trim(coalesce(p_model_name, ''));
  v_last text;
  v_letter text;
begin
  if v_raw = '' then
    return 'ETC'::public.cms_e_category_code;
  end if;

  -- strict: only last segment after '-' matters
  v_last := trim(split_part(v_raw, '-', array_length(regexp_split_to_array(v_raw, '-'), 1)));

  if v_last ~ '^[A-Za-z]$' then
    v_letter := upper(v_last);
    case v_letter
      when 'R' then return 'RING'::public.cms_e_category_code;
      when 'B' then return 'BRACELET'::public.cms_e_category_code;
      when 'E' then return 'EARRING'::public.cms_e_category_code;
      when 'N' then return 'NECKLACE'::public.cms_e_category_code;
      when 'M' then return 'PENDANT'::public.cms_e_category_code;
      when 'U' then return 'ACCESSORY'::public.cms_e_category_code;
      when 'W' then return 'WATCH'::public.cms_e_category_code;
      when 'K' then return 'KEYRING'::public.cms_e_category_code;
      when 'S' then return 'SYMBOL'::public.cms_e_category_code;
      when 'P' then return 'PIERCING'::public.cms_e_category_code;
      else return 'ETC'::public.cms_e_category_code;
    end case;
  end if;

  return 'ETC'::public.cms_e_category_code;
end $$;
create or replace function public.cms_fn_master_category_sync_from_model_name_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.category_code := public.cms_fn_master_category_from_model_name_v1(new.model_name);
  return new;
end $$;
drop trigger if exists trg_cms_master_category_sync_from_model_name on public.cms_master_item;
create trigger trg_cms_master_category_sync_from_model_name
before insert or update of model_name
on public.cms_master_item
for each row
execute function public.cms_fn_master_category_sync_from_model_name_trg_v1();
-- Backfill existing rows so historical data follows the same rule
update public.cms_master_item m
set category_code = public.cms_fn_master_category_from_model_name_v1(m.model_name)
where m.category_code is distinct from public.cms_fn_master_category_from_model_name_v1(m.model_name);
