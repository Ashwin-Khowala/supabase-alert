/**
 * @ashwinkh/supabase-alerts
 *
 * Zero-config alerting for Supabase Edge Functions.
 * Supports Telegram, Slack, and Discord with fire-and-forget delivery,
 * exponential backoff retries, and severity filtering.
 *
 * @example
 * ```ts
 * import { createNotifier } from 'jsr:@ashwinkh/supabase-alerts';
 *
 * const alert = createNotifier({
 *   channel: 'telegram',
 *   telegramToken: Deno.env.get('TELEGRAM_BOT_TOKEN')!,
 *   telegramChatId: Deno.env.get('TELEGRAM_CHAT_ID')!,
 *   projectName: 'MyApp',
 *   minSeverity: 'warn',
 * });
 *
 * Deno.serve(async (req) => {
 *   try {
 *     // your logic here
 *   } catch (err) {
 *     alert.error('my-function', err, { requestId: req.headers.get('x-request-id') });
 *     return new Response('Internal Server Error', { status: 500 });
 *   }
 * });
 * ```
 *
 * @module
 */

export { createNotifier } from "./notifier.ts";
export type { Notifier } from "./notifier.ts";
export type {
  AlertMeta,
  AlertPayload,
  Channel,
  NotifierConfig,
  RetryConfig,
  Severity,
} from "./types.ts";
