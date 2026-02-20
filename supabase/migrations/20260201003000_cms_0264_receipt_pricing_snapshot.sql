set search_path = public, pg_temp;
-- =============================================================
-- 0264: Receipt pricing snapshot (currency + FX) and
--       per-shipment allocation/breakdown on receipt_usage
--
-- Why:
-- - Factory issues a receipt (often CNY) at time T0.
-- - Our shipment confirmation happens at time T1.
-- - We want to preserve the factory-issued totals (original currency)
--   and the FX snapshot used for KRW conversion for analysis.
-- - One receipt can be linked to multiple shipments. We need allocation.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Receipt pricing snapshot on cms_receipt_inbox
-- -------------------------------------------------------------
alter table public.cms_receipt_inbox
  add column if not exists total_amount_original numeric,
  add column if not exists fx_rate_to_krw numeric,
  add column if not exists fx_source text,
  add column if not exists fx_observed_at date;
comment on column public.cms_receipt_inbox.total_amount_original is
  'Factory-issued total amount in original currency (snapshot).';
comment on column public.cms_receipt_inbox.fx_rate_to_krw is
  'FX snapshot: KRW per 1 unit of currency_code (used to compute total_amount_krw snapshot).';
comment on column public.cms_receipt_inbox.fx_source is
  'FX source label (e.g., MANUAL, AUTO_TICK).';
comment on column public.cms_receipt_inbox.fx_observed_at is
  'Date when FX was observed (usually issued_at).';
-- Backfill for KRW receipts: original == KRW total
update public.cms_receipt_inbox
set total_amount_original = total_amount_krw
where total_amount_original is null
  and upper(coalesce(currency_code,'KRW')) = 'KRW'
  and total_amount_krw is not null;
-- Best-effort backfill for fx_observed_at from issued_at
update public.cms_receipt_inbox
set fx_observed_at = issued_at
where fx_observed_at is null
  and issued_at is not null;
create index if not exists cms_receipt_inbox_issued_at_idx
  on public.cms_receipt_inbox (issued_at);
create index if not exists cms_receipt_inbox_currency_code_idx
  on public.cms_receipt_inbox (currency_code);
-- -------------------------------------------------------------
-- 2) Allocation / breakdown on cms_receipt_usage
--    (a receipt can be linked to multiple shipments)
-- -------------------------------------------------------------
alter table public.cms_receipt_usage
  add column if not exists allocated_amount_original numeric,
  add column if not exists allocated_amount_krw numeric,
  add column if not exists allocation_method text,
  add column if not exists allocation_note text,

  -- Optional factory breakdown fields for this allocation (shipment-level)
  add column if not exists factory_weight_g numeric,
  add column if not exists factory_labor_basic_amount_original numeric,
  add column if not exists factory_labor_other_amount_original numeric;
comment on column public.cms_receipt_usage.allocated_amount_original is
  'Allocated amount for the referenced entity in original currency (snapshot).';
comment on column public.cms_receipt_usage.allocated_amount_krw is
  'Allocated amount for the referenced entity in KRW (snapshot).';
comment on column public.cms_receipt_usage.allocation_method is
  'Allocation method label (FULL, MANUAL, PROPORTIONAL, REMAINDER, etc).';
comment on column public.cms_receipt_usage.allocation_note is
  'Free-text note about allocation rationale.';
comment on column public.cms_receipt_usage.factory_weight_g is
  'Optional: factory-issued weight sum for this allocation (g).';
comment on column public.cms_receipt_usage.factory_labor_basic_amount_original is
  'Optional: factory-issued basic labor sum for this allocation in original currency.';
comment on column public.cms_receipt_usage.factory_labor_other_amount_original is
  'Optional: factory-issued other labor sum for this allocation in original currency.';
do $$
begin
  alter table public.cms_receipt_usage
    add constraint cms_receipt_usage_allocation_method_chk
    check (allocation_method is null or allocation_method in ('FULL','MANUAL','PROPORTIONAL','REMAINDER'));
exception when duplicate_object then
  null;
end $$;
create index if not exists cms_receipt_usage_entity_idx
  on public.cms_receipt_usage (entity_type, entity_id);
-- Done;
