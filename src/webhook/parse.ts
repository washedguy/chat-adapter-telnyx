import { TelnyxWebhookParseError, type TelnyxWebhookEvent } from "./types";

/** Parse and validate a raw Telnyx webhook JSON body. */
export function parseTelnyxWebhookBody(body: string): TelnyxWebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new TelnyxWebhookParseError("Telnyx webhook body is not valid JSON");
  }
  if (!isTelnyxWebhookEvent(parsed)) {
    throw new TelnyxWebhookParseError(
      "Telnyx webhook body is missing data.event_type or data.payload",
    );
  }
  return parsed;
}

export function isTelnyxWebhookEvent(
  value: unknown,
): value is TelnyxWebhookEvent {
  if (!isRecord(value)) {
    return false;
  }
  const data = value.data;
  if (!isRecord(data)) {
    return false;
  }
  return (
    typeof data.event_type === "string" &&
    data.payload !== null &&
    typeof data.payload === "object"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
