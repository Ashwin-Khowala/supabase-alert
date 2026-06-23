/**
 * Exponential backoff with full jitter for channel delivery retries.
 *
 * Strategy: fire-and-forget — the caller is never blocked.
 * The returned promise retries the operation up to `maxAttempts` times.
 * On final failure a descriptive console.error is emitted so the user knows
 * to check their channel config (token, webhook URL, etc.).
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  jitterMs: number;
  /** Label shown in the failure console.error (e.g. "telegram"). */
  channel: string;
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  jitterMs: 500,
  channel: "unknown",
};

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute the delay for a given attempt using exponential backoff + full jitter.
 *
 * delay = min(cap, base * 2^attempt) + random(0, jitterMs)
 *
 * The cap prevents unbounded waits on later attempts.
 */
function backoffDelay(attempt: number, opts: RetryOptions): number {
  const cap = opts.baseDelayMs * Math.pow(2, opts.maxAttempts); // soft cap
  const exponential = Math.min(cap, opts.baseDelayMs * Math.pow(2, attempt));
  const jitter = Math.random() * opts.jitterMs;
  return exponential + jitter;
}

/**
 * Retry `fn` up to `opts.maxAttempts` times with exponential backoff + jitter.
 *
 * - Never throws — all failures are caught.
 * - On exhausting attempts, emits a user-friendly `console.error` with setup hints.
 * - Designed to be called without `await` so the edge function is never blocked.
 */
export async function withRetry(
  fn: () => void | Promise<void>,
  opts: Partial<RetryOptions> = {},
): Promise<void> {
  const o: RetryOptions = { ...DEFAULT_RETRY, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt < o.maxAttempts; attempt++) {
    try {
      await fn();
      return; // success — done
    } catch (err) {
      lastError = err;

      const isLast = attempt === o.maxAttempts - 1;
      if (isLast) break;

      const delay = backoffDelay(attempt, o);
      await sleep(delay);
    }
  }

  // All attempts exhausted — log a human-friendly setup hint, never throw
  const errMsg = lastError instanceof Error
    ? lastError.message
    : String(lastError);

  console.error(
    `[supabase-alerts] ⚠ Delivery failed after ${o.maxAttempts} attempt(s) on channel "${o.channel}".\n` +
      `  Last error: ${errMsg}\n` +
      `  → Check your ${o.channel} config: token / webhook URL / chat ID.\n` +
      `  → Verify the bot has permission to post to the target chat/channel.\n` +
      `  → Set SUPABASE_ALERTS_DEBUG=true for full request details.`,
  );
}
