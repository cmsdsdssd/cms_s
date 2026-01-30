set search_path = public, pg_temp;

-- BOM Recipe (제품 -> 구성품) : 운영 안정(멱등/void) + 분석(정확한 소비 추적) 용
create table if not exists public.cms_bom_recipe (
  bom_id uuid primary key default gen_random_uuid(),
  product_master_id uuid not null references public.cms_master_item(master_id),
  variant_key text, -- 예: 'A / GOLD / S'
  is_active boolean not null default true,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- active default (variant_key null) 은 제품당 1개만
create unique index if not exists ux_cms_bom_recipe_default_active
  on public.cms_bom_recipe(product_master_id)
  where variant_key is null and is_active = true;

-- active variant recipe(variant_key not null)도 제품당/키당 1개만
create unique index if not exists ux_cms_bom_recipe_variant_active
  on public.cms_bom_recipe(product_master_id, variant_key)
  where variant_key is not null and is_active = true;

create index if not exists idx_cms_bom_recipe_product
  on public.cms_bom_recipe(product_master_id);

create index if not exists idx_cms_bom_recipe_variant
  on public.cms_bom_recipe(product_master_id, variant_key);

-- recipe line (삭제 금지 -> void)
-- ⚠️ component_part_id는 cms_part_item이 아직 없는 DB에서도 마이그레이션이 진행되도록
-- FK를 "조건부로" 나중에 붙입니다(존재할 때만).
create table if not exists public.cms_bom_recipe_line (
  bom_line_id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.cms_bom_recipe(bom_id),
  line_no int not null,

  component_ref_type public.cms_e_inventory_item_ref_type not null, -- MASTER | PART
  component_master_id uuid references public.cms_master_item(master_id),

  -- ✅ FK 제거(조건부로 아래 DO 블록에서 추가)
  component_part_id uuid,

  qty_per_unit numeric not null check (qty_per_unit > 0),
  unit text not null default 'EA',
  note text,
  meta jsonb not null default '{}'::jsonb,

  is_void boolean not null default false,
  void_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_cms_bom_line_component
    check (
      (component_ref_type = 'MASTER'::public.cms_e_inventory_item_ref_type and component_master_id is not null and component_part_id is null)
      or (component_ref_type = 'PART'::public.cms_e_inventory_item_ref_type and component_part_id is not null and component_master_id is null)
    )
);

create unique index if not exists ux_cms_bom_line_bom_line_no_alive
  on public.cms_bom_recipe_line(bom_id, line_no)
  where is_void = false;

create index if not exists idx_cms_bom_line_bom
  on public.cms_bom_recipe_line(bom_id, line_no);

create index if not exists idx_cms_bom_line_master
  on public.cms_bom_recipe_line(component_master_id)
  where component_master_id is not null;

create index if not exists idx_cms_bom_line_part
  on public.cms_bom_recipe_line(component_part_id)
  where component_part_id is not null;

-- ✅ cms_part_item이 존재할 때만 FK를 부착 (없으면 스킵해서 마이그레이션이 진행되게 함)
do $$
begin
  if to_regclass('public.cms_part_item') is not null then
    begin
      alter table public.cms_bom_recipe_line
        add constraint fk_cms_bom_line_part
        foreign key (component_part_id)
        references public.cms_part_item(part_id);
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- updated_at triggers
do $$ begin
  create trigger trg_cms_bom_recipe_updated_at
  before update on public.cms_bom_recipe
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cms_bom_recipe_line_updated_at
  before update on public.cms_bom_recipe_line
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;
