/**
 * Tests for the CLI init command.
 * Uses a temp directory to verify file output without touching the real FS.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp dir scoped to this test run. */
async function tempDir(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "supabase_alerts_cli_test_" });
  return dir;
}

/** Read file or return null if not found. */
async function readOrNull(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Direct unit tests for template loading and file writing logic
// (extracted from init.ts so we can test without stdin interaction)
// ---------------------------------------------------------------------------

async function scaffoldWatchdog(
  watchdog: string,
  targetDir: string,
): Promise<string> {
  const templateDir = new URL("../templates", import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, "$1");
  const sql = await Deno.readTextFile(
    join(templateDir, "sql", `${watchdog}.sql`),
  );
  await ensureDir(join(targetDir, "supabase", "migrations"));
  const filename = `20240101000000_supabase_alerts_${watchdog}.sql`;
  const dest = join(targetDir, "supabase", "migrations", filename);
  await Deno.writeTextFile(dest, sql);
  return dest;
}

async function scaffoldEdgeFn(
  targetDir: string,
  channel: string,
  projectName: string | undefined,
  minSeverity: string,
): Promise<string> {
  const templateDir = new URL("../templates", import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, "$1");
  let template = await Deno.readTextFile(
    join(templateDir, "edge-fn", "error-notifier", "index.ts"),
  );
  template = template
    .replace("__CHANNEL__", channel)
    .replace(
      "__PROJECT_NAME__",
      projectName ? `'${projectName}'` : "undefined",
    )
    .replace("__MIN_SEVERITY__", minSeverity);

  const dest = join(
    targetDir,
    "supabase",
    "functions",
    "error-notifier",
    "index.ts",
  );
  await ensureDir(join(targetDir, "supabase", "functions", "error-notifier"));
  await Deno.writeTextFile(dest, template);
  return dest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("CLI init: long_queries SQL is written", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldWatchdog("long_queries", dir);
    const content = await readOrNull(dest);
    assertEquals(content !== null, true);
    assertStringIncludes(content!, "pg_stat_activity");
    assertStringIncludes(content!, "check_long_queries");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: connections SQL is written", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldWatchdog("connections", dir);
    const content = await readOrNull(dest);
    assertEquals(content !== null, true);
    assertStringIncludes(content!, "max_connections");
    assertStringIncludes(content!, "check_connections");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: cron_failures SQL is written", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldWatchdog("cron_failures", dir);
    const content = await readOrNull(dest);
    assertEquals(content !== null, true);
    assertStringIncludes(content!, "cron.job_run_details");
    assertStringIncludes(content!, "check_cron_failures");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: edge function is written with correct channel", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldEdgeFn(dir, "telegram", "MyApp", "warn");
    const content = await readOrNull(dest);
    assertEquals(content !== null, true);
    assertStringIncludes(content!, `channel: "telegram"`);
    assertStringIncludes(content!, `'MyApp'`);
    assertStringIncludes(content!, `"warn"`);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: edge function with slack channel", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldEdgeFn(dir, "slack", undefined, "error");
    const content = await readOrNull(dest);
    assertStringIncludes(content!, `channel: "slack"`);
    assertStringIncludes(content!, "undefined"); // no projectName
    assertStringIncludes(content!, `"error"`);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: edge function with discord channel", async () => {
  const dir = await tempDir();
  try {
    const dest = await scaffoldEdgeFn(dir, "discord", "BotProject", "critical");
    const content = await readOrNull(dest);
    assertStringIncludes(content!, `channel: "discord"`);
    assertStringIncludes(content!, "'BotProject'");
    assertStringIncludes(content!, `"critical"`);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("CLI init: edge function written to correct path", async () => {
  const dir = await tempDir();
  try {
    await scaffoldEdgeFn(dir, "telegram", undefined, "warn");
    const expectedPath = join(
      dir,
      "supabase",
      "functions",
      "error-notifier",
      "index.ts",
    );
    const content = await readOrNull(expectedPath);
    assertEquals(content !== null, true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
