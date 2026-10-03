/**
 * Telnyx API transport: credential resolution, request signing, and JSON
 * envelope handling. Deliberately free of any `chat` dependency.
 */

import { TelnyxApiError } from "./errors";
import type {
  CallTelnyxApiOptions,
  TelnyxApiResponse,
  TelnyxCredential,
  TelnyxErrorEnvelope,
} from "./types";

export const DEFAULT_API_BASE_URL = "https://api.telnyx.com/v2";

/**
 * Resolve a credential from an explicit config value or an environment
 * variable. Config values may be strings or lazily-invoked functions.
 */
export async function resolveTelnyxCredential(
  value: TelnyxCredential | undefined,
  environmentName: string,
): Promise<string> {
  const source = value ?? process.env[environmentName];
  if (!source) {
    throw new TelnyxApiError(`${environmentName} is required`, {
      body: null,
      status: 0,
    });
  }
  return typeof source === "function" ? await source() : source;
}

export async function callTelnyxApi(
  pathOrOptions: CallTelnyxApiOptions | string,
  options: Omit<CallTelnyxApiOptions, "path"> = {},
): Promise<TelnyxApiResponse> {
  const requestOptions =
    typeof pathOrOptions === "string"
      ? { ...options, path: pathOrOptions }
      : pathOrOptions;

  const apiKey = await resolveTelnyxCredential(
    requestOptions.apiKey,
    "TELNYX_API_KEY",
  );
  const url = buildUrl(requestOptions);
  const hasBody = requestOptions.body !== undefined;
  const request = requestOptions.fetch ?? fetch;

  const response = await sendRequest(request, url, {
    body: hasBody ? JSON.stringify(requestOptions.body) : undefined,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    method: requestOptions.method ?? "POST",
  });

  const responseBody = await parseJsonResponse(response);
  if (!response.ok) {
    throw new TelnyxApiError(
      extractErrorMessage(responseBody) ??
        `Telnyx API returned HTTP ${response.status}`,
      { body: responseBody, status: response.status },
    );
  }
  return { body: responseBody, ok: response.ok, status: response.status };
}

/** Unwrap the `{ data: ... }` envelope Telnyx wraps responses in. */
export function unwrapData<T>(body: unknown): T {
  if (isRecord(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function buildUrl(options: CallTelnyxApiOptions): URL {
  const base = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(options.path.replace(/^\/+/, ""), normalizedBase);
  for (const [key, value] of Object.entries(options.search ?? {})) {
    url.searchParams.append(key, String(value));
  }
  return url;
}

async function sendRequest(
  request: typeof fetch,
  url: URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await request(url, init);
  } catch (error) {
    throw new TelnyxApiError(
      `Network error calling Telnyx: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { body: null, status: 0 },
    );
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  const first = (body as TelnyxErrorEnvelope).errors?.[0];
  return first?.detail ?? first?.title ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
