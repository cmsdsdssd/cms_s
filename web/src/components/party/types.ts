export type PartyForm = {
  name: string;
  party_type: "customer" | "vendor";
  phone?: string;
  region?: string;
  address?: string;
  note?: string;
  vendor_immediate_settle?: boolean;
  is_active: boolean;
  prefix?: string; // Vendor only
  mask_code?: string; // ReadOnly
};

export type PartyTabKey = "basic" | "address" | "contact" | "prefix";
