set search_path = public, pg_temp;

create or replace function public.cms_fn_category_code_from_model_name(p_model_name text)
returns public.cms_e_category_code
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_model_name,''));
  v_last text;
  v_letter text;
  v_parts text[];
begin
  if v = '' then
    return 'ETC'::public.cms_e_category_code;
  end if;

  if position('-' in v) > 0 then
    v_parts := string_to_array(v, '-');
    v_last := trim(v_parts[array_length(v_parts, 1)]);

    -- 諛쒖컡: 臾몄옄???멸렇癒쇳듃
    if v_last = '諛쒖컡' then
      return 'ANKLET'::public.cms_e_category_code;
    end if;

    -- 1湲??肄붾뱶
    if v_last ~* '^[a-z]$' then
      v_letter := upper(v_last);
    else
      return 'ETC'::public.cms_e_category_code;
    end if;
  else
    select upper((regexp_match(v, '([A-Za-z])\s*$'))[1]) into v_letter;

    if v_letter is null then
      if right(v, 2) = '諛쒖컡' then
        return 'ANKLET'::public.cms_e_category_code;
      end if;
      return 'ETC'::public.cms_e_category_code;
    end if;
  end if;

  case v_letter
    when 'R' then return 'RING'::public.cms_e_category_code;
    when 'B' then return 'BRACELET'::public.cms_e_category_code;
    when 'E' then return 'EARRING'::public.cms_e_category_code;
    when 'N' then return 'NECKLACE'::public.cms_e_category_code;
    when 'M' then return 'PENDANT'::public.cms_e_category_code;
    when 'U' then return 'ACCESSORY'::public.cms_e_category_code; -- ??遺??
    when 'W' then return 'WATCH'::public.cms_e_category_code;
    when 'K' then return 'KEYRING'::public.cms_e_category_code;
    when 'S' then return 'SYMBOL'::public.cms_e_category_code;
    when 'Z' then return 'ETC'::public.cms_e_category_code;
    else return 'ETC'::public.cms_e_category_code;
  end case;
end $$;
