import { describe, expect, it } from "vitest";
import {
  decodeTelnyxThreadId,
  encodeTelnyxThreadId,
  telnyxChannelId,
} from "../src/thread";

describe("thread id codec", () => {
  it("round-trips a 1:1 conversation", () => {
    const threadId = encodeTelnyxThreadId({
      recipients: ["+13125550001"],
      sender: "+17735550002",
    });
    expect(threadId).toBe("telnyx:%2B17735550002:%2B13125550001");
    expect(decodeTelnyxThreadId(threadId)).toEqual({
      recipients: ["+13125550001"],
      sender: "+17735550002",
    });
    expect(telnyxChannelId(threadId)).toBe(threadId);
  });

  it("round-trips a group conversation", () => {
    const threadId = encodeTelnyxThreadId({
      recipients: ["+13125550001", "+14155550003"],
      sender: "+17735550002",
    });
    expect(decodeTelnyxThreadId(threadId)).toEqual({
      recipients: ["+13125550001", "+14155550003"],
      sender: "+17735550002",
    });
  });

  it("rejects malformed ids", () => {
    expect(() => decodeTelnyxThreadId("twilio:a:b")).toThrow();
    expect(() => decodeTelnyxThreadId("telnyx:onlyone")).toThrow();
    expect(() => decodeTelnyxThreadId("telnyx:a:")).toThrow();
  });
});
