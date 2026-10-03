import { describe, expect, it, vi } from "vitest";
import { TelnyxAdapter } from "../src/adapter";
import { encodeTelnyxThreadId } from "../src/thread";
import type { TelnyxAdapterConfig } from "../src/types";
import { INBOUND_GROUP_MMS_EVENT, INBOUND_MMS_EVENT } from "./helpers";

const THREAD_ID = encodeTelnyxThreadId({
  recipients: ["+13125550001"],
  sender: "+17735550002",
});

function adapterWith(config: Partial<TelnyxAdapterConfig> = {}): TelnyxAdapter {
  return new TelnyxAdapter({
    apiKey: "KEY_test",
    phoneNumber: "+17735550002",
    ...config,
  });
}

function captureFetch(response: (init: RequestInit) => Response) {
  const calls: Array<{ init: RequestInit; url: string }> = [];
  const fetchMock = vi.fn(async (url: string | URL, init: RequestInit) => {
    calls.push({ init, url: String(url) });
    return response(init);
  });
  return { calls, fetchMock: fetchMock as unknown as typeof fetch };
}

function messageResponse(id: string, type = "SMS"): Response {
  return new Response(
    JSON.stringify({
      data: {
        id,
        direction: "outbound",
        type,
        from: { phone_number: "+17735550002" },
        to: [{ phone_number: "+13125550001", status: "queued" }],
      },
    }),
    { headers: { "content-type": "application/json" }, status: 200 },
  );
}

describe("TelnyxAdapter", () => {
  it("parses an inbound 1:1 webhook event", () => {
    const message = adapterWith().parseMessage(INBOUND_MMS_EVENT);
    expect(message.threadId).toBe(THREAD_ID);
    expect(message.author.userId).toBe("+13125550001");
    expect(message.author.isMe).toBe(false);
    expect(message.text).toBe("Hello from Telnyx!");
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]?.type).toBe("image");
  });

  it("builds a group thread from a group MMS event", () => {
    const message = adapterWith().parseMessage(INBOUND_GROUP_MMS_EVENT);
    expect(message.threadId).toBe(
      encodeTelnyxThreadId({
        recipients: ["+13125550001", "+14155550003"],
        sender: "+17735550002",
      }),
    );
    expect(message.author.userId).toBe("+13125550001");
  });

  it("sends an SMS through the Messaging API", async () => {
    const { calls, fetchMock } = captureFetch(() => messageResponse("msg-1"));
    const adapter = adapterWith({ fetch: fetchMock });

    const sent = await adapter.postMessage(THREAD_ID, {
      markdown: "Hi **there**",
    });

    expect(sent.id).toBe("msg-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.telnyx.com/v2/messages");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toMatchObject({
      from: "+17735550002",
      text: "Hi **there**",
      to: "+13125550001",
      type: "SMS",
    });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer KEY_test");
  });

  it("sends group MMS to every recipient", async () => {
    const { calls, fetchMock } = captureFetch(() =>
      messageResponse("msg-group", "MMS"),
    );
    const adapter = adapterWith({ fetch: fetchMock });
    const groupThread = encodeTelnyxThreadId({
      recipients: ["+13125550001", "+14155550003"],
      sender: "+17735550002",
    });

    await adapter.postMessage(groupThread, { raw: "Hi group" });

    expect(calls[0]?.url).toBe("https://api.telnyx.com/v2/messages/group_mms");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.type).toBe("MMS");
    expect(body.to).toEqual(["+13125550001", "+14155550003"]);
  });

  it("sends MMS media by public URL without a text body", async () => {
    const { calls, fetchMock } = captureFetch(() =>
      messageResponse("msg-2", "MMS"),
    );
    const adapter = adapterWith({ fetch: fetchMock });

    await adapter.postMessage(THREAD_ID, {
      attachments: [{ type: "image", url: "https://cdn.example.com/a.png" }],
      raw: "",
    });

    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.type).toBe("MMS");
    expect(body.media_urls).toEqual(["https://cdn.example.com/a.png"]);
    expect(body.text).toBeUndefined();
  });

  it("rejects binary file uploads", async () => {
    await expect(
      adapterWith().postMessage(THREAD_ID, {
        files: [{ data: Buffer.from("x"), filename: "a.png" }],
        raw: "hi",
      } as never),
    ).rejects.toThrow(/public URL only/);
  });

  it("routes a profile-id sender into messaging_profile_id", async () => {
    const { calls, fetchMock } = captureFetch(() => messageResponse("msg-3"));
    const profileId = "abc85f64-5717-4562-b3fc-2c9600000000";
    const adapter = new TelnyxAdapter({
      apiKey: "KEY_test",
      fetch: fetchMock,
      messagingProfileId: profileId,
    });
    const threadId = encodeTelnyxThreadId({
      recipients: ["+13125550001"],
      sender: profileId,
    });

    await adapter.postMessage(threadId, { raw: "hi" });

    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.messaging_profile_id).toBe(profileId);
    expect(body.from).toBeUndefined();
  });

  it("schedules a message and can cancel it", async () => {
    const { calls, fetchMock } = captureFetch((init) =>
      init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : messageResponse("msg-sched"),
    );
    const adapter = adapterWith({ fetch: fetchMock });
    const postAt = new Date("2026-01-01T09:00:00.000Z");

    const scheduled = await adapter.scheduleMessage(THREAD_ID, "Reminder", {
      postAt,
    });

    expect(calls[0]?.url).toBe("https://api.telnyx.com/v2/messages/schedule");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.send_at).toBe(postAt.toISOString());
    expect(scheduled.scheduledMessageId).toBe("msg-sched");
    expect(scheduled.postAt).toBe(postAt);

    await scheduled.cancel();
    expect(calls[1]?.url).toBe("https://api.telnyx.com/v2/messages/msg-sched");
    expect(calls[1]?.init.method).toBe("DELETE");
  });

  it("refuses to schedule group MMS", async () => {
    const groupThread = encodeTelnyxThreadId({
      recipients: ["+13125550001", "+14155550003"],
      sender: "+17735550002",
    });
    await expect(
      adapterWith().scheduleMessage(groupThread, "hi", { postAt: new Date() }),
    ).rejects.toThrow(/group MMS/);
  });
});
