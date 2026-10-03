/** Error thrown when a Telnyx API request fails or a credential is missing. */
export class TelnyxApiError extends Error {
  /** Parsed response body, when available. */
  body: unknown;
  /** HTTP status code, or `0` for local configuration errors. */
  status: number;

  constructor(message: string, options: { body: unknown; status: number }) {
    super(message);
    this.name = "TelnyxApiError";
    this.body = options.body;
    this.status = options.status;
  }
}
