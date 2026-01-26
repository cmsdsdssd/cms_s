-- 0003: indexes

create index if not exists idx_cms_party_type_name on cms_party(party_type, name);

create index if not exists idx_cms_order_customer_status on cms_order_line(customer_party_id, status);
create index if not exists idx_cms_order_model_name on cms_order_line(model_name);
create index if not exists idx_cms_order_created_at on cms_order_line(created_at desc);

create index if not exists idx_cms_repair_customer_status on cms_repair_line(customer_party_id, status);
create index if not exists idx_cms_repair_received_at on cms_repair_line(received_at desc);

create index if not exists idx_cms_ship_customer_status on cms_shipment_header(customer_party_id, status);
create index if not exists idx_cms_ship_ship_date on cms_shipment_header(ship_date desc);

create index if not exists idx_cms_shipline_shipid on cms_shipment_line(shipment_id);
create index if not exists idx_cms_shipline_orderline on cms_shipment_line(order_line_id);
create index if not exists idx_cms_shipline_repairline on cms_shipment_line(repair_line_id);

create index if not exists idx_cms_ar_party_occurred on cms_ar_ledger(party_id, occurred_at desc);

create index if not exists idx_cms_tick_symbol_time on cms_market_tick(symbol, observed_at desc);
