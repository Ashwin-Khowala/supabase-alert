/**
 * Telegram channel transport.
 *
 * Sends a formatted HTML message to a Telegram chat via the Bot API.
 * Severity is indicated by an emoji prefix for quick scanning.
 */

import type { AlertPayload, NotifierConfig } from "../types.ts";

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🔴",
  critical: "🚨",
};

/**
 * Format the alert payload into a Telegram HTML message.
 * Telegram supports: <b>, <i>, <code>, <pre>, <a>.
 */
function formatMessage(payload: AlertPayload): string {
  const emoji = SEVERITY_EMOJI[payload.severity] ?? "📣";
  const lines: string[] = [
    `${emoji} <b>[${payload.severity.toUpperCase()}]</b> ${
      escapeHtml(payload.context)
    }`,
    ``,
    `<b>Error:</b> <code>${escapeHtml(payload.err.message)}</code>`,
  ];

  if (payload.err.stack) {
    const stack = payload.err.stack
      .split("\n")
      .slice(0, 6) // cap stack depth
      .join("\n");
    lines.push(``, `<pre>${escapeHtml(stack)}</pre>`);
  }

  if (payload.meta && Object.keys(payload.meta).length > 0) {
    lines.push(``, `<b>Meta:</b>`);
    for (const [k, v] of Object.entries(payload.meta)) {
      lines.push(
        `  <code>${escapeHtml(k)}</code>: <code>${
          escapeHtml(String(v))
        }</code>`,
      );
    }
  }

  lines.push(``, `<i>${new Date().toISOString()}</i>`);
  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send an alert via Telegram Bot API.
 * Throws on non-2xx responses so the retry layer can catch it.
 */
export async function sendTelegram(
  payload: AlertPayload,
  config: NotifierConfig,
): Promise<void> {
  const token = config.telegramToken;
  const chatId = config.telegramChatId;

  if (!token || !chatId) {
    throw new Error(
      "Telegram config incomplete: telegramToken and telegramChatId are required.",
    );
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: formatMessage(payload),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  const debug = Deno.env.get("SUPABASE_ALERTS_DEBUG") === "true";
  if (debug) {
    console.log(`[supabase-alerts:debug] telegram POST → ${url}`);
    console.log(`[supabase-alerts:debug] body:`, body);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`Telegram API error ${res.status}: ${text}`);
  }
}
