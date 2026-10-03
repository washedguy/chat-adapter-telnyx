/**
 * chat-adapter-telnyx
 *
 * Community Telnyx adapter for Chat SDK. SMS and MMS bots built on the Telnyx
 * Messaging API with Ed25519-signed webhooks.
 *
 * Public entry point: re-exports the adapter, factory, and the standalone
 * `api`, `format`, and `webhook` surfaces.
 */

export { TelnyxAdapter } from "./adapter";
export { createTelnyxAdapter } from "./factory";
export type {
  TelnyxAdapterConfig,
  TelnyxRawMessage,
  TelnyxThreadId,
} from "./types";

// Low-level API surface.
export {
  callTelnyxApi,
  cancelScheduledTelnyxMessage,
  DEFAULT_API_BASE_URL,
  fetchTelnyxMessage,
  resolveTelnyxCredential,
  scheduleTelnyxMessage,
  sendTelnyxGroupMms,
  sendTelnyxMessage,
  TelnyxApiError,
  unwrapData,
} from "./api";
export type {
  CallTelnyxApiOptions,
  CancelScheduledTelnyxMessageOptions,
  FetchTelnyxMessageOptions,
  SendTelnyxGroupMmsOptions,
  SendTelnyxMessageOptions,
  TelnyxAddress,
  TelnyxApiOptions,
  TelnyxApiResponse,
  TelnyxCredential,
  TelnyxFetch,
  TelnyxMediaResource,
  TelnyxMessageError,
  TelnyxMessageResource,
} from "./api";

// Formatting helpers.
export {
  cardToTelnyxText,
  TelnyxFormatConverter,
  TELNYX_EMPTY_CARD_FALLBACK,
  TELNYX_MESSAGE_LIMIT,
  telnyxTextOrPlaceholder,
  truncateTelnyxText,
} from "./format";
export type { TelnyxTextOptions, TelnyxTextResult } from "./format";

// Thread ID helpers.
export {
  decodeTelnyxThreadId,
  encodeTelnyxThreadId,
  telnyxChannelId,
} from "./thread";

// Webhook verification and parsing.
export {
  isTelnyxWebhookEvent,
  parseTelnyxWebhookBody,
  readTelnyxWebhook,
  TelnyxWebhookError,
  TelnyxWebhookParseError,
  TelnyxWebhookVerificationError,
  verifyEd25519Signature,
  verifyTelnyxRequest,
} from "./webhook";
export type {
  TelnyxSignatureInput,
  TelnyxVerifiedRequest,
  TelnyxVerifyOptions,
  TelnyxWebhookEvent,
  TelnyxWebhookUrl,
  TelnyxWebhookVerifier,
} from "./webhook";
