begin;

create table if not exists public.cms_shipment_override_log (
  override_log_id uuid primary key default gen_random_uuid(),
  shipment_id uuid,
  shipment_line_id uuid,
  order_line_id uuid,
  event_type text not null,
  override_scope text not null default 'MANUAL_LABOR',
  reason_code text not null,
  reason_detail text,
  actor_person_id text,
  pricing_mode text,
  is_manual_total_override boolean not null default false,
  is_manual_labor boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cms_shipment_override_log_event_type_check
    check (event_type in ('SAVE', 'FINAL_CONFIRM')),
  constraint cms_shipment_override_log_reason_code_check
    check (reason_code in ('FACTORY_MISTAKE', 'RECEIPT_DIFF', 'POLICY_EXCEPTION', 'CUSTOMER_REQUEST', 'OTHER'))
);

create index if not exists idx_cms_shipment_override_log_line_created
  on public.cms_shipment_override_log (shipment_line_id, created_at desc);

create index if not exists idx_cms_shipment_override_log_shipment_created
  on public.cms_shipment_override_log (shipment_id, created_at desc);

grant insert, select on public.cms_shipment_override_log to service_role;

commit;
