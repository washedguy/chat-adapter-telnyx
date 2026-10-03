import {
  extractCard,
  extractFiles,
  extractPostableAttachments,
  ValidationError,
} from "@chat-adapter/shared";
import type {
  Adapter,
  AdapterPostableMessage,
  Attachment,
  ChatInstance,
  FetchOptions,
  FetchResult,
  FormattedContent,
  Logger,
  RawMessage,
  ScheduledMessage,
  ThreadInfo,
  UserInfo,
  WebhookOptions,
} from "chat";
import { ConsoleLogger, Message, NotImplementedError } from "chat";
import {
  cancelScheduledTelnyxMessage,
  fetchTelnyxMessage,
  scheduleTelnyxMessage,
  sendTelnyxGroupMms,
  sendTelnyxMessage,
  type TelnyxApiOptions,
} from "./api";
import {
  cardToTelnyxText,
  TELNYX_EMPTY_CARD_FALLBACK,
  TELNYX_MESSAGE_LIMIT,
  TelnyxFormatConverter,
  telnyxTextOrPlaceholder,
  truncateTelnyxText,
} from "./format";
import { mapTelnyxError } from "./errors";
import {
  attachmentFromMedia,
  messageFromResource,
  threadFromResource,
} from "./message";
import {
  decodeTelnyxThreadId,
  encodeTelnyxThreadId,
  telnyxChannelId,
} from "./thread";
import type {
  TelnyxAdapterConfig,
  TelnyxRawMessage,
  TelnyxThreadId,
} from "./types";
import { okResponse, senderFields } from "./utils";
import {
  isTelnyxWebhookEvent,
  readTelnyxWebhook,
  type TelnyxWebhookEvent,
  TelnyxWebhookParseError,
  TelnyxWebhookVerificationError,
} from "./webhook";

export class TelnyxAdapter implements Adapter<
  TelnyxThreadId,
  TelnyxRawMessage
> {
  readonly name = "telnyx";
  readonly lockScope = "thread" as const;
  readonly persistThreadHistory = true;
  readonly userName: string;

  protected chat: ChatInstance | null = null;
  protected readonly apiBaseUrl?: string;
  protected readonly apiKey?: TelnyxAdapterConfig["apiKey"];
  protected readonly fetchImplementation: typeof fetch;
  protected readonly formatConverter = new TelnyxFormatConverter();
  protected logger: Logger;
  protected readonly messagingProfileId?: string;
  protected readonly phoneNumber?: string;
  protected readonly publicKey?: TelnyxAdapterConfig["publicKey"];
  protected readonly timestampToleranceSeconds: number;
  protected readonly webhookUrl?: TelnyxAdapterConfig["webhookUrl"];
  protected readonly webhookVerifier?: TelnyxAdapterConfig["webhookVerifier"];
  private readonly hasCustomLogger: boolean;

  constructor(config: TelnyxAdapterConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.fetchImplementation = config.fetch ?? fetch;
    this.hasCustomLogger = config.logger !== undefined;
    this.logger = config.logger ?? new ConsoleLogger("info").child("telnyx");
    this.messagingProfileId =
      config.messagingProfileId ?? process.env.TELNYX_MESSAGING_PROFILE_ID;
    this.phoneNumber = config.phoneNumber ?? process.env.TELNYX_PHONE_NUMBER;
    this.publicKey = config.publicKey;
    this.timestampToleranceSeconds = config.timestampToleranceSeconds ?? 300;
    this.userName = config.userName ?? "bot";
    this.webhookUrl = config.webhookUrl;
    this.webhookVerifier = config.webhookVerifier;
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    // Respect the host Chat instance's logger unless one was passed explicitly.
    if (!this.hasCustomLogger) {
      this.logger = chat.getLogger("telnyx");
    }
    this.logger.info("Telnyx adapter initialized", {
      messagingProfileId: this.messagingProfileId,
      phoneNumber: this.phoneNumber,
    });
  }

  async handleWebhook(
    request: Request,
    options?: WebhookOptions,
  ): Promise<Response> {
    let event: TelnyxWebhookEvent;
    try {
      ({ event } = await readTelnyxWebhook(request, {
        publicKey: this.publicKey,
        timestampToleranceSeconds: this.timestampToleranceSeconds,
        webhookVerifier: this.webhookVerifier,
        webhookUrl: this.webhookUrl,
      }));
    } catch (error) {
      if (error instanceof TelnyxWebhookVerificationError) {
        return new Response("Invalid signature", { status: 401 });
      }
      if (error instanceof TelnyxWebhookParseError) {
        return new Response("Invalid webhook", { status: 400 });
      }
      throw error;
    }

    if (!this.chat) {
      return okResponse();
    }

    // Telnyx retries on non-2xx and may deliver out of order. Only inbound
    // messages are dispatched; sent/finalized events are delivery receipts.
    if (event.data.event_type === "message.received") {
      const message = this.parseMessage(event);
      this.chat.processMessage(this, message.threadId, message, options);
    } else {
      this.logger.debug("Telnyx status event", {
        eventId: event.data.id,
        eventType: event.data.event_type,
        messageId: event.data.payload?.id,
      });
    }

    return okResponse();
  }

  parseMessage(raw: TelnyxRawMessage): Message<TelnyxRawMessage> {
    const resource = isTelnyxWebhookEvent(raw) ? raw.data.payload : raw;
    return messageFromResource({
      converter: this.formatConverter,
      fetchImplementation: this.fetchImplementation,
      raw,
      resource,
      thread: threadFromResource(resource, {
        configuredSender: this.phoneNumber,
      }),
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<TelnyxRawMessage>> {
    const thread = this.decodeThreadId(threadId);
    const body = this.renderPostableText(message);
    const mediaUrls = this.mediaUrls(message);
    if (!body && mediaUrls.length === 0) {
      throw new ValidationError("telnyx", "Message text cannot be empty");
    }

    const content = {
      mediaUrls,
      text:
        body || mediaUrls.length === 0
          ? telnyxTextOrPlaceholder(body)
          : undefined,
      webhookUrl:
        typeof this.webhookUrl === "string" ? this.webhookUrl : undefined,
    };
    const sender = senderFields(thread.sender);
    const raw = await this.withApiErrors(() =>
      thread.recipients.length > 1
        ? sendTelnyxGroupMms({
            ...this.apiOptions(),
            ...sender,
            ...content,
            to: thread.recipients,
          })
        : sendTelnyxMessage({
            ...this.apiOptions(),
            ...sender,
            ...content,
            to: thread.recipients[0],
            type: mediaUrls.length > 0 ? "MMS" : "SMS",
          }),
    );

    return { id: raw.id, raw, threadId: encodeTelnyxThreadId(thread) };
  }

  async scheduleMessage(
    threadId: string,
    message: AdapterPostableMessage,
    options: { postAt: Date },
  ): Promise<ScheduledMessage<TelnyxRawMessage>> {
    const thread = this.decodeThreadId(threadId);
    if (thread.recipients.length > 1) {
      throw new NotImplementedError(
        "Telnyx does not support scheduling group MMS messages",
        "scheduleMessage",
      );
    }
    const body = this.renderPostableText(message);
    const mediaUrls = this.mediaUrls(message);
    if (!body && mediaUrls.length === 0) {
      throw new ValidationError("telnyx", "Message text cannot be empty");
    }

    const raw = await this.withApiErrors(() =>
      scheduleTelnyxMessage({
        ...this.apiOptions(),
        ...senderFields(thread.sender),
        mediaUrls,
        sendAt: options.postAt.toISOString(),
        text:
          body || mediaUrls.length === 0
            ? telnyxTextOrPlaceholder(body)
            : undefined,
        to: thread.recipients[0],
        type: mediaUrls.length > 0 ? "MMS" : "SMS",
        webhookUrl:
          typeof this.webhookUrl === "string" ? this.webhookUrl : undefined,
      }),
    );

    return {
      cancel: () =>
        cancelScheduledTelnyxMessage({
          ...this.apiOptions(),
          messageId: raw.id,
        }),
      channelId: this.channelIdFromThreadId(threadId),
      postAt: options.postAt,
      raw,
      scheduledMessageId: raw.id,
    };
  }

  async editMessage(): Promise<RawMessage<TelnyxRawMessage>> {
    throw new NotImplementedError(
      "Telnyx does not support editing sent SMS/MMS messages",
      "editMessage",
    );
  }

  async deleteMessage(): Promise<void> {
    // Telnyx cannot remove an already-sent message. `cancelScheduledTelnyxMessage`
    // covers the one deletion-like operation the API supports.
    throw new NotImplementedError(
      "Telnyx does not support deleting sent messages; use cancelScheduledTelnyxMessage for scheduled messages",
      "deleteMessage",
    );
  }

  async addReaction(): Promise<void> {
    throw new NotImplementedError(
      "Telnyx does not support message reactions",
      "addReaction",
    );
  }

  async removeReaction(): Promise<void> {
    throw new NotImplementedError(
      "Telnyx does not support message reactions",
      "removeReaction",
    );
  }

  async startTyping(): Promise<void> {
    // SMS has no typing indicator.
  }

  async fetchMessage(
    threadId: string,
    messageId: string,
  ): Promise<Message<TelnyxRawMessage> | null> {
    const thread = this.decodeThreadId(threadId);
    try {
      const raw = await fetchTelnyxMessage({
        ...this.apiOptions(),
        messageId,
      });
      return messageFromResource({
        converter: this.formatConverter,
        fetchImplementation: this.fetchImplementation,
        raw,
        resource: raw,
        thread: threadFromResource(raw, { fallback: thread }),
      });
    } catch {
      return null;
    }
  }

  async fetchMessages(
    _threadId: string,
    _options: FetchOptions = {},
  ): Promise<FetchResult<TelnyxRawMessage>> {
    // Telnyx exposes retrieve-by-id (`GET /messages/{id}`) but no list
    // endpoint; historical messages are only available through MDR reports.
    // Per-thread history is persisted by Chat SDK (persistThreadHistory).
    return { messages: [] };
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const thread = this.decodeThreadId(threadId);
    return {
      channelId: this.channelIdFromThreadId(threadId),
      channelName: thread.sender,
      id: threadId,
      isDM: thread.recipients.length === 1,
      metadata: { recipients: thread.recipients, sender: thread.sender },
    };
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    return {
      fullName: userId,
      isBot: false,
      userId,
      userName: userId,
    };
  }

  async openDM(userId: string): Promise<string> {
    return this.encodeThreadId({
      recipients: [userId],
      sender: this.defaultSender(),
    });
  }

  isDM(threadId: string): boolean {
    return decodeTelnyxThreadId(threadId).recipients.length === 1;
  }

  channelIdFromThreadId(threadId: string): string {
    return telnyxChannelId(threadId);
  }

  encodeThreadId(platformData: TelnyxThreadId): string {
    return encodeTelnyxThreadId(platformData);
  }

  decodeThreadId(threadId: string): TelnyxThreadId {
    return decodeTelnyxThreadId(threadId);
  }

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content);
  }

  rehydrateAttachment(attachment: Attachment): Attachment {
    const url = attachment.fetchMetadata?.telnyxMediaUrl ?? attachment.url;
    if (!(url && HTTP_URL_PATTERN.test(url))) {
      return attachment;
    }
    return attachmentFromMedia(
      { content_type: attachment.mimeType, url },
      this.fetchImplementation,
    );
  }

  protected renderPostableText(message: AdapterPostableMessage): string {
    const card = extractCard(message);
    const text = card
      ? cardToTelnyxText(card) || TELNYX_EMPTY_CARD_FALLBACK
      : this.formatConverter.renderPostable(message);
    return truncateTelnyxText(text, { limit: TELNYX_MESSAGE_LIMIT }).text;
  }

  protected mediaUrls(message: AdapterPostableMessage): string[] {
    const files = extractFiles(message);
    if (files.length > 0) {
      throw new ValidationError(
        "telnyx",
        "Telnyx supports media attachments by public URL only; upload the file and pass its URL",
      );
    }
    const mediaUrls: string[] = [];
    for (const attachment of extractPostableAttachments(message)) {
      if (typeof attachment.url !== "string" || attachment.url.length === 0) {
        throw new ValidationError(
          "telnyx",
          "Telnyx supports media attachments by public URL only",
        );
      }
      mediaUrls.push(attachment.url);
    }
    return mediaUrls;
  }

  protected apiOptions(): TelnyxApiOptions {
    return {
      apiBaseUrl: this.apiBaseUrl,
      apiKey: this.apiKey,
      fetch: this.fetchImplementation,
    };
  }

  /** Run an API operation, translating failures into Chat SDK errors. */
  protected async withApiErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapTelnyxError(error);
    }
  }

  protected defaultSender(): string {
    const sender = this.phoneNumber ?? this.messagingProfileId;
    if (!sender) {
      throw new ValidationError(
        "telnyx",
        "phoneNumber or messagingProfileId is required",
      );
    }
    return sender;
  }
}

const HTTP_URL_PATTERN = /^https?:\/\//;
