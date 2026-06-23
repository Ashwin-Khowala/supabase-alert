/**
 * Tests for channels/discord.ts transport.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { sendDiscord } from "../channels/discord.ts";
import type { AlertPayload } from "../types.ts";

const PAYLOAD: AlertPayload = {
  context: "[Test] cron-job",
  err: new Error("Cron failed"),
  severity: "warn",
  meta: { jobId: "job_7" },
};

const BASE_CONFIG = {
  channel: "discord" as const,
  discordWebhookUrl: "https://discord.com/api/webhooks/fake/token",
};

function stubFetch(_ok: boolean, status = 200, text = "") {
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

Deno.test("discord: posts to webhook URL", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  assertEquals(calls[0].url, "https://discord.com/api/webhooks/fake/token");
});

Deno.test("discord: body has embeds array", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  const body = calls[0].body as { embeds: unknown[] };
  assertEquals(Array.isArray(body.embeds), true);
  assertEquals(body.embeds.length, 1);
});

Deno.test("discord: embed has numeric color", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  const embed = (calls[0].body as { embeds: { color: unknown }[] }).embeds[0];
  assertEquals(typeof embed.color, "number");
});

Deno.test("discord: embed title contains severity and context", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  const embed = (calls[0].body as { embeds: { title: string }[] }).embeds[0];
  assertEquals(embed.title.includes("WARN"), true);
  assertEquals(embed.title.includes("cron-job"), true);
});

Deno.test("discord: embed has timestamp field", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  const embed =
    (calls[0].body as { embeds: { timestamp: string }[] }).embeds[0];
  assertEquals(typeof embed.timestamp, "string");
});

Deno.test("discord: meta fields are present in embed fields", async () => {
  const { calls, restore } = stubFetch(true);
  await sendDiscord(PAYLOAD, BASE_CONFIG);
  restore();
  const embed =
    (calls[0].body as { embeds: { fields: { name: string }[] }[] }).embeds[0];
  const names = embed.fields.map((f) => f.name);
  assertEquals(names.includes("jobId"), true);
});

Deno.test("discord: throws on non-2xx response", async () => {
  const { restore } = stubFetch(false, 400, "bad_request");
  await assertRejects(
    () => sendDiscord(PAYLOAD, BASE_CONFIG),
    Error,
    "Discord webhook error 400",
  );
  restore();
});

Deno.test("discord: throws if webhookUrl is missing", async () => {
  await assertRejects(
    () => sendDiscord(PAYLOAD, { channel: "discord" }),
    Error,
    "discordWebhookUrl",
  );
});
