import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";

export type PartyRow = {
  party_id: string;
  party_type: "customer" | "vendor";
  name: string;
  phone: string | null;
  region: string | null;
  address: string | null; // summary address
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // AR fields
  balance_krw?: number | null;
  receivable_krw?: number | null;
  credit_krw?: number | null;
  last_activity_at?: string | null;
};

export type PartyAddress = {
  address_id: string;
  party_id: string;
  label: string | null;
  address_text: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Person = {
  person_id: string;
  name: string | null;
  phone: string | null;
  note: string | null;
};

export type PartyPersonLink = {
  party_id: string;
  person_id: string;
  role: string | null;
  is_primary: boolean;
  created_at: string;
  person: Person | null;
};

export type VendorPrefix = {
  prefix: string;
  vendor_party_id: string;
  note: string | null;
  created_at: string;
};

export type PartyDetail = PartyRow & {
  addresses: PartyAddress[];
  links: PartyPersonLink[];
  prefixes: VendorPrefix[];
};

export async function fetchParties(params: {
  type?: string;
  activeOnly?: boolean;
  search?: string;
  region?: string;
  page?: number;
  pageSize?: number;
}) {
  const client = getSchemaClient();
  if (!client) throw new Error("Supabase client not available");

  let query = client
    .from("cms_party")
    .select("*", { count: "exact" });

  if (params.type) {
    query = query.eq("party_type", params.type);
  }

  if (params.activeOnly) {
    query = query.eq("is_active", true);
  }

  if (params.search) {
    query = query.ilike("name", `%${params.search}%`);
  }

  if (params.region) {
    query = query.ilike("region", `%${params.region}%`);
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  if (params.type !== "customer") {
    query = query.order("name", { ascending: true }).range(from, to - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  let enrichedData = (data ?? []) as PartyRow[];

  // For customers, fetch AR info and apply required ordering (balance desc nulls last, name asc)
  if (params.type === "customer" && enrichedData.length > 0) {
    const partyIds = enrichedData.map((p) => p.party_id);
    const { data: arData, error: arError } = await client
      .from(CONTRACTS.views.arPositionByParty)
      .select("party_id, balance_krw, receivable_krw, credit_krw, last_activity_at")
      .in("party_id", partyIds);
    if (arError) throw arError;

    const arMap = new Map((arData ?? []).map((i) => [i.party_id, i]));
    enrichedData = enrichedData.map((p) => ({
      ...p,
      ...arMap.get(p.party_id),
    }));

    enrichedData.sort((a, b) => {
      const balanceA = a.balance_krw ?? Number.NEGATIVE_INFINITY;
      const balanceB = b.balance_krw ?? Number.NEGATIVE_INFINITY;
      if (balanceA !== balanceB) return balanceB - balanceA;
      return a.name.localeCompare(b.name, "ko-KR");
    });

    enrichedData = enrichedData.slice(from, to);
  }

  return { data: enrichedData, count: count ?? enrichedData.length };
}

export async function fetchPartyDetail(partyId: string) {
  const client = getSchemaClient();
  if (!client) throw new Error("Supabase client not available");

  const [partyRes, addressRes, linkRes, prefixRes] = await Promise.all([
    client.from("cms_party").select("*").eq("party_id", partyId).single(),
    client
      .from("cms_party_address")
      .select("*")
      .eq("party_id", partyId)
      .order("is_default", { ascending: false })
      .order("created_at"),
    client
      .from("cms_party_person_link")
      .select("*, person:cms_person(*)")
      .eq("party_id", partyId)
      .order("is_primary", { ascending: false }),
    client
      .from("cms_vendor_prefix_map")
      .select("*")
      .eq("vendor_party_id", partyId)
      .order("prefix"),
  ]);

  if (partyRes.error) throw partyRes.error;

  let arInfo = {};
  if (partyRes.data.party_type === "customer") {
    const { data: arData } = await client
      .from(CONTRACTS.views.arPositionByParty)
      .select("balance_krw, receivable_krw, credit_krw, last_activity_at")
      .eq("party_id", partyId)
      .single();
    if (arData) arInfo = arData;
  }

  const addresses = addressRes.error ? [] : addressRes.data ?? [];
  const links = linkRes.error ? [] : linkRes.data ?? [];
  const prefixes = prefixRes.error ? [] : prefixRes.data ?? [];

  return {
    ...partyRes.data,
    ...arInfo,
    addresses,
    links,
    prefixes,
  } as PartyDetail;
}
