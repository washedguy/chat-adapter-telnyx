import type { TelnyxAddress } from "../api";

/** Read the E.164 address out of a Telnyx address object, when present. */
export function phoneNumberOf(
  address: TelnyxAddress | null | undefined,
): string | undefined {
  const value = address?.phone_number;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Resolve recipient addresses from a `to` field. Telnyx sends SMS/MMS/RCS
 * recipients as an array, and WhatsApp recipients as a bare string. Duplicates
 * are removed so a repeated address cannot produce a group thread.
 */
export function phoneNumbers(
  to: TelnyxAddress[] | string | null | undefined,
): string[] {
  if (typeof to === "string") {
    return to.length > 0 ? [to] : [];
  }
  if (!Array.isArray(to)) {
    return [];
  }
  const addresses: string[] = [];
  for (const entry of to) {
    const value = phoneNumberOf(entry);
    if (value && !addresses.includes(value)) {
      addresses.push(value);
    }
  }
  return addresses;
}
