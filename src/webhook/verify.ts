/**
 * Telnyx Ed25519 webhook signature verification.
 *
 * Telnyx signs `{timestamp}|{raw_body}` with its account key pair. The account
 * public key (base64, raw 32 bytes) is available in Mission Control under
 * Keys & Credentials, and is read from `TELNYX_PUBLIC_KEY` by default.
 */

import { resolveTelnyxCredential } from "../api";
import {
  TelnyxWebhookVerificationError,
  type TelnyxVerifyOptions,
} from "./types";

export interface TelnyxVerifiedRequest {
  body: string;
  request: Request;
}

export interface TelnyxSignatureInput {
  body: string;
  publicKey: string;
  signature: string;
  timestamp: string;
}

export async function verifyTelnyxRequest(
  request: Request,
  options: TelnyxVerifyOptions = {},
): Promise<TelnyxVerifiedRequest> {
  const body = await request.text();

  if (options.webhookVerifier) {
    const result = await options.webhookVerifier(request, body);
    if (!result) {
      throw new TelnyxWebhookVerificationError(
        "Telnyx webhook verifier rejected the request",
      );
    }
    return { body: typeof result === "string" ? result : body, request };
  }

  const signature = requireHeader(request, "telnyx-signature-ed25519");
  const timestamp = requireHeader(request, "telnyx-timestamp");
  assertTimestampFresh(timestamp, options.timestampToleranceSeconds ?? 300);

  const publicKey = await resolveTelnyxCredential(
    options.publicKey ?? process.env.TELNYX_PUBLIC_KEY,
    "TELNYX_PUBLIC_KEY",
  );
  const valid = await verifyEd25519Signature({
    body,
    publicKey,
    signature,
    timestamp,
  });
  if (!valid) {
    throw new TelnyxWebhookVerificationError("Telnyx signature is invalid");
  }

  return { body, request };
}

export async function verifyEd25519Signature(
  input: TelnyxSignatureInput,
): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new TelnyxWebhookVerificationError(
      "Web Crypto (Ed25519) is unavailable in this runtime; pass webhookVerifier or run on Node.js 20+",
    );
  }
  const key = await importEd25519PublicKey(decodeBase64(input.publicKey));
  const signed = new TextEncoder().encode(`${input.timestamp}|${input.body}`);
  return subtle.verify("Ed25519", key, decodeBase64(input.signature), signed);
}

function requireHeader(request: Request, name: string): string {
  const value = request.headers.get(name);
  if (!value) {
    throw new TelnyxWebhookVerificationError(`${name} header is required`);
  }
  return value;
}

function assertTimestampFresh(
  timestamp: string,
  toleranceSeconds: number,
): void {
  if (toleranceSeconds <= 0) {
    return;
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) {
    throw new TelnyxWebhookVerificationError(
      "telnyx-timestamp header is not a Unix timestamp",
    );
  }
  const skewSeconds = Math.abs(Date.now() / 1000 - seconds);
  if (skewSeconds > toleranceSeconds) {
    throw new TelnyxWebhookVerificationError(
      `Telnyx webhook timestamp is outside the ${toleranceSeconds}s tolerance window`,
    );
  }
}

async function importEd25519PublicKey(bytes: ArrayBuffer): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  try {
    // Mission Control exposes the raw 32-byte key, base64-encoded.
    return await subtle.importKey("raw", bytes, { name: "Ed25519" }, false, [
      "verify",
    ]);
  } catch {
    // Fall back to a DER/SPKI-encoded key for operators who paste one.
    return subtle.importKey("spki", bytes, { name: "Ed25519" }, false, [
      "verify",
    ]);
  }
}

function decodeBase64(value: string): ArrayBuffer {
  const bytes =
    typeof Buffer !== "undefined"
      ? new Uint8Array(Buffer.from(value, "base64"))
      : decodeBase64Atob(value);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeBase64Atob(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
