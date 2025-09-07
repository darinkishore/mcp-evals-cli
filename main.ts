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
  EVAL_API_URL (default http://127.0.0.1:8001)
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
  const DEBUG = (Deno.env.get("EVALS_DEBUG") ?? "").toLowerCase() === "1";
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
      case "-r": {
        // Ensure consistent dev/prod selection for React/Reconciler
        const procEnv = (globalThis as any)?.process?.env;
        try {
          if (procEnv && !("NODE_ENV" in procEnv)) procEnv.NODE_ENV = "development";
        } catch {}

        // Lazy-load Ink and React only when needed to avoid TTY rawMode issues
        const [{ default: React }, { render }, { default: FullScreenApp }] = await Promise.all([
          import("npm:react@19"),
          import("npm:ink@6"),
          import("./src/ui/FullScreenApp.tsx"),
        ]);

        // Guard against mismatched React version (Ink v6 needs React 19)
        // react-reconciler@0.32 expects __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        if (!(React as any)?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
          throw new Error(
            "React 19 not resolved at runtime (missing __CLIENT_INTERNALS...). " +
              "Try: deno cache --reload cli/deno/main.ts, then reinstall with deno install -f -A --config cli/deno/deno.jsonc -n evals cli/deno/main.ts."
          );
        }

        const proc: any = (globalThis as any).process;
        const write = (s: string) => {
          try {
            if (proc?.stdout?.isTTY && proc?.stdout?.write) proc.stdout.write(s);
          } catch {
            // ignore
          }
        };
        const enterAlt = () => write("\x1b[?1049h");
        const leaveAlt = () => write("\x1b[?1049l");

        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          leaveAlt();
        };

        // Install signal handlers for robust restore
        const denoHasSignals = typeof (Deno as any)?.addSignalListener === "function";
        const denoAdd = (sig: string, fn: () => void) => {
          try { (Deno as any).addSignalListener?.(sig, fn); } catch {}
        };
        const denoRemove = (sig: string, fn: () => void) => {
          try { (Deno as any).removeSignalListener?.(sig, fn); } catch {}
        };
        const nodeOn = (ev: string, fn: () => void) => { try { proc?.on?.(ev, fn); } catch {} };
        const nodeOff = (ev: string, fn: () => void) => { try { proc?.off?.(ev, fn); } catch {} };

        const onSigInt = () => cleanup();
        const onSigTerm = () => cleanup();
        if (denoHasSignals) {
          denoAdd("SIGINT", onSigInt);
          denoAdd("SIGTERM", onSigTerm);
        }
        nodeOn("SIGINT", onSigInt);
        nodeOn("SIGTERM", onSigTerm);

        enterAlt();
        const ink = render(React.createElement(FullScreenApp));
        try {
          await (ink as any).waitUntilExit?.();
        } finally {
          cleanup();
          if (denoHasSignals) {
            denoRemove("SIGINT", onSigInt);
            denoRemove("SIGTERM", onSigTerm);
          }
          nodeOff("SIGINT", onSigInt);
          nodeOff("SIGTERM", onSigTerm);
        }
        break;
      }
      case "config":
        await cmdConfig(rest);
        break;
      default:
        usage();
    }
  } catch (e) {
    const err = e as any;
    console.error(chalk.red("Error:"), err?.message ?? String(err));
    if (DEBUG) {
      console.error("Stack:");
      console.error(err?.stack ?? "<no stack>");
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
