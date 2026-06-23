/**
 * Tests for channels/telegram.ts transport.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { sendTelegram } from "../channels/telegram.ts";
import type { AlertPayload } from "../types.ts";

const PAYLOAD: AlertPayload = {
  context: "[Test] my-function",
  err: new Error("something went wrong"),
  severity: "error",
  meta: { userId: "u_1" },
};

const BASE_CONFIG = {
  channel: "telegram" as const,
  telegramToken: "bot_tok",
  telegramChatId: "12345",
};

function stubFetch(_ok: boolean, status = 200, text = "ok") {
  const calls: { url: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({
      url: String(input),
      body: JSON.parse(init?.body as string ?? "{}"),
    });
    return Promise.resolve(new Response(text, { status }));
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

Deno.test("telegram: sends to correct API endpoint", async () => {
  const { calls, restore } = stubFetch(true);
  await sendTelegram(PAYLOAD, BASE_CONFIG);
  restore();
  assertEquals(calls[0].url, "https://api.telegram.org/botbot_tok/sendMessage");
});

Deno.test("telegram: uses HTML parse mode", async () => {
  const { calls, restore } = stubFetch(true);
  await sendTelegram(PAYLOAD, BASE_CONFIG);
  restore();
  const body = calls[0].body as Record<string, unknown>;
  assertEquals(body.parse_mode, "HTML");
});

Deno.test("telegram: body contains chat_id and text", async () => {
  const { calls, restore } = stubFetch(true);
  await sendTelegram(PAYLOAD, BASE_CONFIG);
  restore();
  const body = calls[0].body as Record<string, unknown>;
  assertEquals(body.chat_id, "12345");
  assertEquals(typeof body.text, "string");
  assertEquals((body.text as string).includes("ERROR"), true);
  assertEquals((body.text as string).includes("something went wrong"), true);
});

Deno.test("telegram: throws on non-2xx response", async () => {
  const { restore } = stubFetch(false, 401, '{"error":"Unauthorized"}');
  await assertRejects(
    () => sendTelegram(PAYLOAD, BASE_CONFIG),
    Error,
    "Telegram API error 401",
  );
  restore();
});

Deno.test("telegram: throws if token is missing", async () => {
  await assertRejects(
    () => sendTelegram(PAYLOAD, { channel: "telegram", telegramChatId: "123" }),
    Error,
    "telegramToken",
  );
});

Deno.test("telegram: throws if chatId is missing", async () => {
  await assertRejects(
    () => sendTelegram(PAYLOAD, { channel: "telegram", telegramToken: "tok" }),
    Error,
    "telegramChatId",
  );
});
