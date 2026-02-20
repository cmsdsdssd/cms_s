-- 0002: base tables

-- 1) person
create table if not exists cms_person (
  person_id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 2) party
create table if not exists cms_party (
  party_id uuid primary key default gen_random_uuid(),
  party_type cms_e_party_type not null,
  name text not null,
  phone text,
  region text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 3) party-person link (N:M)
create table if not exists cms_party_person_link (
  party_id uuid not null references cms_party(party_id) on delete cascade,
  person_id uuid not null references cms_person(person_id) on delete cascade,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (party_id, person_id)
);
-- 4) party address
create table if not exists cms_party_address (
  address_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references cms_party(party_id) on delete cascade,
  label text,
  address_text text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 5) vendor prefix map (공장이니셜 → vendor_party_id)
create table if not exists cms_vendor_prefix_map (
  prefix text primary key,
  vendor_party_id uuid not null references cms_party(party_id),
  note text,
  created_at timestamptz not null default now()
);
-- 6) master item
create table if not exists cms_master_item (
  master_id uuid primary key default gen_random_uuid(),
  model_name text not null unique,
  vendor_party_id uuid references cms_party(party_id),
  category_code cms_e_category_code not null,
  material_code_default cms_e_material_code,
  weight_default_g numeric,
  deduction_weight_default_g numeric not null default 0,

  center_qty_default int not null default 0,
  sub1_qty_default int not null default 0,
  sub2_qty_default int not null default 0,

  -- labor sell
  labor_base_sell numeric not null default 0,
  labor_center_sell numeric not null default 0,
  labor_sub1_sell numeric not null default 0,
  labor_sub2_sell numeric not null default 0,
  labor_bead_sell numeric not null default 0,

  -- labor cost
  labor_base_cost numeric not null default 0,
  labor_center_cost numeric not null default 0,
  labor_sub1_cost numeric not null default 0,
  labor_sub2_cost numeric not null default 0,
  labor_bead_cost numeric not null default 0,

  -- plating defaults
  plating_price_sell_default numeric not null default 0,
  plating_price_cost_default numeric not null default 0,

  -- band mode
  labor_profile_mode text not null default 'MANUAL', -- MANUAL | BAND
  labor_band_code text,

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 7) labor band rule
create table if not exists cms_labor_band_rule (
  band_id uuid primary key default gen_random_uuid(),
  category_code cms_e_category_code not null,
  band_code text not null,
  band_rank int not null,
  effective_from date not null,
  is_active boolean not null default true,
  note text,

  -- labor sell
  labor_base_sell numeric not null default 0,
  labor_center_sell numeric not null default 0,
  labor_sub1_sell numeric not null default 0,
  labor_sub2_sell numeric not null default 0,
  labor_bead_sell numeric not null default 0,

  -- labor cost
  labor_base_cost numeric not null default 0,
  labor_center_cost numeric not null default 0,
  labor_sub1_cost numeric not null default 0,
  labor_sub2_cost numeric not null default 0,
  labor_bead_cost numeric not null default 0,

  created_at timestamptz not null default now()
);
-- 8) plating variant
create table if not exists cms_plating_variant (
  plating_variant_id uuid primary key default gen_random_uuid(),
  plating_type cms_e_plating_type not null,
  color_code text,
  thickness_code text,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- 9) plating price rule (B + C 동시 지원)
create table if not exists cms_plating_price_rule (
  rule_id uuid primary key default gen_random_uuid(),
  plating_variant_id uuid not null references cms_plating_variant(plating_variant_id),
  category_code cms_e_category_code,
  material_code cms_e_material_code,
  effective_from date not null default current_date,
  is_active boolean not null default true,
  priority int not null default 100,

  -- charge: fixed + per_g (둘 다 가능)
  sell_fixed_krw numeric not null default 0,
  cost_fixed_krw numeric not null default 0,
  sell_per_g_krw numeric not null default 0,
  cost_per_g_krw numeric not null default 0,

  note text,
  created_at timestamptz not null default now()
);
-- 10) market tick
create table if not exists cms_market_tick (
  tick_id uuid primary key default gen_random_uuid(),
  symbol cms_e_market_symbol not null,
  price numeric not null,
  observed_at timestamptz not null,
  source text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- 11) order line (라인 중심)
create table if not exists cms_order_line (
  order_line_id uuid primary key default gen_random_uuid(),
  customer_party_id uuid not null references cms_party(party_id),
  model_name text not null,
  model_name_raw text,
  suffix text not null,
  color text not null,
  size text,
  qty int not null default 1 check (qty > 0),

  is_plated boolean not null default false,
  plating_variant_id uuid references cms_plating_variant(plating_variant_id),

  requested_due_date date,
  priority_code cms_e_priority_code not null default 'NORMAL',

  memo text,
  status cms_e_order_status not null default 'ORDER_PENDING',

  vendor_party_id_guess uuid references cms_party(party_id),
  matched_master_id uuid references cms_master_item(master_id),
  match_state cms_e_match_state not null default 'UNMATCHED',

  source_channel text,
  correlation_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 12) repair line
create table if not exists cms_repair_line (
  repair_line_id uuid primary key default gen_random_uuid(),
  customer_party_id uuid not null references cms_party(party_id),
  received_at date not null,

  model_name text,
  model_name_raw text,
  suffix text,
  material_code cms_e_material_code,
  color text,
  qty int not null default 1 check (qty > 0),
  weight_received_g numeric,

  is_paid boolean not null default false,
  repair_fee_krw numeric not null default 0,

  is_plated boolean not null default false,
  plating_variant_id uuid references cms_plating_variant(plating_variant_id),

  requested_due_date date,
  priority_code cms_e_priority_code not null default 'NORMAL',

  memo text,
  status cms_e_repair_status not null default 'RECEIVED',

  source_channel text,
  correlation_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 13) shipment header
create table if not exists cms_shipment_header (
  shipment_id uuid primary key default gen_random_uuid(),
  customer_party_id uuid not null references cms_party(party_id),
  ship_date date,
  ship_to_address_id uuid references cms_party_address(address_id),
  memo text,
  status cms_e_shipment_status not null default 'DRAFT',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 14) shipment line (스냅샷 잠금)
create table if not exists cms_shipment_line (
  shipment_line_id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references cms_shipment_header(shipment_id) on delete cascade,

  -- refs
  order_line_id uuid references cms_order_line(order_line_id),
  repair_line_id uuid references cms_repair_line(repair_line_id),

  -- ad-hoc
  ad_hoc_mode text not null default 'NONE', -- NONE | MODEL_ONLY | AMOUNT_ONLY
  ad_hoc_category_code cms_e_category_code,
  ad_hoc_name text,

  -- snapshot item
  category_code cms_e_category_code,
  model_name text,
  suffix text,
  color text,
  size text,
  qty int not null default 1 check (qty > 0),

  -- weight snapshot
  measured_weight_g numeric,
  deduction_weight_g numeric not null default 0,
  net_weight_g numeric,

  -- pricing mode
  pricing_mode cms_e_pricing_mode not null default 'RULE',
  unit_price_krw numeric,
  unit_price_includes_plating boolean not null default true,
  manual_total_amount_krw numeric,

  -- tick snapshot
  gold_tick_id uuid references cms_market_tick(tick_id),
  silver_tick_id uuid references cms_market_tick(tick_id),
  gold_tick_krw_per_g numeric,
  silver_tick_krw_per_g numeric,
  silver_adjust_factor numeric not null default 1.2,

  -- plating snapshot
  is_plated boolean not null default false,
  plating_variant_id uuid references cms_plating_variant(plating_variant_id),
  plating_amount_sell_krw numeric not null default 0,
  plating_amount_cost_krw numeric not null default 0,

  -- material/labor snapshot
  material_code cms_e_material_code,
  material_amount_sell_krw numeric not null default 0,
  material_amount_cost_krw numeric not null default 0,

  labor_base_sell_krw numeric not null default 0,
  labor_center_sell_krw numeric not null default 0,
  labor_sub1_sell_krw numeric not null default 0,
  labor_sub2_sell_krw numeric not null default 0,
  labor_bead_sell_krw numeric not null default 0,
  labor_total_sell_krw numeric not null default 0,

  labor_base_cost_krw numeric not null default 0,
  labor_center_cost_krw numeric not null default 0,
  labor_sub1_cost_krw numeric not null default 0,
  labor_sub2_cost_krw numeric not null default 0,
  labor_bead_cost_krw numeric not null default 0,
  labor_total_cost_krw numeric not null default 0,

  repair_fee_krw numeric not null default 0,

  total_amount_sell_krw numeric not null default 0,
  total_amount_cost_krw numeric not null default 0,

  is_priced_final boolean not null default false,
  priced_at timestamptz,

  price_calc_trace jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 15) payment header + tender lines
create table if not exists cms_payment_header (
  payment_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references cms_party(party_id),
  paid_at timestamptz not null,
  memo text,
  total_amount_krw numeric not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists cms_payment_tender_line (
  tender_line_id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references cms_payment_header(payment_id) on delete cascade,
  method cms_e_payment_method not null,
  amount_krw numeric not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- 16) return line
create table if not exists cms_return_line (
  return_line_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references cms_party(party_id),
  shipment_line_id uuid not null references cms_shipment_line(shipment_line_id),
  return_qty int not null default 1 check (return_qty > 0),
  auto_return_amount_krw numeric not null default 0,
  final_return_amount_krw numeric not null default 0,
  reason text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- 17) AR ledger
create table if not exists cms_ar_ledger (
  ar_ledger_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references cms_party(party_id),
  occurred_at timestamptz not null,
  entry_type cms_e_ar_entry_type not null,
  amount_krw numeric not null, -- + 증가 / - 감소

  shipment_id uuid references cms_shipment_header(shipment_id),
  shipment_line_id uuid references cms_shipment_line(shipment_line_id),
  payment_id uuid references cms_payment_header(payment_id),
  return_line_id uuid references cms_return_line(return_line_id),

  memo text,
  created_at timestamptz not null default now()
);
-- 18) status event
create table if not exists cms_status_event (
  event_id uuid primary key default gen_random_uuid(),
  entity_type cms_e_entity_type not null,
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  occurred_at timestamptz not null,
  actor_person_id uuid references cms_person(person_id),
  reason text,
  correlation_id uuid
);
-- 19) decision log
create table if not exists cms_decision_log (
  decision_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  decision_kind text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  actor_person_id uuid references cms_person(person_id),
  occurred_at timestamptz not null default now(),
  note text
);
