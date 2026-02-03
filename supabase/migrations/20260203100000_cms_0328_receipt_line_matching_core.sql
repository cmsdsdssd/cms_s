set search_path = public, pg_temp;

-- =========================================================
-- Receipt Line Matching (Workbench) - Core
--
-- V1 핵심:
--   - 영수증 라인(JSONB) -> 후보 추천 -> 사람 확정 -> 즉시 shipment draft 생성
--
-- 결제/상계(AR/AP) SoT 규율 (프로젝트 가이드 반영):
--   - 본 워크벤치 기능은 AR/AP 결제 SoT를 새로 만들지 않는다.
--   - 잔액/완납 판정은 기존 AR 구조(cms_ar_payment_alloc / consume)에서 파생되는 뷰/로그를 SoT로 유지한다.
--   - 본 테이블의 금액/공임/총액 필드는 "영수증 원본 스냅샷(secondary)" 용도이며,
--     AR/AP 잔액 계산 SoT로 직접 사용하지 않는다.
-- =========================================================

-- 0) enum
DO $$
BEGIN
  CREATE TYPE public.cms_e_receipt_line_match_status AS ENUM ('SUGGESTED','CONFIRMED','REJECTED','CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1) columns
ALTER TABLE public.cms_shipment_line
  ADD COLUMN IF NOT EXISTS purchase_receipt_line_uuid uuid;

ALTER TABLE public.cms_order_line
  ADD COLUMN IF NOT EXISTS vendor_seq_no int;

CREATE INDEX IF NOT EXISTS idx_cms_order_line_vendor_seq_no
  ON public.cms_order_line(vendor_seq_no);

CREATE INDEX IF NOT EXISTS idx_cms_shipment_line_purchase_receipt_line_uuid
  ON public.cms_shipment_line(purchase_receipt_line_uuid)
  WHERE purchase_receipt_line_uuid IS NOT NULL;

-- 2) receipt line match table
-- NOTE: selected_factory_* fields are snapshots of factory receipt numbers (secondary). Do NOT treat as AR/AP SoT.
CREATE TABLE IF NOT EXISTS public.cms_receipt_line_match (
  receipt_id uuid NOT NULL REFERENCES public.cms_receipt_inbox(receipt_id) ON DELETE CASCADE,
  receipt_line_uuid uuid NOT NULL,
  order_line_id uuid NOT NULL REFERENCES public.cms_order_line(order_line_id) ON DELETE CASCADE,

  status public.cms_e_receipt_line_match_status NOT NULL DEFAULT 'SUGGESTED',
  match_score numeric NOT NULL DEFAULT 0,
  match_reason jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- when confirmed, shipment draft is created immediately
  shipment_id uuid REFERENCES public.cms_shipment_header(shipment_id),
  shipment_line_id uuid REFERENCES public.cms_shipment_line(shipment_line_id),

  -- selected/validated values at confirm time (UI uses 2dp; this is NOT gold/silver commodity grams)
  selected_weight_g numeric(12,2),
  selected_material_code public.cms_e_material_code,

  -- factory snapshot fields (secondary; do not use for AR/AP balance SoT)
  selected_factory_labor_basic_cost_krw numeric,
  selected_factory_labor_other_cost_krw numeric,
  selected_factory_total_cost_krw numeric,

  overridden_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,

  suggested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.cms_person(person_id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (receipt_id, receipt_line_uuid, order_line_id)
);

-- idempotent re-run safety: enforce selected_weight_g scale
DO $$
BEGIN
  IF to_regclass('public.cms_receipt_line_match') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.cms_receipt_line_match
        ALTER COLUMN selected_weight_g TYPE numeric(12,2)
        USING round(selected_weight_g::numeric, 2);
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cms_receipt_line_match_receipt
  ON public.cms_receipt_line_match(receipt_id, receipt_line_uuid);

CREATE INDEX IF NOT EXISTS idx_cms_receipt_line_match_order
  ON public.cms_receipt_line_match(order_line_id);

CREATE INDEX IF NOT EXISTS idx_cms_receipt_line_match_status
  ON public.cms_receipt_line_match(status);

-- only 1 confirmed per receipt line
CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_receipt_line_confirmed_per_receipt_line
  ON public.cms_receipt_line_match(receipt_id, receipt_line_uuid)
  WHERE status = 'CONFIRMED';

-- only 1 confirmed per order line
CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_receipt_line_confirmed_per_order_line
  ON public.cms_receipt_line_match(order_line_id)
  WHERE status = 'CONFIRMED';

DO $$
BEGIN
  CREATE TRIGGER trg_cms_receipt_line_match_updated_at
  BEFORE UPDATE ON public.cms_receipt_line_match
  FOR EACH ROW EXECUTE FUNCTION public.cms_fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) view: flatten receipt_pricing_snapshot.line_items -> rowset
DROP VIEW IF EXISTS public.cms_v_receipt_line_items_flat_v1 CASCADE;

CREATE VIEW public.cms_v_receipt_line_items_flat_v1 AS
WITH snap AS (
  SELECT
    r.receipt_id,
    r.vendor_party_id,
    vp.name AS vendor_name,
    r.received_at,
    r.issued_at,
    r.status AS receipt_status,
    r.currency_code,
    p.total_amount,
    p.total_amount_krw,
    p.line_items
  FROM public.cms_receipt_inbox r
  LEFT JOIN public.cms_party vp ON vp.party_id = r.vendor_party_id
  LEFT JOIN public.cms_receipt_pricing_snapshot p ON p.receipt_id = r.receipt_id
)
SELECT
  s.receipt_id,
  s.vendor_party_id,
  s.vendor_name,
  s.received_at,
  s.issued_at,
  s.receipt_status,
  s.currency_code,
  s.total_amount,
  s.total_amount_krw,

  COALESCE(
    CASE
      WHEN (t.li ? 'line_uuid')
       AND (t.li->>'line_uuid') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (t.li->>'line_uuid')::uuid
      ELSE NULL
    END,
    (
      substring(md5(s.receipt_id::text || ':' || t.ord::text), 1, 8) || '-' ||
      substring(md5(s.receipt_id::text || ':' || t.ord::text), 9, 4) || '-' ||
      substring(md5(s.receipt_id::text || ':' || t.ord::text), 13, 4) || '-' ||
      substring(md5(s.receipt_id::text || ':' || t.ord::text), 17, 4) || '-' ||
      substring(md5(s.receipt_id::text || ':' || t.ord::text), 21, 12)
    )::uuid
  ) AS receipt_line_uuid,

  NULLIF(TRIM(COALESCE(t.li->>'model_name', t.li->>'model', '')), '') AS model_name,
  NULLIF(TRIM(COALESCE(t.li->>'size', '')), '') AS size,
  NULLIF(TRIM(COALESCE(t.li->>'color', '')), '') AS color,

  NULLIF(TRIM(COALESCE(t.li->>'customer_factory_code', t.li->>'customer_code', t.li->>'customer_mask_code', '')), '') AS customer_factory_code,

  CASE
    WHEN NULLIF(TRIM(COALESCE(t.li->>'material_code', t.li->>'material', '')), '') IN ('14','18','24','925','999','00')
      THEN (NULLIF(TRIM(COALESCE(t.li->>'material_code', t.li->>'material', '')), ''))::public.cms_e_material_code
    ELSE NULL
  END AS material_code,

  CASE
    WHEN (t.li->>'qty') ~ '^[0-9]+$' THEN (t.li->>'qty')::int
    ELSE 1
  END AS qty,

  CASE
    WHEN (t.li->>'weight_g') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ROUND((t.li->>'weight_g')::numeric, 2)
    ELSE NULL
  END AS factory_weight_g,

  CASE
    WHEN (t.li->>'labor_basic_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ROUND((t.li->>'labor_basic_cost_krw')::numeric, 0)
    ELSE NULL
  END AS factory_labor_basic_cost_krw,

  CASE
    WHEN (t.li->>'labor_other_cost_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ROUND((t.li->>'labor_other_cost_krw')::numeric, 0)
    ELSE NULL
  END AS factory_labor_other_cost_krw,

  CASE
    WHEN (t.li->>'total_amount_krw') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ROUND((t.li->>'total_amount_krw')::numeric, 0)
    ELSE NULL
  END AS factory_total_amount_krw,

  NULLIF(TRIM(COALESCE(t.li->>'remark', t.li->>'memo', t.li->>'note', '')), '') AS remark,

  CASE
    WHEN (t.li->>'vendor_seq_no') ~ '^\d+$' THEN (t.li->>'vendor_seq_no')::int
    WHEN NULLIF(TRIM(COALESCE(t.li->>'remark', t.li->>'memo', t.li->>'note', '')), '') IS NOT NULL
      THEN NULLIF(SUBSTRING(TRIM(COALESCE(t.li->>'remark', t.li->>'memo', t.li->>'note', '')) FROM '(\d{1,4})'), '')::int
    ELSE NULL
  END AS vendor_seq_no,

  t.li AS line_item_json
FROM snap s
LEFT JOIN LATERAL jsonb_array_elements(COALESCE(s.line_items, '[]'::jsonb)) WITH ORDINALITY AS t(li, ord) ON TRUE;

-- 4) reconciliation / worklists
-- 4-1) receipt lines with no CONFIRMED match
DROP VIEW IF EXISTS public.cms_v_receipt_line_unlinked_v1 CASCADE;
CREATE VIEW public.cms_v_receipt_line_unlinked_v1
with (security_invoker = true)
as
select
  l.receipt_id,
  l.receipt_line_uuid,
  l.vendor_party_id,
  l.vendor_name,
  l.issued_at,
  l.model_name,
  l.material_code,
  l.factory_weight_g,
  l.vendor_seq_no,
  l.customer_factory_code,
  l.remark
from public.cms_v_receipt_line_items_flat_v1 l
left join public.cms_receipt_line_match m
  on m.receipt_id = l.receipt_id
 and m.receipt_line_uuid = l.receipt_line_uuid
 and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
where m.order_line_id is null;

-- 4-2) link integrity check: confirmed match but shipment_line linkage is missing/broken
DROP VIEW IF EXISTS public.cms_v_receipt_line_link_integrity_v1 CASCADE;
CREATE VIEW public.cms_v_receipt_line_link_integrity_v1
with (security_invoker = true)
as
select
  m.receipt_id,
  m.receipt_line_uuid,
  m.order_line_id,
  m.shipment_id,
  m.shipment_line_id,
  m.confirmed_at,
  sl.purchase_receipt_id as shipment_purchase_receipt_id,
  sl.purchase_receipt_line_uuid as shipment_purchase_receipt_line_uuid,
  sl.shipment_id as shipment_line_shipment_id
from public.cms_receipt_line_match m
left join public.cms_shipment_line sl on sl.shipment_line_id = m.shipment_line_id
where m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  and (
    sl.shipment_line_id is null
    or sl.purchase_receipt_id is distinct from m.receipt_id
    or sl.purchase_receipt_line_uuid is distinct from m.receipt_line_uuid
  );

-- 4-3) shipment confirmed but AR invoice missing (AR SoT is alloc/consume; this is just "missing link" detector)
DROP VIEW IF EXISTS public.cms_v_shipment_line_missing_ar_invoice_v1 CASCADE;
CREATE VIEW public.cms_v_shipment_line_missing_ar_invoice_v1
with (security_invoker = true)
as
select
  sh.shipment_id,
  sh.customer_party_id,
  sh.status as shipment_status,
  sh.ship_date,
  sl.shipment_line_id,
  sl.order_line_id,
  sl.total_amount_sell_krw,
  sl.labor_total_sell_krw,
  sl.material_amount_sell_krw,
  sl.material_code,
  sl.net_weight_g
from public.cms_shipment_header sh
join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
left join public.cms_ar_invoice ar on ar.shipment_line_id = sl.shipment_line_id
where sh.status = 'CONFIRMED'::public.cms_e_shipment_status
  and ar.ar_id is null;

-- 5) grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_receipt_line_match TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_receipt_line_match TO service_role;

GRANT SELECT ON public.cms_v_receipt_line_items_flat_v1 TO authenticated;
GRANT SELECT ON public.cms_v_receipt_line_items_flat_v1 TO service_role;

GRANT SELECT ON public.cms_v_receipt_line_unlinked_v1 TO authenticated;
GRANT SELECT ON public.cms_v_receipt_line_unlinked_v1 TO service_role;

GRANT SELECT ON public.cms_v_receipt_line_link_integrity_v1 TO authenticated;
GRANT SELECT ON public.cms_v_receipt_line_link_integrity_v1 TO service_role;

GRANT SELECT ON public.cms_v_shipment_line_missing_ar_invoice_v1 TO authenticated;
GRANT SELECT ON public.cms_v_shipment_line_missing_ar_invoice_v1 TO service_role;
