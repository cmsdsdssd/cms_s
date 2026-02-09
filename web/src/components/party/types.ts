export type PartyForm = {
  name: string;
  party_type: "customer" | "vendor";
  phone?: string;
  region?: string;
  address?: string;
  note?: string;
  is_active: boolean;
  prefix?: string; // Vendor only
  mask_code?: string; // ReadOnly
};

export type PartyTabKey = "basic" | "address" | "contact" | "prefix";
