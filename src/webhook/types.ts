/**
 * Telnyx webhook types: event payloads, verifier configuration, and errors.
 */

import type { TelnyxCredential, TelnyxMessageResource } from "../api";

/** The webhook envelope Telnyx POSTs to your endpoint. */
export interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: TelnyxMessageResource;
    record_type?: string;
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

export type TelnyxWebhookUrl =
  string | ((request: Request) => Promise<string> | string);

/**
 * Custom verifier. Return `true` (or the verified body string) to accept the
 * request, `false` to reject it.
 */
export type TelnyxWebhookVerifier = (
  request: Request,
  body: string,
) => Promise<boolean | string> | boolean | string;

export interface TelnyxVerifyOptions {
  /** Telnyx webhook signing public key (base64). Falls back to `TELNYX_PUBLIC_KEY`. */
  publicKey?: TelnyxCredential;
  /**
   * Maximum accepted age of `telnyx-timestamp`, in seconds.
   * Defaults to `300`. Set to `0` to disable the replay window.
   */
  timestampToleranceSeconds?: number;
  /** Custom verifier that replaces the built-in Ed25519 check. */
  webhookVerifier?: TelnyxWebhookVerifier;
  /** Kept for parity; the Ed25519 scheme does not use the request URL. */
  webhookUrl?: TelnyxWebhookUrl;
}

export class TelnyxWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelnyxWebhookError";
  }
}

export class TelnyxWebhookParseError extends TelnyxWebhookError {
  constructor(message: string) {
    super(message);
    this.name = "TelnyxWebhookParseError";
  }
}

export class TelnyxWebhookVerificationError extends TelnyxWebhookError {
  constructor(message: string) {
    super(message);
    this.name = "TelnyxWebhookVerificationError";
  }
}
