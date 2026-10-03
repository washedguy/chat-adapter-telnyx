/**
 * High-level operations on the Telnyx `/messages` resource.
 */

import { callTelnyxApi, unwrapData } from "./client";
import type {
  CancelScheduledTelnyxMessageOptions,
  FetchTelnyxMessageOptions,
  SendTelnyxGroupMmsOptions,
  SendTelnyxMessageOptions,
  TelnyxApiOptions,
  TelnyxMessageResource,
} from "./types";

export async function sendTelnyxMessage(
  options: SendTelnyxMessageOptions,
): Promise<TelnyxMessageResource> {
  const mediaUrls = options.mediaUrls ? [...options.mediaUrls] : [];
  assertSendable(options, mediaUrls);
  return postMessage("/messages", options, options.to, mediaUrls);
}

/**
 * Send one message to several recipients as group MMS. All recipients see the
 * same conversation, so replies should target the whole group.
 */
export async function sendTelnyxGroupMms(
  options: SendTelnyxGroupMmsOptions,
): Promise<TelnyxMessageResource> {
  const recipients = [...options.to];
  if (recipients.length < 2) {
    throw new TypeError("group MMS requires at least two recipients");
  }
  const mediaUrls = options.mediaUrls ? [...options.mediaUrls] : [];
  assertSendable(options, mediaUrls);
  return postMessage(
    "/messages/group_mms",
    { ...options, type: options.type ?? "MMS" },
    recipients,
    mediaUrls,
  );
}

/** Schedule a message for future delivery. Telnyx requires an ISO `send_at`. */
export async function scheduleTelnyxMessage(
  options: SendTelnyxMessageOptions,
): Promise<TelnyxMessageResource> {
  if (!options.sendAt) {
    throw new TypeError("sendAt is required to schedule a message");
  }
  const mediaUrls = options.mediaUrls ? [...options.mediaUrls] : [];
  assertSendable(options, mediaUrls);
  return postMessage("/messages/schedule", options, options.to, mediaUrls);
}

export async function fetchTelnyxMessage(
  options: FetchTelnyxMessageOptions,
): Promise<TelnyxMessageResource> {
  const response = await callTelnyxApi(
    `/messages/${encodeURIComponent(options.messageId)}`,
    { ...options, method: "GET" },
  );
  return unwrapData<TelnyxMessageResource>(response.body);
}

/**
 * Cancel a scheduled message. Telnyx only permits this for messages with
 * `status=scheduled` whose `send_at` is more than a minute away; already-sent
 * messages cannot be deleted through the API.
 */
export async function cancelScheduledTelnyxMessage(
  options: CancelScheduledTelnyxMessageOptions,
): Promise<void> {
  await callTelnyxApi(`/messages/${encodeURIComponent(options.messageId)}`, {
    ...options,
    method: "DELETE",
  });
}

async function postMessage(
  path: string,
  options: SendTelnyxMessageOptions | SendTelnyxGroupMmsOptions,
  to: string | string[],
  mediaUrls: readonly string[],
): Promise<TelnyxMessageResource> {
  const response = await callTelnyxApi(path, {
    ...(options as TelnyxApiOptions),
    body: {
      from: options.from,
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      messaging_profile_id: options.messagingProfileId,
      send_at: isScheduled(options) ? options.sendAt : undefined,
      subject: options.subject,
      text: options.text,
      to,
      type: options.type ?? (mediaUrls.length > 0 ? "MMS" : "SMS"),
      use_profile_webhooks: options.useProfileWebhooks,
      webhook_failover_url: options.webhookFailoverUrl,
      webhook_url: options.webhookUrl,
    },
    method: "POST",
  });
  return unwrapData<TelnyxMessageResource>(response.body);
}

function isScheduled(
  options: SendTelnyxMessageOptions | SendTelnyxGroupMmsOptions,
): options is SendTelnyxMessageOptions {
  return "sendAt" in options;
}

function assertSendable(
  options: SendTelnyxMessageOptions | SendTelnyxGroupMmsOptions,
  mediaUrls: readonly string[],
): void {
  if (!(options.text || mediaUrls.length > 0)) {
    throw new TypeError("text or mediaUrls is required");
  }
  if (!(options.from || options.messagingProfileId)) {
    throw new TypeError("from or messagingProfileId is required");
  }
}
