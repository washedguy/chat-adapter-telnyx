import {
  AdapterRateLimitError,
  AuthenticationError,
  NetworkError,
  PermissionError,
  ResourceNotFoundError,
} from "@chat-adapter/shared";
import { TelnyxApiError } from "./api";

const ADAPTER = "telnyx";

/**
 * Translate a raw Telnyx API failure into the Chat SDK's standardized error
 * taxonomy so callers can catch `AuthenticationError`, `NetworkError`, and
 * friends instead of inspecting HTTP status codes.
 *
 * Errors that already carry meaning (anything not a `TelnyxApiError`) pass
 * through untouched.
 */
export function mapTelnyxError(error: unknown): unknown {
  if (!(error instanceof TelnyxApiError)) {
    return error;
  }

  switch (error.status) {
    case 401:
      return new AuthenticationError(ADAPTER, error.message);
    case 403:
      return new PermissionError(ADAPTER, "perform the request");
    case 404:
      return new ResourceNotFoundError(ADAPTER, "message");
    case 429:
      return new AdapterRateLimitError(ADAPTER);
    case 0:
      // Local configuration errors and transport failures share status 0.
      return error.message.includes("is required")
        ? new AuthenticationError(ADAPTER, error.message)
        : new NetworkError(ADAPTER, error.message);
    default:
      return error;
  }
}
