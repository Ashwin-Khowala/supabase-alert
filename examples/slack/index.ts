/**
 * Example: Using @ashwinkh/supabase-alerts with Slack
 *
 * Required env vars:
 *   SLACK_WEBHOOK_URL — Incoming Webhook URL from Slack App settings
 *
 * Run locally:
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... deno run --allow-net --allow-env index.ts
 */
// deno-lint-ignore-file no-import-prefix no-unversioned-import
import { createNotifier } from "jsr:@ashwinkh/supabase-alerts";

const alert = createNotifier({
  channel: "slack",
  slackWebhookUrl: Deno.env.get("SLACK_WEBHOOK_URL")!,
  projectName: "MyApp",
  minSeverity: "info",
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    jitterMs: 500,
  },
});

Deno.serve(async (req: Request) => {
  try {
    // Your edge function logic here
    const body = await req.json();
    console.log("Processing:", body);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    alert.critical("order-processor", err, {
      endpoint: req.url,
      method: req.method,
    });

    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
