import { describe, expect, it } from "vitest";
import {
  readTelnyxWebhook,
  TelnyxWebhookVerificationError,
} from "../src/webhook";
import {
  currentTimestamp,
  INBOUND_MMS_EVENT,
  signWebhook,
  signedRequest,
} from "./helpers";

describe("webhook verification", () => {
  it("accepts a valid signature and parses the event", async () => {
    const body = JSON.stringify(INBOUND_MMS_EVENT);
    const timestamp = currentTimestamp();
    const { publicKey, signature } = await signWebhook(body, timestamp);

    const result = await readTelnyxWebhook(
      signedRequest({ body, signature, timestamp }),
      { publicKey },
    );

    expect(result.event.data.event_type).toBe("message.received");
    expect(result.event.data.payload.text).toBe("Hello from Telnyx!");
  });

  it("rejects a tampered body", async () => {
    const body = JSON.stringify(INBOUND_MMS_EVENT);
    const timestamp = currentTimestamp();
    const { publicKey, signature } = await signWebhook(body, timestamp);

    await expect(
      readTelnyxWebhook(
        signedRequest({
          body: body.replace("Telnyx", "Hacked"),
          signature,
          timestamp,
        }),
        { publicKey },
      ),
    ).rejects.toBeInstanceOf(TelnyxWebhookVerificationError);
  });

  it("rejects a stale timestamp", async () => {
    const body = JSON.stringify(INBOUND_MMS_EVENT);
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const { publicKey, signature } = await signWebhook(body, timestamp);

    await expect(
      readTelnyxWebhook(signedRequest({ body, signature, timestamp }), {
        publicKey,
        timestampToleranceSeconds: 300,
      }),
    ).rejects.toBeInstanceOf(TelnyxWebhookVerificationError);
  });

  it("rejects a missing signature header", async () => {
    await expect(
      readTelnyxWebhook(
        new Request("https://example.com/webhooks/telnyx", {
          body: JSON.stringify(INBOUND_MMS_EVENT),
          method: "POST",
        }),
        { publicKey: "ignored" },
      ),
    ).rejects.toBeInstanceOf(TelnyxWebhookVerificationError);
  });

  it("honors a custom verifier", async () => {
    const event = await readTelnyxWebhook(
      new Request("https://example.com/webhooks/telnyx", {
        body: JSON.stringify(INBOUND_MMS_EVENT),
        method: "POST",
      }),
      { webhookVerifier: () => true },
    );
    expect(event.event.data.event_type).toBe("message.received");
  });
});
