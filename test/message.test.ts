import { ValidationError } from "@chat-adapter/shared";
import { describe, expect, it, vi } from "vitest";
import {
  attachmentFromMedia,
  attachmentsFromResource,
  threadFromResource,
} from "../src/message";

describe("attachments", () => {
  it("maps media metadata to an attachment", () => {
    const attachment = attachmentFromMedia({
      content_type: "image/png",
      size: 1024,
      url: "https://media.telnyx.com/a.png",
    });

    expect(attachment).toMatchObject({
      mimeType: "image/png",
      size: 1024,
      type: "image",
      url: "https://media.telnyx.com/a.png",
    });
    expect(attachment.fetchMetadata).toEqual({
      telnyxMediaUrl: "https://media.telnyx.com/a.png",
    });
  });

  it("downloads bytes with the injected fetch", async () => {
    const fetchMock = vi.fn(async () => new Response("bytes"));
    const attachment = attachmentFromMedia(
      { url: "https://media.telnyx.com/a.png" },
      fetchMock as unknown as typeof fetch,
    );

    const data = await attachment.fetchData?.();
    expect(fetchMock).toHaveBeenCalledWith("https://media.telnyx.com/a.png");
    expect(data).toBeInstanceOf(ArrayBuffer);
  });

  it("throws when the download fails", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    const attachment = attachmentFromMedia(
      { url: "https://media.telnyx.com/missing.png" },
      fetchMock as unknown as typeof fetch,
    );

    await expect(attachment.fetchData?.()).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("skips media without a URL", () => {
    expect(
      attachmentsFromResource({
        id: "m1",
        media: [{ content_type: "image/png" }, { url: "" }],
      }),
    ).toEqual([]);
  });
});

describe("thread routing", () => {
  it("uses the receiving number for 1:1 even when another number is configured", () => {
    const thread = threadFromResource(
      {
        id: "m1",
        direction: "inbound",
        from: { phone_number: "+13125550001" },
        to: [{ phone_number: "+19995550009" }],
      },
      { configuredSender: "+17735550002" },
    );

    expect(thread).toEqual({
      recipients: ["+13125550001"],
      sender: "+19995550009",
    });
  });

  it("excludes the configured sender from group recipients", () => {
    const thread = threadFromResource(
      {
        id: "m2",
        direction: "inbound",
        from: { phone_number: "+13125550001" },
        to: [
          { phone_number: "+17735550002" },
          { phone_number: "+14155550003" },
        ],
      },
      { configuredSender: "+17735550002" },
    );

    expect(thread).toEqual({
      recipients: ["+13125550001", "+14155550003"],
      sender: "+17735550002",
    });
  });
});
