import { ValidationError } from "@chat-adapter/shared";
import { Message } from "chat";
import type { TelnyxMessageResource } from "../api";
import type { TelnyxFormatConverter } from "../format";
import { encodeTelnyxThreadId } from "../thread/id";
import { phoneNumberOf, phoneNumbers } from "../thread";
import type { TelnyxRawMessage, TelnyxThreadId } from "../types";
import { attachmentsFromResource } from "./attachments";

/** Read a message's plain text, including the RCS/WhatsApp nested `body.text`. */
export function messageText(resource: TelnyxMessageResource): string {
  if (typeof resource.text === "string" && resource.text.length > 0) {
    return resource.text;
  }
  const bodyText = resource.body?.text;
  return typeof bodyText === "string" ? bodyText : "";
}

export function dateFromTelnyx(value: string | null | undefined): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export interface ThreadFromResourceOptions {
  /**
   * This bot's own phone number, used to exclude the bot from inbound group
   * MMS recipients. Without it the first `to` entry is assumed to be the bot.
   */
  configuredSender?: string;
  /** Known thread, used to fill gaps when a resource omits routing. */
  fallback?: TelnyxThreadId;
}

/**
 * Derive the conversation thread from a message resource.
 *
 * - Outbound: the bot is `from`; recipients are `to`.
 * - Inbound 1:1: the bot is `to`; the recipient is `from`.
 * - Inbound group MMS: the bot is `configuredSender` (or the first `to`), and
 *   the recipients are everyone else in the conversation so a reply reaches
 *   the whole group.
 */
export function threadFromResource(
  resource: TelnyxMessageResource,
  options: ThreadFromResourceOptions = {},
): TelnyxThreadId {
  const from = phoneNumberOf(resource.from);
  const to = phoneNumbers(resource.to);

  if (resource.direction === "outbound") {
    const sender = options.fallback?.sender ?? from;
    const recipients = options.fallback?.recipients ?? to;
    return requireRouting({ recipients, sender });
  }

  const sender = options.fallback?.sender ?? options.configuredSender ?? to[0];
  if (!sender) {
    throw missingRouting();
  }
  const recipients = dedupe([from, ...to]).filter(
    (address) => address !== sender,
  );
  return requireRouting({ recipients, sender });
}

export interface MessageFromResourceInput {
  converter: TelnyxFormatConverter;
  fetchImplementation?: typeof fetch;
  raw: TelnyxRawMessage;
  resource: TelnyxMessageResource;
  thread: TelnyxThreadId;
}

/** Normalize a Telnyx message resource into a Chat SDK `Message`. */
export function messageFromResource(
  input: MessageFromResourceInput,
): Message<TelnyxRawMessage> {
  const { converter, raw, resource, thread } = input;
  const isMe = resource.direction === "outbound";
  const authorId = isMe ? thread.sender : thread.recipients[0];
  const text = messageText(resource);

  return new Message({
    attachments: attachmentsFromResource(
      resource,
      input.fetchImplementation ?? fetch,
    ),
    author: {
      fullName: authorId,
      isBot: isMe,
      isMe,
      userId: authorId,
      userName: authorId,
    },
    formatted: converter.toAst(text),
    id: resource.id,
    metadata: {
      dateSent: dateFromTelnyx(
        resource.received_at ?? resource.sent_at ?? resource.completed_at,
      ),
      edited: false,
    },
    raw,
    text,
    threadId: encodeTelnyxThreadId(thread),
  });
}

function requireRouting(thread: {
  recipients: string[];
  sender: string | undefined;
}): TelnyxThreadId {
  if (!thread.sender || thread.recipients.length === 0) {
    throw missingRouting();
  }
  return { recipients: thread.recipients, sender: thread.sender };
}

function missingRouting(): ValidationError {
  return new ValidationError("telnyx", "Telnyx message is missing routing");
}

function dedupe(addresses: Array<string | undefined>): string[] {
  const unique: string[] = [];
  for (const address of addresses) {
    if (address && !unique.includes(address)) {
      unique.push(address);
    }
  }
  return unique;
}
