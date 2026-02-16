export const VENDOR_IMMEDIATE_SETTLE_TAG = "[SYS:VENDOR_IMMEDIATE_SETTLE]";

export function hasVendorImmediateSettleTag(note?: string | null): boolean {
  if (!note) return false;
  return note.includes(VENDOR_IMMEDIATE_SETTLE_TAG);
}

export function stripVendorImmediateSettleTag(note?: string | null): string {
  if (!note) return "";
  return note
    .split(VENDOR_IMMEDIATE_SETTLE_TAG)
    .join("")
    .replace(/\s{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function applyVendorImmediateSettleTag(note: string, enabled: boolean): string {
  const cleanNote = stripVendorImmediateSettleTag(note);
  if (!enabled) return cleanNote;
  return cleanNote ? `${cleanNote}\n${VENDOR_IMMEDIATE_SETTLE_TAG}` : VENDOR_IMMEDIATE_SETTLE_TAG;
}
