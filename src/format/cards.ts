import { cardToFallbackText } from "@chat-adapter/shared";
import type { CardElement } from "chat";

/**
 * Plain SMS/MMS has no native buttons or cards, so every card renders to its
 * fallback text. Button labels and links survive as text.
 */
export const TELNYX_EMPTY_CARD_FALLBACK = "Message from bot";

export function cardToTelnyxText(card: CardElement): string {
  return cardToFallbackText(card).replace(/\*/g, "");
}
