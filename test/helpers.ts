import type { TelnyxWebhookEvent } from "../src/webhook";

/** A representative inbound MMS webhook, reused across test suites. */
export const INBOUND_MMS_EVENT: TelnyxWebhookEvent = {
  data: {
    event_type: "message.received",
    id: "b301ed3f-1490-491f-995f-6e64e69674d4",
    occurred_at: "2024-01-15T20:16:07.588+00:00",
    payload: {
      id: "84cca175-9755-4859-b67f-4730d7f58aa3",
      direction: "inbound",
      type: "MMS",
      from: {
        carrier: "T-Mobile USA",
        line_type: "long_code",
        phone_number: "+13125550001",
      },
      to: [
        {
          carrier: "Telnyx",
          line_type: "Wireless",
          phone_number: "+17735550002",
          status: "webhook_delivered",
        },
      ],
      media: [
        {
          url: "https://media.telnyx.com/example-image.png",
          content_type: "image/png",
          size: 102_400,
        },
      ],
      text: "Hello from Telnyx!",
      received_at: "2024-01-15T20:16:07.503+00:00",
    },
    record_type: "event",
  },
  meta: { attempt: 1, delivered_to: "https://example.com/webhooks" },
};

/** A representative group MMS webhook addressed to our number and one peer. */
export const INBOUND_GROUP_MMS_EVENT: TelnyxWebhookEvent = {
  data: {
    event_type: "message.received",
    id: "c1a2b3c4-0000-4000-8000-000000000001",
    occurred_at: "2024-01-15T20:20:00.000+00:00",
    payload: {
      id: "c1a2b3c4-0000-4000-8000-000000000002",
      direction: "inbound",
      type: "MMS",
      from: { phone_number: "+13125550001" },
      to: [{ phone_number: "+17735550002" }, { phone_number: "+14155550003" }],
      text: "Hello group!",
      received_at: "2024-01-15T20:20:00.000+00:00",
    },
    record_type: "event",
  },
};

/** Generate an Ed25519 key pair and sign a webhook body for tests. */
export async function signWebhook(
  body: string,
  timestamp: string,
): Promise<{ publicKey: string; signature: string }> {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  const rawPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const signature = await crypto.subtle.sign(
    "Ed25519",
    keyPair.privateKey,
    new TextEncoder().encode(`${timestamp}|${body}`),
  );
  return {
    publicKey: Buffer.from(rawPublicKey).toString("base64"),
    signature: Buffer.from(signature).toString("base64"),
  };
}

export function signedRequest(input: {
  body: string;
  signature: string;
  timestamp: string;
}): Request {
  return new Request("https://example.com/webhooks/telnyx", {
    body: input.body,
    headers: {
      "content-type": "application/json",
      "telnyx-signature-ed25519": input.signature,
      "telnyx-timestamp": input.timestamp,
    },
    method: "POST",
  });
}

export function currentTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}
