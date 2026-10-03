# chat-adapter-telnyx

[![npm version](https://img.shields.io/npm/v/chat-adapter-telnyx)](https://www.npmjs.com/package/chat-adapter-telnyx)
[![license](https://img.shields.io/npm/l/chat-adapter-telnyx)](./LICENSE)

Community [Telnyx](https://telnyx.com) adapter for [Chat SDK](https://chat-sdk.dev) — SMS and MMS bots with Ed25519-signed webhooks.

> Community adapter, not maintained by Vercel. The `@chat-adapter/*` scope is reserved for official adapters.

## Install

```bash
npm install chat-adapter-telnyx chat @chat-adapter/state-memory
```

Requires Chat SDK `^4` and Node `>=20`. Use Redis/Postgres state in production.

## Quick start

```typescript
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createTelnyxAdapter } from "chat-adapter-telnyx";

export const bot = new Chat({
  userName: "mybot",
  adapters: {
    telnyx: createTelnyxAdapter({
      apiKey: process.env.TELNYX_API_KEY!,
      phoneNumber: process.env.TELNYX_PHONE_NUMBER!,
      publicKey: process.env.TELNYX_PUBLIC_KEY!,
    }),
  },
  state: createMemoryState(),
});

bot.onDirectMessage(async (thread, message) => {
  await thread.post(`You said: ${message.text}`);
});
```

Route webhooks to `bot.webhooks.telnyx`:

```typescript
// Next.js App Router
import { after } from "next/server";
import { bot } from "@/lib/bot";

export const POST = (request: Request) =>
  bot.webhooks.telnyx(request, { waitUntil: (task) => after(() => task) });
```

## Configuration

The factory falls back to the env var when an option is omitted.

| Option                                                             | Env                           | Default                     |
| ------------------------------------------------------------------ | ----------------------------- | --------------------------- |
| `apiKey`                                                           | `TELNYX_API_KEY`              | —                           |
| `phoneNumber`                                                      | `TELNYX_PHONE_NUMBER`         | —                           |
| `messagingProfileId`                                               | `TELNYX_MESSAGING_PROFILE_ID` | —                           |
| `publicKey`                                                        | `TELNYX_PUBLIC_KEY`           | —                           |
| `timestampToleranceSeconds`                                        | —                             | `300` (max webhook age)     |
| `apiBaseUrl`                                                       | —                             | `https://api.telnyx.com/v2` |
| `webhookUrl` / `webhookVerifier` / `userName` / `logger` / `fetch` | —                             | —                           |

## Platform setup

1. **Keys & Credentials** → create a v2 API key (`TELNYX_API_KEY`) and copy your Public Key (`TELNYX_PUBLIC_KEY`).
2. **Messaging → Messaging Profiles** → attach a number (`TELNYX_PHONE_NUMBER` / `TELNYX_MESSAGING_PROFILE_ID`).
3. Set the profile webhook URL to `https://your-domain.com/api/webhooks/telnyx` and enable **Webhook Signing**.

## Features

- Inbound and outbound SMS/MMS, verified via Ed25519 webhooks
- Group MMS, scheduled sends, and media by public URL
- Delivery receipts, retrieve-by-id, and the standard Chat SDK error taxonomy
- No reactions, edits, typing indicators, or message listing (not supported by SMS/MMS or Telnyx)

## Usage notes

- **Group MMS** — thread IDs hold the recipient list; more than one recipient posts via `/messages/group_mms`. Set `phoneNumber` so the bot's own number is excluded from inbound groups.
- **Scheduling** — `await thread.schedule("...", { postAt })`; `cancel()` aborts it. 1:1 only.
- **Media** — inbound attachments expose `fetchData()` (Telnyx URLs expire after 30 days); outbound MMS accepts public `url`s only.
- **Errors** — failures map to `AuthenticationError`, `PermissionError`, `ResourceNotFoundError`, `AdapterRateLimitError`, and `NetworkError` from `@chat-adapter/shared`.

## Webhooks

Telnyx signs `{timestamp}|{body}` with Ed25519 (`telnyx-signature-ed25519` /
`telnyx-timestamp`). `handleWebhook` verifies it, rejects stale requests,
dispatches `message.received`, and returns `200` for delivery receipts. Use
`event.data.id` as an idempotency key — events may repeat and arrive out of order.

## Development

```bash
npm test          # vitest + coverage
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # tsup
```

Releases run through Changesets + npm trusted publishing on `main` (see
`.github/workflows/release.yml`).

## License

MIT
