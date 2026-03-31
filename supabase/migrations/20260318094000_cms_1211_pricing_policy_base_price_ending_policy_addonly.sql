alter table pricing_policy
  add column if not exists base_price_ending_policy_json jsonb;
