/**
 * Telnyx Messaging API resource types.
 *
 * These mirror the JSON shapes returned by the Telnyx v2 API and embedded in
 * webhook payloads. Unknown fields are preserved through index signatures so
 * handlers can still read raw data the adapter does not model.
 */

/** A credential value, or a function that resolves it lazily (e.g. from a vault). */
export type TelnyxCredential = string | (() => Promise<string> | string);

/** Injectable fetch implementation, primarily for tests. */
export type TelnyxFetch = typeof fetch;

export interface TelnyxApiOptions {
  /** Override the API base URL. Defaults to `https://api.telnyx.com/v2`. */
  apiBaseUrl?: string;
  /** Telnyx API key (bearer token). Falls back to `TELNYX_API_KEY`. */
  apiKey?: TelnyxCredential;
  /** Injectable fetch implementation. */
  fetch?: TelnyxFetch;
}

/** One address entry in a Telnyx message's `from`, `to`, or `cc` field. */
export interface TelnyxAddress {
  agent_id?: string;
  agent_name?: string;
  carrier?: string;
  line_type?: string;
  phone_number?: string;
  status?: string;
  [key: string]: unknown;
}

/** One media entry on a Telnyx message. */
export interface TelnyxMediaResource {
  content_type?: string | null;
  /** Older inbound payloads use `hash_sha256`; outbound uses `sha256`. */
  hash_sha256?: string | null;
  sha256?: string | null;
  size?: number | null;
  url?: string;
  [key: string]: unknown;
}

export interface TelnyxMessageError {
  code?: string;
  detail?: string;
  title?: string;
}

/**
 * A Telnyx message resource as returned by `POST /messages` and
 * `GET /messages/{id}`, and embedded under `data.payload` in webhooks.
 */
export interface TelnyxMessageResource {
  body?: { text?: string } & Record<string, unknown>;
  cc?: TelnyxAddress[];
  completed_at?: string | null;
  direction?: "inbound" | "outbound" | string;
  encoding?: string;
  errors?: TelnyxMessageError[];
  from?: TelnyxAddress | null;
  id: string;
  media?: TelnyxMediaResource[];
  messaging_profile_id?: string | null;
  organization_id?: string | null;
  parts?: number;
  received_at?: string | null;
  record_type?: string;
  sent_at?: string | null;
  subject?: string | null;
  tags?: string[];
  text?: string | null;
  to?: TelnyxAddress[] | string | null;
  type?: string;
  valid_until?: string | null;
  webhook_failover_url?: string | null;
  webhook_url?: string | null;
  [key: string]: unknown;
}

export interface SendTelnyxMessageOptions extends TelnyxApiOptions {
  from?: string;
  mediaUrls?: readonly string[];
  messagingProfileId?: string;
  /** ISO 8601 time at which Telnyx should send a scheduled message. */
  sendAt?: string;
  subject?: string;
  text?: string;
  to: string;
  type?: "MMS" | "SMS";
  /** Only meaningful for phone-number senders; profile webhooks are used otherwise. */
  useProfileWebhooks?: boolean;
  webhookFailoverUrl?: string;
  webhookUrl?: string;
}

export interface SendTelnyxGroupMmsOptions extends TelnyxApiOptions {
  from?: string;
  mediaUrls?: readonly string[];
  messagingProfileId?: string;
  subject?: string;
  text?: string;
  /** Group MMS requires at least two recipients. */
  to: readonly string[];
  type?: "MMS" | "SMS";
  useProfileWebhooks?: boolean;
  webhookFailoverUrl?: string;
  webhookUrl?: string;
}

export interface FetchTelnyxMessageOptions extends TelnyxApiOptions {
  messageId: string;
}

export interface CancelScheduledTelnyxMessageOptions extends TelnyxApiOptions {
  messageId: string;
}

export interface CallTelnyxApiOptions extends TelnyxApiOptions {
  body?: unknown;
  method?: "DELETE" | "GET" | "POST";
  path: string;
  search?: Readonly<Record<string, number | string>>;
}

export interface TelnyxApiResponse {
  body: unknown;
  ok: boolean;
  status: number;
}

/** Shape of the `{ errors: [...] }` body Telnyx returns on failure. */
export interface TelnyxErrorEnvelope {
  errors?: TelnyxMessageError[];
}
