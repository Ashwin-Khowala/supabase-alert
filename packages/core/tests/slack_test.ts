/**
 * Tests for channels/slack.ts transport.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { sendSlack } from "../channels/slack.ts";
import type { AlertPayload } from "../types.ts";

const PAYLOAD: AlertPayload = {
  context: "[Test] payments-webhook",
  err: new Error("Payment failed"),
  severity: "critical",
  meta: { orderId: "ord_99" },
};

const BASE_CONFIG = {
  channel: "slack" as const,
  slackWebhookUrl: "https://hooks.slack.com/services/fake/webhook",
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

Deno.test("slack: posts to webhook URL", async () => {
  const { calls, restore } = stubFetch(true);
  await sendSlack(PAYLOAD, BASE_CONFIG);
  restore();
  assertEquals(calls[0].url, "https://hooks.slack.com/services/fake/webhook");
});

Deno.test("slack: body has attachments array", async () => {
  const { calls, restore } = stubFetch(true);
  await sendSlack(PAYLOAD, BASE_CONFIG);
  restore();
  const body = calls[0].body as { attachments: unknown[] };
  assertEquals(Array.isArray(body.attachments), true);
  assertEquals(body.attachments.length, 1);
});

Deno.test("slack: attachment has color", async () => {
  const { calls, restore } = stubFetch(true);
  await sendSlack(PAYLOAD, BASE_CONFIG);
  restore();
  const att =
    (calls[0].body as { attachments: { color: string }[] }).attachments[0];
  assertEquals(typeof att.color, "string");
  assertEquals(att.color.startsWith("#"), true);
});

Deno.test("slack: header block contains context and severity", async () => {
  const { calls, restore } = stubFetch(true);
  await sendSlack(PAYLOAD, BASE_CONFIG);
  restore();
  const att = (calls[0].body as {
    attachments: { blocks: { text: { text: string } }[] }[];
  }).attachments[0];
  const header = att.blocks[0].text.text;
  assertEquals(header.includes("CRITICAL"), true);
  assertEquals(header.includes("payments-webhook"), true);
});

Deno.test("slack: throws on non-2xx response", async () => {
  const { restore } = stubFetch(false, 403, "no_service");
  await assertRejects(
    () => sendSlack(PAYLOAD, BASE_CONFIG),
    Error,
    "Slack webhook error 403",
  );
  restore();
});

Deno.test("slack: throws if webhookUrl is missing", async () => {
  await assertRejects(
    () => sendSlack(PAYLOAD, { channel: "slack" }),
    Error,
    "slackWebhookUrl",
  );
});
