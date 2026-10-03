import { parseTelnyxWebhookBody } from "./parse";
import type { TelnyxVerifyOptions, TelnyxWebhookEvent } from "./types";
import { verifyTelnyxRequest } from "./verify";

export { isTelnyxWebhookEvent, parseTelnyxWebhookBody } from "./parse";
export {
  TelnyxWebhookError,
  TelnyxWebhookParseError,
  TelnyxWebhookVerificationError,
} from "./types";
export type {
  TelnyxVerifyOptions,
  TelnyxWebhookEvent,
  TelnyxWebhookUrl,
  TelnyxWebhookVerifier,
} from "./types";
export { verifyEd25519Signature, verifyTelnyxRequest } from "./verify";
export type { TelnyxSignatureInput, TelnyxVerifiedRequest } from "./verify";

/** Verify and parse a Telnyx webhook in one step. */
export async function readTelnyxWebhook(
  request: Request,
  options: TelnyxVerifyOptions = {},
): Promise<{ body: string; event: TelnyxWebhookEvent }> {
  const verified = await verifyTelnyxRequest(request, options);
  return { body: verified.body, event: parseTelnyxWebhookBody(verified.body) };
}
