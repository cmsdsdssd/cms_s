update public.cms_master_item
set category_code = 'ETC'::public.cms_e_category_code
where category_code is null;
alter table public.cms_master_item
  alter column category_code set default 'ETC'::public.cms_e_category_code;
alter table public.cms_master_item
  alter column category_code set not null;
