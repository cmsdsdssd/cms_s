set search_path = public, pg_temp;

-- cms_1301 already creates the canonical scheduler lease RPCs used by the app.
-- Additional overloads make PostgREST RPC resolution ambiguous for claim and are
-- not needed for release because the existing signature already matches the
-- runtime call shape.
-- Keep this migration as a no-op so fresh environments stay aligned with remote
-- history without reintroducing the ambiguity.

do $$
begin
  null;
end $$;
