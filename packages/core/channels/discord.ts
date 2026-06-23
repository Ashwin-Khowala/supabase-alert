/**
 * Discord channel transport.
 *
 * Sends a rich embed to a Discord Webhook URL.
 * Severity maps to distinct embed colors for instant visual recognition.
 */

import type { AlertPayload, NotifierConfig } from "../types.ts";

/** Discord embed colors (decimal). */
const SEVERITY_COLOR: Record<string, number> = {
  info: 0x36a3eb, // blue
  warn: 0xf5a623, // amber
  error: 0xd0021b, // red
  critical: 0x7b0000, // dark red
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🔴",
  critical: "🚨",
};

/** Build a Discord Webhook embed payload. */
function buildPayload(payload: AlertPayload): unknown {
  const emoji = SEVERITY_EMOJI[payload.severity] ?? "📣";
  const color = SEVERITY_COLOR[payload.severity] ?? 0x888888;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: "Error",
      value: `\`\`\`${payload.err.message.slice(0, 1000)}\`\`\``,
    },
  ];

  if (payload.err.stack) {
    const stack = payload.err.stack.split("\n").slice(0, 6).join("\n");
    fields.push({
      name: "Stack (truncated)",
      value: `\`\`\`${stack.slice(0, 1000)}\`\`\``,
    });
  }

  if (payload.meta && Object.keys(payload.meta).length > 0) {
    for (const [k, v] of Object.entries(payload.meta)) {
      fields.push({
        name: k,
        value: `\`${String(v).slice(0, 500)}\``,
        inline: true,
      });
    }
  }

  return {
    embeds: [
      {
        title:
          `${emoji} [${payload.severity.toUpperCase()}] ${payload.context}`,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: {
          text: "supabase-alerts",
        },
      },
    ],
  };
}

/**
 * Send an alert via Discord Webhook.
 * Throws on non-2xx so the retry layer can catch it.
 */
export async function sendDiscord(
  payload: AlertPayload,
  config: NotifierConfig,
): Promise<void> {
  const webhookUrl = config.discordWebhookUrl;

  if (!webhookUrl) {
    throw new Error(
      "Discord config incomplete: discordWebhookUrl is required.",
    );
  }

  const body = JSON.stringify(buildPayload(payload));

  const debug = Deno.env.get("SUPABASE_ALERTS_DEBUG") === "true";
  if (debug) {
    console.log(`[supabase-alerts:debug] discord POST → ${webhookUrl}`);
    console.log(`[supabase-alerts:debug] body:`, body);
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (res.status < 200 || res.status >= 300) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`Discord webhook error ${res.status}: ${text}`);
  }
}
