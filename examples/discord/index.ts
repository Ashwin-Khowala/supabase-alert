/**
 * Example: Using @ashwinkh/supabase-alerts with Discord
 *
 * Required env vars:
 *   DISCORD_WEBHOOK_URL — from Server Settings → Integrations → Webhooks
 *
 * Run locally:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... deno run --allow-net --allow-env index.ts
 */
// deno-lint-ignore-file no-import-prefix no-unversioned-import
import { createNotifier } from "jsr:@ashwinkh/supabase-alerts";

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

Deno.serve((req: Request) => {
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
