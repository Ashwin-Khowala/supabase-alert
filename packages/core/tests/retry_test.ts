/**
 * Tests for retry.ts — exponential backoff with jitter.
 */

import { assertEquals, assertMatch } from "@std/assert";
import { withRetry } from "../retry.ts";

Deno.test("withRetry: succeeds on first attempt", async () => {
  let calls = 0;
  await withRetry(() => {
    calls++;
  });
  assertEquals(calls, 1);
});

Deno.test("withRetry: retries on failure and succeeds on second attempt", async () => {
  let calls = 0;
  await withRetry(
    () => {
      calls++;
      if (calls < 2) throw new Error("transient");
    },
    { maxAttempts: 3, baseDelayMs: 1, jitterMs: 0 },
  );
  assertEquals(calls, 2);
});

Deno.test("withRetry: exhausts attempts and does NOT throw", async () => {
  let calls = 0;
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => logged.push(args.join(" "));

  await withRetry(
    () => {
      calls++;
      throw new Error("always fails");
    },
    { maxAttempts: 3, baseDelayMs: 1, jitterMs: 0, channel: "telegram" },
  );

  console.error = originalError;

  assertEquals(calls, 3);
  // Should log a setup-hint message
  assertEquals(logged.length, 1);
  assertMatch(logged[0], /Delivery failed after 3 attempt/);
  assertMatch(logged[0], /telegram/);
  assertMatch(logged[0], /always fails/);
});

Deno.test("withRetry: logs channel name and token/webhook hint", async () => {
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => logged.push(args.join(" "));

  await withRetry(
    () => {
      throw new Error("bad token");
    },
    { maxAttempts: 2, baseDelayMs: 1, jitterMs: 0, channel: "discord" },
  );

  console.error = originalError;

  assertMatch(logged[0], /discord/);
  assertMatch(logged[0], /token \/ webhook/);
});

Deno.test("withRetry: does not retry on success (call count = 1)", async () => {
  let calls = 0;
  await withRetry(() => {
    calls++;
  }, { maxAttempts: 5, baseDelayMs: 1, jitterMs: 0 });
  assertEquals(calls, 1);
});
