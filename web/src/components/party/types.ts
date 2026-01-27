export type PartyForm = {
  name: string;
  party_type: "customer" | "vendor";
  phone?: string;
  region?: string;
  address?: string;
  note?: string;
  is_active: boolean;
};

export type PartyTabKey = "basic" | "address" | "contact" | "prefix";
