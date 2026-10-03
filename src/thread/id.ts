import { ValidationError } from "@chat-adapter/shared";
import type { TelnyxThreadId } from "../types";

const ADAPTER_PREFIX = "telnyx";

/**
 * Thread IDs follow `telnyx:{sender}:{recipients}`, where each recipient is
 * URI-encoded and multiple recipients are comma-separated. Encoding keeps
 * reserved characters (`+`, `:`, `,`) inside a single segment.
 */
export function encodeTelnyxThreadId(platformData: TelnyxThreadId): string {
  const recipients = platformData.recipients.map(encodeURIComponent).join(",");
  return `${ADAPTER_PREFIX}:${encodeURIComponent(platformData.sender)}:${recipients}`;
}

export function decodeTelnyxThreadId(threadId: string): TelnyxThreadId {
  const parts = threadId.split(":");
  if (parts.length !== 3 || parts[0] !== ADAPTER_PREFIX) {
    throw new ValidationError(
      "telnyx",
      `Invalid Telnyx thread ID: ${threadId}`,
    );
  }
  const [, senderSegment, recipientsSegment] = parts;
  const recipients = recipientsSegment
    .split(",")
    .filter((entry) => entry.length > 0)
    .map(decodeURIComponent);
  if (!senderSegment || recipients.length === 0) {
    throw new ValidationError(
      "telnyx",
      `Invalid Telnyx thread ID: ${threadId}`,
    );
  }
  return {
    recipients,
    sender: decodeURIComponent(senderSegment),
  };
}

/** SMS/MMS is a single conversation, so the channel is the thread itself. */
export function telnyxChannelId(threadId: string): string {
  decodeTelnyxThreadId(threadId);
  return threadId;
}
