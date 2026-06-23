/**
 * createNotifier — the main factory for @supabase-alerts/core.
 *
 * Returns a notifier object with convenience methods (info, warn, error, critical)
 * and a raw `notify` method.
 *
 * All delivery is **fire-and-forget**: calling `alert.error(...)` returns
 * immediately; the channel POST happens in a background promise with
 * exponential backoff + jitter. On exhausting retries a descriptive
 * console.error is logged so the user knows to check their setup.
 */

import type {
  AlertMeta,
  AlertPayload,
  NotifierConfig,
  Severity,
} from "./types.ts";
import { withRetry } from "./retry.ts";
import { sendTelegram } from "./channels/telegram.ts";
import { sendSlack } from "./channels/slack.ts";
import { sendDiscord } from "./channels/discord.ts";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

/** The object returned by `createNotifier`. */
export interface Notifier {
  /** Send an info-severity alert. */
  info(context: string, error: unknown, meta?: AlertMeta): void;
  /** Send a warn-severity alert. */
  warn(context: string, error: unknown, meta?: AlertMeta): void;
  /** Send an error-severity alert. */
  error(context: string, error: unknown, meta?: AlertMeta): void;
  /** Send a critical-severity alert. */
  critical(context: string, error: unknown, meta?: AlertMeta): void;
  /** Send an alert with an explicit severity. */
  notify(
    context: string,
    error: unknown,
    severity?: Severity,
    meta?: AlertMeta,
  ): void;
}

/**
 * Create a notifier bound to the given configuration.
 *
 * @example
 * ```ts
 * import { createNotifier } from 'jsr:@supabase-alerts/core';
 *
 * const alert = createNotifier({
 *   channel: 'telegram',
 *   telegramToken: Deno.env.get('TELEGRAM_BOT_TOKEN')!,
 *   telegramChatId: Deno.env.get('TELEGRAM_CHAT_ID')!,
 *   projectName: 'MyApp',
 *   minSeverity: 'warn',
 * });
 *
 * // In your edge function:
 * alert.error('payments-webhook', err, { userId: '123' });
 * // ^ returns immediately, delivers in background with retries
 * ```
 */
export function createNotifier(config: NotifierConfig): Notifier {
  const minRank = SEVERITY_RANK[config.minSeverity ?? "warn"];

  const retryOpts = {
    maxAttempts: config.retry?.maxAttempts ?? 3,
    baseDelayMs: config.retry?.baseDelayMs ?? 1000,
    jitterMs: config.retry?.jitterMs ?? 500,
    channel: config.channel,
  };

  function notify(
    context: string,
    error: unknown,
    severity: Severity = "error",
    meta?: AlertMeta,
  ): void {
    // Drop if below configured minimum severity
    if (SEVERITY_RANK[severity] < minRank) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const prefix = config.projectName ? `[${config.projectName}] ` : "";
    const payload: AlertPayload = {
      context: `${prefix}${context}`,
      err,
      severity,
      meta,
    };

    // Fire-and-forget: never await this
    withRetry(
      () => dispatch(payload, config),
      retryOpts,
    );
  }

  return {
    info: (ctx, err, meta) => notify(ctx, err, "info", meta),
    warn: (ctx, err, meta) => notify(ctx, err, "warn", meta),
    error: (ctx, err, meta) => notify(ctx, err, "error", meta),
    critical: (ctx, err, meta) => notify(ctx, err, "critical", meta),
    notify,
  };
}

/** Route the payload to the correct channel transport. */
async function dispatch(
  payload: AlertPayload,
  config: NotifierConfig,
): Promise<void> {
  switch (config.channel) {
    case "telegram":
      await sendTelegram(payload, config);
      break;
    case "slack":
      await sendSlack(payload, config);
      break;
    case "discord":
      await sendDiscord(payload, config);
      break;
    default: {
      // TypeScript exhaustiveness guard
      const _exhaustive: never = config.channel;
      throw new Error(`Unknown channel: ${_exhaustive}`);
    }
  }
}
