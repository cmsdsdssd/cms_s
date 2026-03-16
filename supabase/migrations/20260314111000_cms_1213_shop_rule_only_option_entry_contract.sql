set search_path = public, pg_temp;

create table if not exists public.channel_option_material_registry_v1 (
  material_registry_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  material_code text not null,
  material_label text not null,
  material_type text not null,
  tick_source text not null,
  factor_ref text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, material_code)
);

create table if not exists public.channel_option_color_bucket_v1 (
  color_bucket_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  bucket_code text not null,
  bucket_label text not null,
  base_cost_krw integer not null check (base_cost_krw >= 0),
  sell_delta_krw integer not null check (sell_delta_krw >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, bucket_code)
);

create table if not exists public.channel_option_addon_master_v1 (
  addon_master_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  addon_code text not null,
  addon_name text not null,
  base_amount_krw integer not null check (base_amount_krw >= 0),
  extra_delta_krw integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, addon_code)
);

create table if not exists public.channel_option_notice_code_v1 (
  notice_code_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  notice_code text not null,
  notice_name text not null,
  display_text text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, notice_code)
);

create table if not exists public.channel_option_other_reason_code_v1 (
  other_reason_code_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  reason_code text not null,
  reason_name text not null,
  display_text text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, reason_code)
);

create table if not exists public.channel_product_option_entry_mapping_v1 (
  option_entry_mapping_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel_account(channel_id) on delete cascade,
  external_product_no text not null,
  option_name text not null,
  option_value text not null,
  category_key text not null,
  material_registry_code text,
  weight_g numeric(12,3),
  combo_code text,
  color_bucket_id uuid references public.channel_option_color_bucket_v1(color_bucket_id) on delete restrict,
  decor_master_id uuid references public.cms_master_item(master_item_id) on delete restrict,
  addon_master_id uuid references public.channel_option_addon_master_v1(addon_master_id) on delete restrict,
  other_reason_code text,
  explicit_delta_krw integer,
  notice_code text,
  label_snapshot text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, external_product_no, option_name, option_value),
  constraint channel_product_option_entry_mapping_v1_category_check
    check (category_key in ('MATERIAL', 'SIZE', 'COLOR_PLATING', 'DECOR', 'ADDON', 'OTHER', 'NOTICE')),
  constraint channel_product_option_entry_mapping_v1_payload_check
    check (
      (category_key = 'MATERIAL'
        and material_registry_code is not null
        and weight_g is null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is null
        and addon_master_id is null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is null)
      or
      (category_key = 'SIZE'
        and material_registry_code is null
        and weight_g is not null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is null
        and addon_master_id is null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is null)
      or
      (category_key = 'COLOR_PLATING'
        and material_registry_code is null
        and weight_g is null
        and combo_code is not null
        and color_bucket_id is not null
        and decor_master_id is null
        and addon_master_id is null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is null)
      or
      (category_key = 'DECOR'
        and material_registry_code is null
        and weight_g is null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is not null
        and addon_master_id is null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is null)
      or
      (category_key = 'ADDON'
        and material_registry_code is null
        and weight_g is null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is null
        and addon_master_id is not null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is null)
      or
      (category_key = 'OTHER'
        and material_registry_code is null
        and weight_g is null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is null
        and addon_master_id is null
        and other_reason_code is not null
        and explicit_delta_krw is not null
        and notice_code is null)
      or
      (category_key = 'NOTICE'
        and material_registry_code is null
        and weight_g is null
        and combo_code is null
        and color_bucket_id is null
        and decor_master_id is null
        and addon_master_id is null
        and other_reason_code is null
        and explicit_delta_krw is null
        and notice_code is not null)
    )
);

create table if not exists public.channel_product_option_entry_mapping_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  option_entry_mapping_id uuid,
  channel_id uuid not null,
  external_product_no text not null,
  option_name text not null,
  option_value text not null,
  action text not null,
  changed_by text,
  change_reason text,
  before_payload jsonb,
  after_payload jsonb,
  affected_products_count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint channel_product_option_entry_mapping_audit_v1_action_check
    check (action in ('INSERT', 'UPDATE', 'SOFT_DELETE'))
);

create table if not exists public.channel_option_registry_change_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  registry_kind text not null,
  registry_key text not null,
  action text not null,
  changed_by text,
  change_reason text,
  before_payload jsonb,
  after_payload jsonb,
  affected_products_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint channel_option_registry_change_audit_v1_action_check
   
    check (action in ('INSERT', 'UPDATE', 'SOFT_DELETE'))
);

create table if not exists public.channel_product_option_recompute_queue_v1 (
  queue_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  external_product_no text not null,
  enqueue_reason text not null,
  source_kind text not null,
  source_key text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_product_option_recompute_queue_v1_status_check
    check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'))
);

create index if not exists idx_channel_product_option_entry_mapping_v1_product
  on public.channel_product_option_entry_mapping_v1(channel_id, external_product_no, is_active, category_key);
create index if not exists idx_channel_product_option_entry_mapping_audit_v1_product
  on public.channel_product_option_entry_mapping_audit_v1(channel_id, external_product_no, created_at desc);
create index if not exists idx_channel_product_option_recompute_queue_v1_pending
  on public.channel_product_option_recompute_queue_v1(status, created_at);
