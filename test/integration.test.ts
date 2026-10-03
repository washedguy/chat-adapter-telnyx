import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat, type Message, type Thread } from "chat";
import { describe, expect, it, vi } from "vitest";
import { createTelnyxAdapter } from "../src";
import {
  currentTimestamp,
  INBOUND_MMS_EVENT,
  signWebhook,
  signedRequest,
} from "./helpers";

function replyFetch() {
  const outbound: string[] = [];
  const fetchMock = vi.fn(async (_url: string | URL, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    outbound.push(body.text);
    return new Response(
      JSON.stringify({
        data: {
          id: "reply-1",
          direction: "outbound",
          type: body.type ?? "SMS",
          from: { phone_number: "+17735550002" },
          to: [{ phone_number: "+13125550001" }],
          text: body.text,
        },
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  });
  return { fetchMock: fetchMock as unknown as typeof fetch, outbound };
}

describe("Telnyx adapter integration", () => {
  it("routes an inbound DM to onDirectMessage and posts a reply", async () => {
    const body = JSON.stringify(INBOUND_MMS_EVENT);
    const timestamp = currentTimestamp();
    const { publicKey, signature } = await signWebhook(body, timestamp);
    const { fetchMock, outbound } = replyFetch();

    const adapter = createTelnyxAdapter({
      apiKey: "KEY_test",
      fetch: fetchMock,
      phoneNumber: "+17735550002",
      publicKey,
    });

    const chat = new Chat({
      adapters: { telnyx: adapter },
      logger: "silent",
      state: createMemoryState(),
      userName: "mybot",
    });

    let captured: Message | null = null;
    chat.onDirectMessage(async (thread: Thread, message: Message) => {
      captured = message;
      await thread.post("pong");
    });

    const tasks: Promise<unknown>[] = [];
    const response = await chat.webhooks.telnyx(
      signedRequest({ body, signature, timestamp }),
      { waitUntil: (task) => tasks.push(task) },
    );
    await Promise.all(tasks);

    expect(response.status).toBe(200);
    expect(captured).not.toBeNull();
    expect(captured?.text).toBe("Hello from Telnyx!");
    expect(outbound).toEqual(["pong"]);
  });

  it("rejects an unsigned webhook with 401", async () => {
    const adapter = createTelnyxAdapter({
      apiKey: "KEY_test",
      phoneNumber: "+17735550002",
      publicKey: "ignored",
    });
    const chat = new Chat({
      adapters: { telnyx: adapter },
      logger: "silent",
      state: createMemoryState(),
      userName: "mybot",
    });

    const response = await chat.webhooks.telnyx(
      new Request("https://example.com/webhooks/telnyx", {
        body: JSON.stringify(INBOUND_MMS_EVENT),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });
});
