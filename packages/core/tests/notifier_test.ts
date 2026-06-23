/**
 * Tests for notifier.ts — createNotifier factory.
 *
 * Uses a stub fetch to avoid real network calls.
 */

import { assertEquals } from "@std/assert";
import { createNotifier } from "../notifier.ts";

// ---------------------------------------------------------------------------
// fetch stub helpers
// ---------------------------------------------------------------------------

type FetchCall = { url: string; body: unknown };

function stubFetch(
  response: { ok: boolean; status: number; text: string },
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    calls.push({ url: String(input), body });
    return Promise.resolve(
      new Response(response.text, { status: response.status }),
    );
  };

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// Wait a tick so fire-and-forget promises resolve
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

// ---------------------------------------------------------------------------
// Severity filtering
// ---------------------------------------------------------------------------

Deno.test("notifier: drops alerts below minSeverity", async () => {
  const { calls, restore } = stubFetch({ ok: true, status: 200, text: "ok" });

  const alert = createNotifier({
    channel: "telegram",
    telegramToken: "tok",
    telegramChatId: "chat",
    minSeverity: "error",
    retry: { maxAttempts: 1, baseDelayMs: 0, jitterMs: 0 },
  });

  alert.info("ctx", new Error("below threshold"));
  alert.warn("ctx", new Error("also below"));
  await flushMicrotasks();

  restore();
  assertEquals(calls.length, 0);
});

Deno.test("notifier: passes alerts at or above minSeverity", async () => {
  const { calls, restore } = stubFetch({ ok: true, status: 200, text: "ok" });

  const alert = createNotifier({
    channel: "telegram",
    telegramToken: "tok",
    telegramChatId: "chat",
    minSeverity: "warn",
    retry: { maxAttempts: 1, baseDelayMs: 0, jitterMs: 0 },
  });

  alert.warn("ctx", new Error("pass"));
  alert.error("ctx", new Error("pass"));
  alert.critical("ctx", new Error("pass"));
  await flushMicrotasks();

  restore();
  assertEquals(calls.length, 3);
});

// ---------------------------------------------------------------------------
// projectName prefix
// ---------------------------------------------------------------------------

Deno.test("notifier: prepends projectName to context", async () => {
  const { calls, restore } = stubFetch({ ok: true, status: 200, text: "ok" });

  const alert = createNotifier({
    channel: "slack",
    slackWebhookUrl: "https://hooks.slack.com/fake",
    projectName: "Fyndr",
    minSeverity: "info",
    retry: { maxAttempts: 1, baseDelayMs: 0, jitterMs: 0 },
  });

  alert.error("payments-webhook", new Error("boom"));
  await flushMicrotasks();

  restore();
  assertEquals(calls.length, 1);
  const body = calls[0].body as {
    attachments: { blocks: { text: { text: string } }[] }[];
  };
  const headerText = body.attachments[0].blocks[0].text.text as string;
  assertEquals(headerText.includes("[Fyndr]"), true);
});

// ---------------------------------------------------------------------------
// Coerces non-Error values to Error
// ---------------------------------------------------------------------------

Deno.test("notifier: coerces string error to Error object", async () => {
  const { calls, restore } = stubFetch({ ok: true, status: 200, text: "ok" });

  const alert = createNotifier({
    channel: "discord",
    discordWebhookUrl: "https://discord.com/api/webhooks/fake",
    minSeverity: "info",
    retry: { maxAttempts: 1, baseDelayMs: 0, jitterMs: 0 },
  });

  alert.error("ctx", "string error value");
  await flushMicrotasks();

  restore();
  assertEquals(calls.length, 1);
  const body = calls[0].body as { embeds: { fields: { value: string }[] }[] };
  const errorField = body.embeds[0].fields[0].value;
  assertEquals(errorField.includes("string error value"), true);
});

// ---------------------------------------------------------------------------
// Fire-and-forget: notify() does not throw on delivery failure
// ---------------------------------------------------------------------------

Deno.test("notifier: does not throw when delivery fails", async () => {
  const originalConsoleError = console.error;
  console.error = () => {}; // suppress expected error log

  const { restore } = stubFetch({
    ok: false,
    status: 500,
    text: "server error",
  });

  const alert = createNotifier({
    channel: "telegram",
    telegramToken: "bad-token",
    telegramChatId: "chat",
    minSeverity: "info",
    retry: { maxAttempts: 2, baseDelayMs: 1, jitterMs: 0 },
  });

  // Should not throw
  alert.error("ctx", new Error("test"));
  await flushMicrotasks();

  restore();
  console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Meta is passed through
// ---------------------------------------------------------------------------

Deno.test("notifier: meta is included in Discord embed fields", async () => {
  const { calls, restore } = stubFetch({ ok: true, status: 200, text: "ok" });

  const alert = createNotifier({
    channel: "discord",
    discordWebhookUrl: "https://discord.com/api/webhooks/fake",
    minSeverity: "info",
    retry: { maxAttempts: 1, baseDelayMs: 0, jitterMs: 0 },
  });

  alert.error("ctx", new Error("err"), { userId: "u_123", plan: "pro" });
  await flushMicrotasks();

  restore();
  const body = calls[0].body as { embeds: { fields: { name: string }[] }[] };
  const fieldNames = body.embeds[0].fields.map((f) => f.name);
  assertEquals(fieldNames.includes("userId"), true);
  assertEquals(fieldNames.includes("plan"), true);
});
