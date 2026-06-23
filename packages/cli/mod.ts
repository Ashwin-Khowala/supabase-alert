#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * @ashwinkh/supabase-alerts-cli
 *
 * Usage:
 *   deno run -A jsr:@ashwinkh/supabase-alerts-cli init
 *
 * Scaffolds SQL watchdogs and an error-notifier edge function
 * into your Supabase project directory.
 */

import { runInit } from "./commands/init.ts";

const [command, ...args] = Deno.args;

switch (command) {
  case "init":
    await runInit(args);
    break;

  case "--version":
  case "-v":
    console.log("@ashwinkh/supabase-alerts-cli v0.1.0");
    break;

  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;

  default:
    console.error(`\nUnknown command: "${command}"\n`);
    printHelp();
    Deno.exit(1);
}

function printHelp(): void {
  console.log(`
@ashwinkh/supabase-alerts-cli — scaffold alerting into your Supabase project

Usage:
  deno run -A jsr:@ashwinkh/supabase-alerts-cli <command>

Commands:
  init    Interactively set up watchdogs and the error-notifier edge function
  --help  Show this help message
  --version Show CLI version

Examples:
  deno run -A jsr:@ashwinkh/supabase-alerts-cli init
`);
}
