import { ValidationError } from "@chat-adapter/shared";
import type { Attachment } from "chat";
import type { TelnyxMediaResource, TelnyxMessageResource } from "../api";

/** Map a MIME type to the Chat SDK attachment category. */
export function attachmentType(
  contentType: string | null | undefined,
): Attachment["type"] {
  if (contentType?.startsWith("image/")) {
    return "image";
  }
  if (contentType?.startsWith("video/")) {
    return "video";
  }
  if (contentType?.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

/**
 * Build an attachment from a Telnyx media entry.
 *
 * Telnyx media URLs are public but expire after 30 days, so `fetchData()`
 * fetches the bytes on demand for callers that need to persist them.
 */
export function attachmentFromMedia(
  media: TelnyxMediaResource,
  fetchImplementation: typeof fetch = fetch,
): Attachment {
  const url = media.url as string;
  return {
    fetchData: async () => {
      const response = await fetchImplementation(url);
      if (!response.ok) {
        throw new ValidationError(
          "telnyx",
          `Failed to download Telnyx media (HTTP ${response.status})`,
        );
      }
      return response.arrayBuffer();
    },
    fetchMetadata: { telnyxMediaUrl: url },
    mimeType: media.content_type ?? undefined,
    size: media.size ?? undefined,
    type: attachmentType(media.content_type),
    url,
  };
}

/** Collect every valid attachment from a message resource's `media` array. */
export function attachmentsFromResource(
  resource: TelnyxMessageResource,
  fetchImplementation: typeof fetch = fetch,
): Attachment[] {
  const attachments: Attachment[] = [];
  for (const media of resource.media ?? []) {
    if (typeof media.url === "string" && media.url.length > 0) {
      attachments.push(attachmentFromMedia(media, fetchImplementation));
    }
  }
  return attachments;
}
