/**
 * Example: Using @supabase-alerts/core with Telegram
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your chat or group ID
 *
 * Run locally:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy deno run --allow-net --allow-env index.ts
 */

import { createNotifier } from "jsr:@supabase-alerts/core";

const alert = createNotifier({
  channel: "telegram",
  telegramToken: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
  telegramChatId: Deno.env.get("TELEGRAM_CHAT_ID")!,
  projectName: "MyApp",
  minSeverity: "warn",
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    jitterMs: 500,
  },
});

// Simulate a Supabase Edge Function handler
Deno.serve(async (req: Request) => {
  try {
    // Simulate some work that might fail
    if (Math.random() > 0.5) {
      throw new Error("Simulated payment processing failure");
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Fire-and-forget: returns immediately, delivers in background
    alert.error("payments-webhook", err, {
      userId: req.headers.get("x-user-id") ?? "anonymous",
      requestId: crypto.randomUUID(),
    });

    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
