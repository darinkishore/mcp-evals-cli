#!/usr/bin/env -S deno run -A
// deno-lint-ignore-file no-explicit-any
import chalk from "npm:chalk@5";

import { importBatch, importOne, getStatus, postAsk } from "./src/api.ts";
import { resolveLangsmithConfig, readConfig, getConfigPath, setConfigKey, unsetConfigKey, mask, openConfigInEditor } from "./src/config.ts";

function usage() {
  console.log(`
evals (Deno + Ink)

Usage:
  evals import [--project-id <id>] [--project-name <name>] [--api-key <key>] [--start-date <iso>] [--end-date <iso>] [--limit <n>]
  evals import-one <trace_id> [--project-id <id>] [--project-name <name>] [--api-key <key>]
  evals status <trace_id>
  evals ask <trace_id> <question...>
  evals review
  evals config [view|set <key> <value>|unset <key>|edit|path]

Env:
  EVAL_API_URL (default http://127.0.0.1:8000)
  LANGSMITH_API_KEY, LANGSMITH_PROJECT_ID
`);
}

function parseOptions(argv: string[]): Record<string, string> {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("-")) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = "true";
    }
  }
  return opts;
}

async function cmdImport(args: string[]) {
  const opts = parseOptions(args);
  const { apiKey, projectId, projectName } = await resolveLangsmithConfig({
    apiKey: opts["api-key"],
    projectId: opts["project-id"],
    projectName: opts["project-name"],
  });

  const startDate = opts["start-date"]; // ISO
  const endDate = opts["end-date"]; // ISO
  const limit = opts["limit"] ? Number(opts["limit"]) : undefined;

  const res = await importBatch({ apiKey, projectId, projectName, startDate, endDate, limit });
  console.log(chalk.bold(`Imported ${res.imported} trace(s) from ${res.projectName ?? "(default)"}`));
  if (res.traces?.length) {
    console.log("Examples:");
    for (const t of res.traces.slice(0, Math.min(5, res.traces.length))) {
      console.log(`  • ${t.traceId}  ${t.firstUserMessage?.slice(0, 60) ?? ""}`);
    }
  }
  console.log(`\nStart reviewing: ${chalk.cyan("evals review")}`);
}

async function cmdImportOne(args: string[]) {
  const [traceId, ...rest] = args;
  if (!traceId || traceId.startsWith("-")) return usage();
  const opts = parseOptions(rest);
  const { apiKey, projectId, projectName } = await resolveLangsmithConfig({
    apiKey: opts["api-key"],
    projectId: opts["project-id"],
    projectName: opts["project-name"],
  });
  const res = await importOne({ traceId, apiKey, projectId, projectName });
  const status = res.created ? "created" : res.updated ? "updated" : "unchanged";
  console.log(chalk.bold(`Trace ${res.trace.traceId} ${status}.`));
}

async function cmdStatus(args: string[]) {
  const [traceId] = args;
  if (!traceId) return usage();
  const s = await getStatus(traceId);
  console.log(chalk.bold("Trace ID:"), s.trace_id);
  console.log(chalk.bold("Analysis:"), s.analysis_status);
  console.log(chalk.bold("Has Analyzer:"), s.has_analyzer_eval ? "yes" : "no");
  console.log(chalk.bold("Has Correctness:"), s.has_correctness_eval ? "yes" : "no");
  console.log(chalk.bold("Ready for Review:"), s.ready_for_review ? chalk.green("yes") : chalk.yellow("no"));
  if (s.created_at) console.log(chalk.bold("Created:"), s.created_at);
}

async function cmdAsk(args: string[]) {
  const [traceId, ...qparts] = args;
  const question = qparts.join(" ").trim();
  if (!traceId || !question) return usage();
  const r = await postAsk(traceId, question);
  console.log(chalk.cyan("Ask:"));
  console.log(r.answer);
}

async function cmdConfig(args: string[]) {
  const [sub, ...rest] = args;
  switch (sub) {
    case "view": {
      const cfg = await readConfig();
      console.log(chalk.bold("Config path:"), getConfigPath());
      console.log(
        JSON.stringify(
          {
            ...cfg,
            langsmithApiKey: mask(cfg.langsmithApiKey),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "set": {
      const [key, ...vparts] = rest;
      if (!key || !vparts.length) {
        console.log("Usage: evals config set <key> <value>");
        return;
      }
      const value = vparts.join(" ");
      if (!['langsmithApiKey','langsmithProjectId','langsmithProjectName','evalApiUrl'].includes(key)) {
        console.log("Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl");
        return;
      }
      // deno-lint-ignore no-explicit-any
      await setConfigKey(key as any, value);
      console.log("Updated", key);
      break;
    }
    case "unset": {
      const [key] = rest;
      if (!key) {
        console.log("Usage: evals config unset <key>");
        return;
      }
      if (!['langsmithApiKey','langsmithProjectId','langsmithProjectName','evalApiUrl'].includes(key)) {
        console.log("Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl");
        return;
      }
      // deno-lint-ignore no-explicit-any
      await unsetConfigKey(key as any);
      console.log("Removed", key);
      break;
    }
    case "edit": {
      try {
        await openConfigInEditor();
      } catch (e) {
        console.error("Failed to open editor:", (e as Error).message);
        console.log("Edit manually:", getConfigPath());
      }
      break;
    }
    case "path": {
      console.log(getConfigPath());
      break;
    }
    default: {
      console.log(`Usage:\n  evals config view\n  evals config set <key> <value>\n  evals config unset <key>\n  evals config edit\n  evals config path`);
    }
  }
}

async function main() {
  const [cmd, ...rest] = Deno.args;
  try {
    switch (cmd) {
      case "import":
        await cmdImport(rest);
        break;
      case "import-one":
        await cmdImportOne(rest);
        break;
      case "status":
        await cmdStatus(rest);
        break;
      case "ask":
        await cmdAsk(rest);
        break;
      case "review":
      case "-r":
        // Lazy-load Ink and React only when needed to avoid TTY rawMode issues
        const [{ default: React }, { render }, { default: ReviewApp }] = await Promise.all([
          import("npm:react@18"),
          import("npm:ink@5"),
          import("./src/ui/Review.tsx"),
        ]);
        render(React.createElement(ReviewApp));
        break;
      case "config":
        await cmdConfig(rest);
        break;
      default:
        usage();
    }
  } catch (e) {
    console.error(chalk.red("Error:"), (e as any).message ?? String(e));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
