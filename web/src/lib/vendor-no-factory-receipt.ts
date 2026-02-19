export const VENDOR_NO_FACTORY_RECEIPT_TAG = "[SYS:VENDOR_NO_FACTORY_RECEIPT]";

export function hasVendorNoFactoryReceiptTag(note?: string | null): boolean {
  if (!note) return false;
  return note.includes(VENDOR_NO_FACTORY_RECEIPT_TAG);
}

export function stripVendorNoFactoryReceiptTag(note?: string | null): string {
  if (!note) return "";
  return note
    .split(VENDOR_NO_FACTORY_RECEIPT_TAG)
    .join("")
    .replace(/\s{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function applyVendorNoFactoryReceiptTag(note: string, enabled: boolean): string {
  const cleanNote = stripVendorNoFactoryReceiptTag(note);
  if (!enabled) return cleanNote;
  return cleanNote ? `${cleanNote}\n${VENDOR_NO_FACTORY_RECEIPT_TAG}` : VENDOR_NO_FACTORY_RECEIPT_TAG;
}
