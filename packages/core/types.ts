/**
 * Shared types for @supabase-alerts/core
 */

/** Alert severity level. */
export type Severity = "info" | "warn" | "error" | "critical";

/** Supported notification channels. */
export type Channel = "telegram" | "slack" | "discord";

/** Retry configuration for delivery. */
export interface RetryConfig {
  /**
   * Maximum number of delivery attempts (including the first).
   * @default 3
   */
  maxAttempts?: number;
  /**
   * Base delay in milliseconds for exponential backoff.
   * Actual delay = baseDelayMs * 2^(attempt-1) + random jitter up to jitterMs.
   * @default 1000
   */
  baseDelayMs?: number;
  /**
   * Maximum jitter in milliseconds added to each backoff delay.
   * @default 500
   */
  jitterMs?: number;
}

/** Configuration passed to `createNotifier`. */
export interface NotifierConfig {
  /** The channel to send alerts through. */
  channel: Channel;

  // --- Telegram ---
  /** Telegram Bot API token (required when channel = 'telegram'). */
  telegramToken?: string;
  /** Telegram chat ID to send messages to (required when channel = 'telegram'). */
  telegramChatId?: string;

  // --- Slack ---
  /** Slack Incoming Webhook URL (required when channel = 'slack'). */
  slackWebhookUrl?: string;

  // --- Discord ---
  /** Discord Webhook URL (required when channel = 'discord'). */
  discordWebhookUrl?: string;

  // --- Optional ---
  /**
   * Project name prefix added to every alert, e.g. "[MyApp]".
   * Helps distinguish alerts when multiple projects share a channel.
   */
  projectName?: string;
  /**
   * Suppress alerts below this severity level.
   * @default 'warn'
   */
  minSeverity?: Severity;
  /**
   * Retry configuration for failed deliveries.
   * Retries happen in the background — the calling function is never blocked.
   */
  retry?: RetryConfig;
}

/** Arbitrary key-value metadata attached to an alert. */
export interface AlertMeta {
  [key: string]: unknown;
}

/** Internal payload passed to channel transports. */
export interface AlertPayload {
  context: string;
  err: Error;
  severity: Severity;
  meta?: AlertMeta;
}
