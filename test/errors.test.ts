import {
  AdapterRateLimitError,
  AuthenticationError,
  NetworkError,
  PermissionError,
  ResourceNotFoundError,
} from "@chat-adapter/shared";
import { describe, expect, it, vi } from "vitest";
import { TelnyxApiError } from "../src/api";
import { TelnyxAdapter } from "../src/adapter";
import { mapTelnyxError } from "../src/errors";
import { encodeTelnyxThreadId } from "../src/thread";

describe("mapTelnyxError", () => {
  it.each([
    [401, AuthenticationError],
    [403, PermissionError],
    [404, ResourceNotFoundError],
    [429, AdapterRateLimitError],
  ])("maps HTTP %i to %s", (status, expected) => {
    const mapped = mapTelnyxError(
      new TelnyxApiError("failed", { body: null, status }),
    );
    expect(mapped).toBeInstanceOf(expected);
  });

  it("maps a missing credential to AuthenticationError", () => {
    const mapped = mapTelnyxError(
      new TelnyxApiError("TELNYX_API_KEY is required", {
        body: null,
        status: 0,
      }),
    );
    expect(mapped).toBeInstanceOf(AuthenticationError);
  });

  it("maps a transport failure to NetworkError", () => {
    const mapped = mapTelnyxError(
      new TelnyxApiError("Network error calling Telnyx: boom", {
        body: null,
        status: 0,
      }),
    );
    expect(mapped).toBeInstanceOf(NetworkError);
  });

  it("passes unrelated errors through", () => {
    const error = new Error("nope");
    expect(mapTelnyxError(error)).toBe(error);
  });
});

describe("adapter error translation", () => {
  it("surfaces an authentication failure from postMessage", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ errors: [{ detail: "Invalid API key" }] }),
          {
            headers: { "content-type": "application/json" },
            status: 401,
          },
        ),
    );
    const adapter = new TelnyxAdapter({
      apiKey: "bad",
      fetch: fetchMock as unknown as typeof fetch,
      phoneNumber: "+17735550002",
    });
    const threadId = encodeTelnyxThreadId({
      recipients: ["+13125550001"],
      sender: "+17735550002",
    });

    await expect(
      adapter.postMessage(threadId, { raw: "hi" }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
