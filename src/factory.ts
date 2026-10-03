import { TelnyxAdapter } from "./adapter";
import type { TelnyxAdapterConfig } from "./types";

/** Create a Telnyx adapter, reading missing credentials from the environment. */
export function createTelnyxAdapter(
  config: TelnyxAdapterConfig = {},
): TelnyxAdapter {
  return new TelnyxAdapter(config);
}
