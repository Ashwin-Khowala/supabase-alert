/**
 * Slack channel transport.
 *
 * Sends a Block Kit message to a Slack Incoming Webhook URL.
 * Each severity maps to a distinct color for the side-bar attachment.
 */

import type { AlertPayload, NotifierConfig } from "../types.ts";

const SEVERITY_COLOR: Record<string, string> = {
  info: "#36a3eb",
  warn: "#f5a623",
  error: "#d0021b",
  critical: "#7b0000",
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🔴",
  critical: "🚨",
};

/** Build a Slack Block Kit message payload. */
function buildPayload(payload: AlertPayload): unknown {
  const emoji = SEVERITY_EMOJI[payload.severity] ?? "📣";
  const color = SEVERITY_COLOR[payload.severity] ?? "#888888";

  const fields: { type: string; text: { type: string; text: string } }[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Error:*\n\`\`\`${payload.err.message}\`\`\``,
      },
    },
  ];

  if (payload.err.stack) {
    const stack = payload.err.stack.split("\n").slice(0, 6).join("\n");
    fields.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Stack (truncated):*\n\`\`\`${stack}\`\`\``,
      },
    });
  }

  if (payload.meta && Object.keys(payload.meta).length > 0) {
    const metaText = Object.entries(payload.meta)
      .map(([k, v]) => `• *${k}*: \`${String(v)}\``)
      .join("\n");
    fields.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Meta:*\n${metaText}` },
    });
  }

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text:
                `${emoji} [${payload.severity.toUpperCase()}] ${payload.context}`,
              emoji: true,
            },
          },
          ...fields,
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `<!date^${
                  Math.floor(Date.now() / 1000)
                }^{date_short_pretty} at {time_secs}|${
                  new Date().toISOString()
                }>`,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Send an alert via Slack Incoming Webhook.
 * Throws on non-2xx so the retry layer can catch it.
 */
export async function sendSlack(
  payload: AlertPayload,
  config: NotifierConfig,
): Promise<void> {
  const webhookUrl = config.slackWebhookUrl;

  if (!webhookUrl) {
    throw new Error(
      "Slack config incomplete: slackWebhookUrl is required.",
    );
  }

  const body = JSON.stringify(buildPayload(payload));

  const debug = Deno.env.get("SUPABASE_ALERTS_DEBUG") === "true";
  if (debug) {
    console.log(`[supabase-alerts:debug] slack POST → ${webhookUrl}`);
    console.log(`[supabase-alerts:debug] body:`, body);
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`Slack webhook error ${res.status}: ${text}`);
  }
}
