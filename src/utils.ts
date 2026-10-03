/** Telnyx messaging profile IDs are UUIDs; phone senders are E.164 or short codes. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acknowledge a webhook quickly; Telnyx requires a 2xx within two seconds. */
export function okResponse(): Response {
  return new Response("OK", { status: 200 });
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Route a sender to the correct Telnyx send field: messaging-profile IDs go in
 * `messaging_profile_id`, everything else becomes `from`.
 */
export function senderFields(sender: string): {
  from?: string;
  messagingProfileId?: string;
} {
  return isUuid(sender) ? { messagingProfileId: sender } : { from: sender };
}
