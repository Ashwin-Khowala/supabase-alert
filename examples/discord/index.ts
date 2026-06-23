/**
 * Example: Using @supabase-alerts/core with Discord
 *
 * Required env vars:
 *   DISCORD_WEBHOOK_URL — from Server Settings → Integrations → Webhooks
 *
 * Run locally:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... deno run --allow-net --allow-env index.ts
 */

import { createNotifier } from "jsr:@supabase-alerts/core";

const alert = createNotifier({
  channel: "discord",
  discordWebhookUrl: Deno.env.get("DISCORD_WEBHOOK_URL")!,
  projectName: "MyApp",
  minSeverity: "warn",
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    jitterMs: 500,
  },
});

Deno.serve(async (req: Request) => {
  try {
    // Example: check for missing auth header
    if (!req.headers.get("authorization")) {
      alert.warn("auth-guard", new Error("Missing authorization header"), {
        ip: req.headers.get("x-forwarded-for") ?? "unknown",
        path: new URL(req.url).pathname,
      });
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response(JSON.stringify({ authenticated: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    alert.error("auth-guard", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
