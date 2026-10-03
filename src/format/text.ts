/**
 * SMS/MMS text budgeting.
 *
 * Telnyx splits long messages into up to 10 parts. The default limit here is a
 * conservative single-send budget; raise it and enable `auto_detect` on the
 * service profile if your account allows concatenated sends.
 */
export const TELNYX_MESSAGE_LIMIT = 1600;

export interface TelnyxTextOptions {
  limit?: number;
}

export interface TelnyxTextResult {
  text: string;
  truncated: boolean;
}

export function truncateTelnyxText(
  text: string,
  options: TelnyxTextOptions = {},
): TelnyxTextResult {
  const limit = options.limit ?? TELNYX_MESSAGE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError("limit must be a positive integer");
  }
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, limit), truncated: true };
}

/** Telnyx rejects an empty `text` for SMS; use a single space for media-only MMS. */
export function telnyxTextOrPlaceholder(text: string): string {
  return text.length > 0 ? text : " ";
}
