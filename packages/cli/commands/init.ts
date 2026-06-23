/**
 * `init` command — interactively scaffold supabase-alerts into a project.
 *
 * Writes:
 *  - supabase/migrations/<timestamp>_supabase_alerts_<watchdog>.sql  (selected watchdogs)
 *  - supabase/functions/error-notifier/index.ts                      (edge function scaffold)
 *
 * Prints the required env vars at the end.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";

// ---------------------------------------------------------------------------
// Terminal helpers (no external prompt library — pure Deno stdin)
// ---------------------------------------------------------------------------

async function prompt(question: string): Promise<string> {
  const encoder = new TextEncoder();
  await Deno.stdout.write(encoder.encode(question));
  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);
  return new TextDecoder().decode(buf.slice(0, n ?? 0)).trim();
}

async function choose(
  question: string,
  options: string[],
): Promise<string> {
  while (true) {
    console.log(`\n${question}`);
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
    const answer = await prompt(`Select [1-${options.length}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx];
    console.log("  ⚠  Invalid selection, please try again.");
  }
}

async function multiChoose(
  question: string,
  options: string[],
): Promise<string[]> {
  while (true) {
    console.log(`\n${question} (comma-separated numbers, e.g. 1,3)`);
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
    const answer = await prompt(`Select [1-${options.length}]: `);

    if (answer.trim() === "") return []; // none selected

    const indices = answer.split(",").map((s) => parseInt(s.trim(), 10) - 1);
    if (indices.every((i) => i >= 0 && i < options.length)) {
      return [...new Set(indices)].map((i) => options[i]);
    }
    console.log("  ⚠  Invalid selection, please try again.");
  }
}

// ---------------------------------------------------------------------------
// Template loaders
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = new URL("../templates", import.meta.url).pathname
  // Windows path fix: remove leading slash on drive letters like /C:/...
  .replace(/^\/([A-Za-z]:)/, "$1");

async function loadTemplate(relativePath: string): Promise<string> {
  const fullPath = join(TEMPLATE_DIR, relativePath);
  return await Deno.readTextFile(fullPath);
}

// ---------------------------------------------------------------------------
// Main init flow
// ---------------------------------------------------------------------------

export async function runInit(_args: string[]): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════╗
║  supabase-alerts — Project Setup             ║
╚══════════════════════════════════════════════╝
`);

  // 1. Channel selection
  const channel = await choose(
    "Which notification channel do you want to use?",
    ["telegram", "slack", "discord"],
  );

  // 2. Project name
  const projectNameRaw = await prompt(
    "\nProject name (shown in every alert, e.g. MyApp) [optional, press Enter to skip]: ",
  );
  const projectName = projectNameRaw || undefined;

  // 3. Min severity
  const minSeverity = await choose(
    "Minimum severity to alert on?",
    ["info", "warn", "error", "critical"],
  );

  // 4. Watchdogs
  const selectedWatchdogs = await multiChoose(
    "Which SQL watchdogs do you want to enable?",
    ["long_queries", "connections", "cron_failures"],
  );

  // 5. Output directory (default: current working directory)
  const cwd = Deno.cwd();
  const migrationsDir = join(cwd, "supabase", "migrations");
  const functionsDir = join(cwd, "supabase", "functions", "error-notifier");

  console.log(`\n📁 Writing files to: ${cwd}`);

  // 6. Write SQL watchdog migrations
  if (selectedWatchdogs.length > 0) {
    await ensureDir(migrationsDir);
    for (const watchdog of selectedWatchdogs) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, "")
        .slice(0, 14);
      const filename = `${timestamp}_supabase_alerts_${watchdog}.sql`;
      const destPath = join(migrationsDir, filename);
      const sql = await loadTemplate(`sql/${watchdog}.sql`);
      await Deno.writeTextFile(destPath, sql);
      console.log(`  ✅ ${join("supabase", "migrations", filename)}`);
    }
  }

  // 7. Write edge function scaffold
  await ensureDir(functionsDir);
  let edgeFnTemplate = await loadTemplate("edge-fn/error-notifier/index.ts");

  // Inject config into template
  edgeFnTemplate = edgeFnTemplate
    .replace("__CHANNEL__", channel)
    .replace("__PROJECT_NAME__", projectName ? `'${projectName}'` : "undefined")
    .replace("__MIN_SEVERITY__", minSeverity);

  await Deno.writeTextFile(join(functionsDir, "index.ts"), edgeFnTemplate);
  console.log(
    `  ✅ ${join("supabase", "functions", "error-notifier", "index.ts")}`,
  );

  // 8. Print env vars
  console.log(`
╔══════════════════════════════════════════════╗
║  Set these environment variables             ║
╚══════════════════════════════════════════════╝
`);

  switch (channel) {
    case "telegram":
      console.log("  TELEGRAM_BOT_TOKEN=<your-bot-token>");
      console.log("  TELEGRAM_CHAT_ID=<your-chat-id>");
      break;
    case "slack":
      console.log("  SLACK_WEBHOOK_URL=<your-incoming-webhook-url>");
      break;
    case "discord":
      console.log("  DISCORD_WEBHOOK_URL=<your-webhook-url>");
      break;
  }

  console.log(`
Run:
  supabase secrets set <KEY>=<VALUE> [--env-file .env]
  supabase db push       ← applies the SQL migrations
  supabase functions deploy error-notifier

📖 Docs: https://github.com/your-org/supabase-alerts#readme
`);
}
