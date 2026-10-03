import type { Logger } from "chat";
import type {
  TelnyxCredential,
  TelnyxFetch,
  TelnyxMessageResource,
} from "./api";
import type {
  TelnyxWebhookEvent,
  TelnyxWebhookUrl,
  TelnyxWebhookVerifier,
} from "./webhook";

/**
 * Decoded components of a `telnyx:{sender}:{recipients}` thread ID.
 *
 * SMS has no server-side threading, so one thread per address set is the model.
 * `sender` is this bot's Telnyx address (phone number, short code, or
 * alphanumeric sender ID); `recipients` holds the other participants — a single
 * entry for 1:1 conversations, several for group MMS.
 */
export interface TelnyxThreadId {
  recipients: string[];
  sender: string;
}

export interface TelnyxAdapterConfig {
  /** Telnyx API key (bearer token). Falls back to `TELNYX_API_KEY`. */
  apiKey?: TelnyxCredential;
  /** Override the API base URL. Defaults to `https://api.telnyx.com/v2`. */
  apiBaseUrl?: string;
  /** Injectable fetch implementation. */
  fetch?: TelnyxFetch;
  logger?: Logger;
  /** Messaging profile ID. Falls back to `TELNYX_MESSAGING_PROFILE_ID`. */
  messagingProfileId?: string;
  /** Sending phone number or sender ID. Falls back to `TELNYX_PHONE_NUMBER`. */
  phoneNumber?: string;
  /** Webhook signing public key. Falls back to `TELNYX_PUBLIC_KEY`. */
  publicKey?: TelnyxCredential;
  /** Maximum accepted webhook age, in seconds. Defaults to 300. Set to 0 to disable. */
  timestampToleranceSeconds?: number;
  userName?: string;
  /** Per-message webhook URL sent to Telnyx for outbound delivery receipts. */
  webhookUrl?: TelnyxWebhookUrl;
  /** Custom signature verifier that replaces the built-in Ed25519 check. */
  webhookVerifier?: TelnyxWebhookVerifier;
}

export type TelnyxRawMessage = TelnyxMessageResource | TelnyxWebhookEvent;
